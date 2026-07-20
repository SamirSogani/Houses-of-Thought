# AI Subsystem — Remediation Plan

Companion to [ai-subsystem.md](ai-subsystem.md) (finding IDs referenced below).
Effort: **S** ≤ half day · **M** ≤ 2 days · **L** ≤ week. **Gate** = must land
before the first school pilot. Ordered so each phase is shippable alone.

## Phase 0 — Stop the uncapped-spend holes (all S, all Gate)

**0.1 Verify migrations 0010/0011/0022 applied live; prove the limiter closes.** (S, Gate)
Cross-ref strategy-gaps §4.6 / ops M3. Run one over-cap loop against a scratch
account in prod and confirm the 26th call 429s. Add the Sentry capture on the two
fail-open paths (`lib/ai/limits.ts:112,120`) while there — ops M3 already specifies it.

**0.2 Close the cookieless-anonymous hole (C1): always enforce a second, IP-keyed ceiling.** (S, Gate)
The cookie subject stays primary (fair per-browser UX); the fix is layering the IP
ceiling *always*, not only when cookies fail — the module comment at
`limits.ts:14-18` already anticipates this. Sketch in `enforceAiLimit`:
```ts
// after the cookie/user subject check passes:
if (!subject.startsWith('user:')) {
  const { data } = await serviceClient().rpc('increment_ai_usage', { sub: ipSubject(req) })
  if (typeof data === 'number' && data > ANON_IP_DAILY_CAP) throw new AiError(429, 'rate-limited')
}
```
`ANON_IP_DAILY_CAP` ≈ 100 (several browsers behind one NAT stay usable; a curl loop
dies at 100/day). One extra RPC per anonymous call only. School NATs: classroom
students should be authed; if an anonymous classroom demo matters, raise the cap —
it still bounds the loop at ~$1.30/day of mini-house.

**0.3 Advance the chain on 5xx / timeout / network (C2).** (S, Gate)
Keep 400/401/403 terminal (real misconfigurations). In `execute()`
(`router.ts:687-704`), treat `status >= 500` and `status === undefined`
(timeout/network) like 429 minus the penalty/airbag bookkeeping:
```ts
const s = statusOf(err)
const transient = s === 429 || s === undefined || s >= 500
if (s === 429) { /* existing daily/penalty logic */ }
if (transient) { record(...); lastTransient = mapUpstream(err, attempt.provider); continue }
throw mapUpstream(err, attempt.provider) // 400/401/403 only
```
Preserve the final-error preference order at `router.ts:730-734` (throw
`lastTransient` when nothing succeeded). Also stop treating `ai-empty-output` as
terminal (`router.ts:688,768`) — an empty generation is provider flakiness, not
caller error; let it cascade the same way.

**0.4 Give each attempt a latency budget instead of one 25s timeout (H1).** (S, Gate)
Chain worst case must fit `maxDuration = 30`. Per-attempt timeouts via request
options (the SDK accepts `{ timeout }` per call): suggestor/realtime 8s per attempt,
drafter 20s, and track a deadline: `const deadline = Date.now() + 26_000`, skip
remaining attempts when past it and throw the last transient error. This converts
platform kills (opaque, unrecorded) into mapped AiErrors that `record()` sees.

## Phase 1 — Cost controls (before pilot; 1.1–1.2 Gate)

**1.1 Control Gemini thinking spend (H2).** (S, Gate)
Extend `reasoningEffortFor` (`router.ts:637-643`): Gemini's OpenAI-compat endpoint
accepts `reasoning_effort` (`low`/`medium`/`high`, and `none` on 2.5 Flash) — map
`'low'` → `'none'`, `'high'` → `'low'` (dynamic thinking rarely earns its 8×
out-rate here) and verify against the live API once. Expected saving: ~50–70% of
drafter-lane cost (mini-house, draft, research, strawman). While there, decide
whether critique should ride the drafter lane instead of the critic lane so
`effort:'high'` actually reaches a reasoning model.

**1.2 Upgrade Brave + unify degradation (H3).** (S, Gate)
Paid Base tier (~$5/1k, 20 rps) before any classroom use — ~$10–15/mo at pilot
volume. Make the draft evidence stage degrade like mini-house instead of halting the
run: wrap `braveSearch` at `draft/route.ts:115` in try/catch → on failure return
`{ stage, actions: [] }` (the stage is already allowed to be empty). Leave
`/api/ai/research` failing loudly (user explicitly asked to search) but fix the
client copy for `search-rate-limited`.

**1.3 Put an intent gate on suggest auto-fire (M3).** (S)
Options, cheapest first: (a) lift `cacheRef` from `CopilotPanel` to
`BuildHousePage` so tab switches stop discarding it (the deliberate-unmount comment
at `CopilotPanel.tsx:63-65` predates cost data); (b) auto-fetch only the first
visit per layer per session, "Refresh" for everything else. Expected: ~40–60% cut
in suggest volume — the largest per-student line item.

**1.4 Surface usage where the operator already looks (extends admin monitor).** (M)
The monitor shows health but not consumption — the audit's "operating blind" gap.
Add to `/api/admin/ai-status` GET: today's `ai_usage` totals (sum, top-10 subjects,
anon-vs-user split — one service-role query) and a module-global per-route call
counter. Add a Brave query counter (module-global int in `brave.ts`, same
per-instance caveat as B5 — label it "this instance"). This is a dashboard read, not
new infra, and directly answers "is C1 happening right now?"

## Phase 2 — Output robustness (soon after pilot start)

**2.1 Probe with the real request shape (M1).** (S)
`probeTarget` (`router.ts:420-425`) should send a tiny `response_format` matching
what live traffic sends that target (`json_schema` for gpt-oss, `json_object`
otherwise) with a 2-field schema. A target that 400s on structured output then shows
ERROR in the monitor instead of a false UP. Also probe-detects sunset model ids.

**2.2 Soften exact-cardinality schemas / normalize before parse (H4).** (M)
Highest-value: critique and mini-house. Either relax (`.min(5).max(7)` on standards,
`.min(2).max(4)` on tradeoffs) with server-side trim/pad to the canonical shape, or
keep strict zod but add a pre-parse normalizer (pad missing standards with
`grade:'mixed', note:'(not returned)'`). Also truncate the retry feedback: send only
the first zod issue, capped ~300 chars, instead of the full `result.error.message`
(`router.ts:821`).

**2.3 Interview contract (M4).** (S)
Schema-side: `.refine(r => !r.done || r.context !== null)` so `done+null` fails into
the existing retry. Client-side: when `forceSummary` was sent and the reply still
isn't actionable, end the interview locally with a "couldn't summarize" state rather
than looping. Bound turns: `content: z.string().max(4000)` in the request schema
(`interview/route.ts:42-49`).

**2.4 Scope the airbag + label instance-local state (M2, extends B5).** (S)
Track `dailyExhaustedOn` per provider (`Map<ProviderId, string>`); OpenRouter
terminal fires when *every configured target in the attempted lane* is
daily-exhausted. Monitor: rename the card "Daily airbag (this instance)" and list
which provider(s) tripped it. No shared store yet — per-instance stays acceptable
once it is labeled and scoped.

## Phase 3 — Vendor & lifecycle hygiene (background)

**3.1 Pin the floating alias; write the model-sunset runbook.** (S)
Pin `ministral-8b-latest` → a dated id via `MISTRAL_MODEL` in Vercel env (zero code).
Runbook (one page in `docs/`): symptom (lane primary hard-erroring 400/404 — after
0.3 it degrades instead), diagnosis (probe), fix (env override matrix in
`.env.example:29-38` + redeploy). Calendar note: Groq rotates its lineup (decisions
006/012); re-verify all six pinned ids quarterly and the Gemini free-tier RPD
assumption at `router.ts:28`.

**3.2 Router state-machine tests.** (M)
Cross-ref code-quality §7 priority 1 — `__resetRouterState` already exists. The
Phase 0 changes (transient cascade, deadlines) *change* failover semantics; they
should land with vitest cases: penalty open/recover, daily airbag isolation, size
skip, overflow escalation, 5xx cascade, deadline exhaustion (~15 cases, mock client).

**3.3 `ai_usage` pruning.** (S)
Cross-ref DB-audit L1; more urgent after 0.2 doubles anonymous row writes. Weekly
`delete from ai_usage where day < now() - interval '90 days'` (pg_cron or the
Phase-1 ops GitHub Action).

**3.4 Only if pilot data demands it: shared limiter/penalty state.** (L)
A Supabase row (or Upstash free tier) for penalty box + airbag + Brave counter makes
signals fleet-wide. The router comment (`router.ts:184-189`) already designs for the
swap. Do not build ahead of evidence — per-instance state degrades safely and costs
nothing.

## Gate summary (must land before school pilots)
0.1 limiter verified closed · 0.2 IP ceiling · 0.3 transient cascade ·
0.4 latency budget · 1.1 Gemini thinking control · 1.2 Brave paid tier + draft
degradation. Everything else can trail the pilot by weeks without material risk.
