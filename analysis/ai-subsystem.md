# AI Subsystem Audit — Router, Cost, Limits, Prompts, Vendors

Scope: `lib/ai/*`, `app/api/ai/*`, admin monitor — resilience, unit economics,
rate-limit economics, prompt/schema robustness, vendor risk. Security is out of
scope. Does not repeat: B1/B2/B5 (audits/code-quality-review.md), M1/M3/H1
(analysis/operations-and-delivery.md), §2/§4.6 (analysis/product-strategy-gaps.md) —
cross-referenced where they compound. Companion plan: [ai-subsystem-plan.md](ai-subsystem-plan.md).

A structural note up front: **there is no streaming path anywhere** — every route is
one-shot `chat.completions.create` (`lib/ai/router.ts:754-764`; decision 016 §4 keeps
SSE out of scope). "Partial stream death" cannot occur; the trade is a 10–25s opaque
wait on the big calls, papered over by cosmetic timers (`lib/ai/mini-house.ts:88-99`).

## Critical

### C1 — The anonymous daily cap never binds for a client that drops cookies; the most expensive call sits on the unauthenticated page
`lib/ai/limits.ts:64-78`: the anonymous subject is the `hot_aid` cookie, and when no
cookie is presented a **new UUID is minted per request**. The hashed-IP fallback
(`limits.ts:96-98,103-106`) fires only if `cookies()` *throws* — which it doesn't in
a route handler. So a scripted client that ignores `Set-Cookie` gets a fresh subject
(`anon:<uuid>`) and count=1 every request; `ANON_DAILY_CAP = 25` (`limits.ts:35`) is
a browser-etiquette cap, not a ceiling. Each such request also inserts a fresh
`ai_usage` row (migration `0011`), compounding DB-audit L1. The exposed surface is
not just `/try` mini-house (the single most expensive op — ~4.5k billed tokens on
Gemini + one Brave query per call, `app/api/ai/mini-house/route.ts:73,87-95`) but
also `/house`: anonymous callers resolve to full `standard` posture
(`lib/auth/account.ts:5-7,22`) and can drive suggest, interview, research (burning
Brave), and critique; only draft and strawman require auth (`draft/route.ts:80-89`,
`strawman/route.ts:64-68`). This compounds ops M3 / strategy-gaps §4.6: until
migration 0011 is verified live, the limiter fails open for *everyone* — today the
only real caps are the providers' own free-tier limits.
Failure scenario: a curl loop against `/api/ai/mini-house` (no auth, no cookie)
runs overnight at ~$0.013-equivalent quota + 1 Brave query per call. By morning
Gemini's free RPD and Brave's 2k/month are exhausted — every legitimate draft run
and research click fails for the rest of the day, `ai_usage` gained tens of
thousands of rows, and nothing alerts (ops H1).

### C2 — Any non-429 failure on a lane's first target kills the request while three healthy fallbacks idle
Cascade discipline is 429-or-overflow only: `lib/ai/router.ts:689-704` — a 5xx, a
network error, or an SDK timeout (`timeout: 25_000`, `router.ts:171`; timeout errors
carry no `status`, so `statusOf` → undefined) falls through to
`throw mapUpstream(...)` at `router.ts:704` and the whole chain aborts with 502.
An empty completion is likewise terminal (`AiError` rethrow, `router.ts:688,768`) —
and the repo's own comments document Groq returning `json_validate_failed` with empty
output (`critique/route.ts:83-86`, `research/route.ts:102-104`). Decisions 012/013
chose this deliberately ("we bypass rate limits, not real bugs"), but it conflates
*misconfiguration* (400/401 — rightly terminal) with *provider incidents* (5xx,
timeouts — exactly what a 4-target lane exists to survive).
Failure scenario: Mistral has a 40-minute elevated-5xx incident. Every interview turn,
critique, and research query-derivation (all `coach`/`critic` lane, primary Mistral —
`router.ts:583-597`) returns 502 "Couldn't reach the co-pilot" for the duration, while
Groq, Gemini, and Cerebras sit healthy one index further down the attempts array.

## High

### H1 — Worst-case chain latency is 4–10× the function budget; the user sees an unmapped platform timeout
Each attempt may consume the full 25s SDK timeout (`router.ts:171`); a lane holds up
to 4 targets plus the OpenRouter terminal (`router.ts:673,711`); a schema-parse
failure re-runs the *entire* chain (`router.ts:818-825`). Worst case ≈ 25s × 5 × 2,
against `maxDuration = 30` on every route (e.g. `suggest/route.ts:16`). One
slow-but-alive primary eats 25 of the 30s even when the next target would answer in
800ms; two slow targets guarantee a platform kill, which returns a non-JSON body the
clients coerce to a generic error (`CopilotPanel.tsx:96-97`) — the AiError mapping,
penalty box, and health `record()` never run for that request, and the tokens are
still billed upstream.
Failure scenario: Cerebras degrades to 20s responses without erroring (suggestor
primary, `router.ts:604`). Every sidebar suggestion takes 20s or dies at 30s; the
penalty box never opens because nothing 429s; the monitor shows Cerebras `ok`.

### H2 — The `effort` knob silently fails on both cost and quality across the two lanes that matter most
`reasoningEffortFor` maps only gpt-oss and qwen families (`router.ts:637-643`); Gemini
gets `undefined`. Gemini 2.5 Flash ships with **dynamic thinking on by default,
billed as output** — so every drafter-lane call (draft stages, research synthesis,
mini-house, strawman; all `effort:'high'`) pays an uncontrolled ~0.8–2k thinking
tokens at the highest out-rate in the fleet ($2.50/M assumed), roughly half to
two-thirds of that lane's modelled cost. Conversely the critic lane's `effort:'high'`
(`critique/route.ts:76-87`) lands on `ministral-8b-latest`, which has no reasoning
mode at all — the intended "deep review" quality bump never happens on the primary.
The knob only does what it says when a request happens to fail over onto a gpt-oss or
qwen target. Failure scenario: none needed — this is a steady-state cost/quality leak
priced in the table below.

### H3 — Brave is classroom-incompatible on the free tier, and its three consumers degrade three different ways
Assumption: Brave free = 2,000 queries/month at 1 request/second; Base ≈ $5/1k
(verify). One classroom period of Research Mode (30 students × 2 runs) is a
~60-query burst — at 1 rps most requests 429; a month of pilot usage exceeds 2k
several times over. The three call sites disagree on failure semantics: mini-house
degrades to an evidence-less teaser (`mini-house/route.ts:80-83`);
`/api/ai/research` hard-fails (`research/route.ts:88` — and `search-rate-limited`
doesn't match `RATE_LIMITED_CODE`, `findings.ts:15`, so the client shows a generic
error); a draft run **halts mid-build** at the evidence stage (`draft/route.ts:115`
throws; `useDraftRunner.ts:65-69` stops the loop).
Failure scenario: teacher says "everyone research your evidence now"; ~2 students
succeed, 28 get generic errors mid-lesson; the teacher concludes the feature is broken.

### H4 — Exact-cardinality schemas × heterogeneous JSON discipline = full-price retries and 502s on the two biggest outputs
Everything except gpt-oss targets runs `json_object` with the JSON Schema pasted
into the system prompt (`router.ts:627-629,743-751`) — no constrained decoding. Yet
the strictest schemas guard the largest outputs: critique requires **exactly 6**
standards (`critique/route.ts:31-39`); mini-house exactly-3 perspectives /
exactly-2 sub-questions / exactly-3 tradeoffs (`lib/ai/mini-house.ts:33,62-67`).
One missed count → the retry re-runs the whole failover chain at full price
(`router.ts:818-822`), appending the raw zod error JSON to the prompt
(`router.ts:821` — zod v4 messages are stringified issue arrays, easily 1–3k
chars); a second miss → 502 `ai-invalid-output`. Measured schema-embed overhead
(chars/4): FindingsResponse **715 tok**, DraftResponse **540**, MiniHouse **420**,
Critique **199** — on *every* non-gpt-oss call.
Failure scenario: Mistral (critic primary) returns 5 standards; the retry returns
an object keyed by standard name; a dead Review panel after ~2× cost and ~20s.

## Medium

### M1 — Structured-output capability is keyed by model *name*, not provider, and the probe never tests it; a sunset model is a lane outage
`supportsJsonSchema` matches `'gpt-oss'` (`router.ts:627-629`), so Groq's and
Cerebras' *different* `json_schema` implementations receive the same 7-variant
discriminated union (715-token embed) — a provider-side rejection is a hard 400 =
terminal (C2). The admin probe sends a bare 8-token "ping" with no `response_format`
(`router.ts:420-425`), so a target can probe UP while 400-ing all real traffic — a
NEW gap beyond B5. Same blindness for deprecations: a decommissioned model id returns
400/404 → terminal, no failover; the OpenRouter default has *already* rotated once
(`router.ts:150-152`), and Groq retired the previous default lineup (decisions 006,
012 — llama-3.1-8b sunset 2026-08-16).

### M2 — The "daily airbag" is armed by any single provider's daily 429 but presented as a global blackout
`markDailyExhausted()` fires on the first daily-quota 429 from *any* target
(`router.ts:693-694`); Gemini's free RPD makes it the near-certain tripper. The
monitor then shows "ARMED — routing to OpenRouter" (`AiMonitor.tsx:276-283`) as if
all lanes were exhausted, and — per-instance, extending B5 — other warm instances
show "Clear" simultaneously. Operator cannot tell "Gemini done for the day" (routine)
from "fleet-wide blackout" (incident). Router comment `router.ts:28` also assumes a
Gemini "1,500/day budget" — Google has repeatedly cut free-tier RPD (reportedly to
250/day for 2.5 Flash); if so, ~35 draft runs + mini-houses saturate the drafter
primary daily. Verify the live number; it is the binding capacity constraint.

### M3 — Suggest auto-fires on every step change and its cache dies on tab switch: the biggest per-student cost driver has no intent gate
`CopilotPanel.tsx:112-123` fetches on mount and every step change; the cache is a ref
that resets whenever the panel unmounts (tab switch / mobile drawer — deliberate per
comment at :63-65). A student walking 7 layers with a few tab switches and refreshes
fires ~15–30 suggest calls (~2.9k tokens in each) — ~50–75% of the modelled
per-assignment cost, and 15–30 of an anonymous user's 25-call daily pool.
Failure scenario: anonymous `/house` demo — cap exhausted mid-lesson by navigation
alone (`rate-limited` copy: "resets tomorrow"), before the student deliberately asks
for anything.

### M4 — Interview contract gaps: `done=true, context=null` is schema-legal and loops; per-turn strings are unbounded
The response schema allows `done && context === null` (`interview/route.ts:55-61` —
the prompt demands non-null, nothing enforces it); the client treats that as
"another turn" (`InterviewCard.tsx:52-57`), so a wrap-up-refusing model triggers
repeated `forceSummary` calls at ~2.6k tokens + one limiter increment each.
Transcript turns are `z.string()` with no max (`interview/route.ts:42-49`) under a
512 KB body cap (`:18`) — one pasted turn can push ~125k input tokens onto Gemini
via size-aware routing (~$0.04/call; the 250/day cap bounds it at ~$10/day/user).

### M5 — Concentration: one model in all three lanes, a two-target drafter lane, a floating-alias primary
Cerebras `gpt-oss-120b` appears in every lane (`router.ts:334-352`) — one Cerebras
incident degrades suggestor primary, realtime tail, and drafter fallback at once.
The drafter lane has only Gemini + Cerebras before the airbag (`router.ts:617`).
`ministral-8b-latest` is a **floating alias** (`router.ts:120`): Mistral can swap
the model under prompts tuned to current behavior — invisible drift, no deploy. The
`.env.example` override matrix (`:29-38`) is good mitigation: any sunset is an env
edit + redeploy, no code change.

## Low

- **L1** Mini-house 429 copy says "busy right now — try again in a moment" even for
  the *daily* cap (`mini-house/route.ts:36-39`) — retrying can't help; TryItFlow
  renders server strings verbatim (cross-ref code-quality §2).
- **L2** Mini-house sends the raw question (≤600 chars) as the Brave query
  (`mini-house/route.ts:73`); Brave caps `q` at 400 chars / 50 words → long
  questions silently produce evidence-less teasers.
- **L3** `enforceAiLimit` increments before body validation (e.g.
  `suggest/route.ts:37-48`) — malformed requests consume quota.
- **L4** Every AI call adds 1–2 Supabase round-trips (`lib/auth/account.ts:18-33`)
  — latency, not cost.

## Cost model

**Rate assumptions** ($/1M tokens, approximate public list prices — re-verify
before budgeting): Cerebras gpt-oss-120b 0.25 in / 0.69 out · Mistral ministral-8b
0.10 / 0.10 · Groq qwen3.6-27b ~0.29 / 0.59 · Groq gpt-oss-20b 0.10 / 0.50 ·
Gemini 2.5 Flash 0.30 / 2.50 (thinking billed as output) · OpenRouter `:free` $0 ·
Brave $5/1k paid. Token counts measured by script (chars/4): system prompts 151–522
tok, schema embeds 40–715 tok, serialized house 108 empty / ~1,830 typical / 3,500
at clip cap (`serialize.ts:54`), 6-result Brave block ~600 tok. Output = JSON +
thinking estimate. Costs assume the lane *primary* serves; free tiers make the
marginal dollar $0 until quotas exhaust, so this is the shadow / paid-tier price.

| Operation (lane primary) | In tok | Out tok | $/op | Arithmetic |
|---|---|---|---|---|
| suggest (Cerebras 120b) | ~2,900 | ~800 | $0.0013 | 2.9k×.25 + 0.8k×.69 per M |
| interview turn (Mistral 8b) | ~2,600 | ~150 | $0.0003 | ×5 turns/intake ≈ $0.0014 |
| query-derivation (Mistral 8b) | ~2,100 | ~25 | $0.0002 | research + draft-evidence |
| research run (Gemini + Brave) | ~2,850 | ~1,200 | $0.009 | .00085+.0030 + query + $.005 Brave |
| critique (Mistral 8b) | ~2,450 | ~700 | $0.0003 | on Gemini fallback ≈ $0.006 |
| strawman (Gemini) | ~700 | ~1,400 | $0.004 | .0002 + 1.4k×2.5/M |
| draft run = 6 LLM + Brave (Gemini) | ~12,600 | ~6,500 | $0.025 | .0038+.0163+.0002 + $.005 |
| mini-house (Gemini + Brave) | ~1,600 | ~3,000 | $0.013 | .0005+.0075 + $.005 |

**Roll-ups** (typical student assignment: 1 intake + ~15 suggests + 2 research +
2 critiques): ≈ **$0.04/student/assignment** (suggest ≈ half). Classroom period,
30 active students ≈ **$1.20** and ~780 requests, incl. a 60-query Brave burst (fails
free tier). 600-student pilot year at 20 AI-worked assignments/student ≈ 600×20×$0.04
= **$480/yr**; at the DB-audit's 80 houses/student upper bound ≈ $1,920/yr. Brave
paid: ~24k queries ≈ $120/yr. Draft Mode adds $0.025/run (authed only).
**Conclusion: legitimate usage is cheap (hundreds of $/yr); the material risks are
C1 (unmetered anonymous), H2 (Gemini thinking ≈ 50–70% of drafter cost), M3
(auto-fire multiplier), and free-tier *quota* exhaustion long before dollars matter.**

## What's already right (don't break it)

Cascade discipline is documented and mostly deliberate (`router.ts:50-53`);
Brave-URL allowlisting is enforced server-side in all three consumers
(`research/route.ts:109-111`, `draft/route.ts:137-142`, `mini-house/route.ts:98`);
size-aware routing + overflow escalation (`router.ts:674,698-701`) works; the
serializer's named clip caps bound every prompt (`serialize.ts:40-54`); PERSONA
composition is structurally sound — composed into all five co-pilot surfaces, the
two Author surfaces (strawman, mini-house) explicitly self-contained and documented
(`prompts.ts:94-107`); invariant 1 is enforced in the type system, not just prompts
(`findings.ts:36-40`). One drift risk: the safety tail ("never invent facts/URLs;
medical/legal/financial") exists in three hand-copied variants
(`prompts.ts:11-15,118-119,125`).
