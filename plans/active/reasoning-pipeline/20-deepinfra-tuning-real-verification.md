# 20 — Real-verification of the DeepInfra tuning branch: three real bugs found and fixed

**Date:** 2026-08-12 · Branch: `reasoning-pipeline-deepinfra-tuning`, extending
`e95241a` (which itself swapped DeepInfra's swarm/synthesis model to
gpt-oss-20b and widened timeouts — see that commit's message for the
starting point). This session's job was to real-verify that branch and fix
what real traffic exposed. Multiple n=2 real (non-dry-run) runs against
`/admin/reasoning`, cross-referenced with live dev-server logs and the
`/admin` AI Router Monitor.

## Fixes, in the order they were found

### 1. Repair-mode calls exhausting their own token budget
Real evidence: `finishReason: "length"`, empty output, on repair-mode
(`allowHighReasoning: true`) calls — on **both** DeepInfra and Groq, same
underlying model (`gpt-oss-20b`), same failure. `router-shared.ts` already
documented this as a known risk of the `allowHighReasoning` opt-in; it
turned out not to be rare.
**Fix:** `REPAIR_TOKEN_HEADROOM = 3000` ([budget.ts](budget.ts)), added on
top of each repair-capable call's own first-pass `maxTokens` — all 8 call
sites across `orchestrator-global.ts` and `orchestrator-perspectives.ts`.

### 2. Groq's 413 "Request too large" wasn't cascading at all
Once (1) let repair-mode requests get bigger, some now exceed Groq's
account-level 8000 TPM ceiling in a **single request** (413, not a plain
429). That error didn't match any existing classification in
`router.ts`'s `execute()` — it fell through to the terminal `throw`,
killing the whole fallback chain immediately. A real repair-mode call died
this way without ever reaching Gemini.
**Fix:** `isGroqTokenLimitExceeded()` ([router-shared.ts](../../../lib/ai/router-shared.ts))
classifies it as cascade-worthy (no penalty box — the request is
structurally too big, not something waiting fixes).

### 3. Groq structurally can't serve repair-mode calls — so stop asking it to
Real count: **zero** repair-mode calls succeeded via Groq, across every
regeneration attempt this session (413 TPM ceiling, or `json_validate_failed`
just under it). Confirmed Hobby plan (no Fluid Compute headroom) — the
route's `maxDuration=60` is already near the real ceiling, so the fix isn't
"wait longer," it's "stop spending the fixed ~55s chain budget on a
provider that can't serve these."
**Fix:** `swarmAttempts()`/`synthesisAttempts()` ([router-lanes.ts](../../../lib/ai/router-lanes.ts))
take `allowHighReasoning`; when true, Groq is skipped entirely and DeepInfra
gets `DEEPINFRA_SWARM_LARGE_TIMEOUT_MS = 50_000` instead of the normal 45s.

### 4. `generateWithOptionalSearch`'s per-round deadline vs. the platform ceiling
`perspective_evidence`/`global_evidence` route through up to 3 sequential
`completeJSON` calls (generate → search → generate → search → forced
finalize), and each call independently claimed a **fresh** 55s
`CHAIN_DEADLINE_MS`. Worst case ≈165s of model-call time against a 60s hard
platform ceiling (Hobby plan) — Vercel killed the function outright before
the loop's own retry logic ever got to finish on its own terms. Real
symptom: long hangs (2–3+ min) ending in a generic client-side "Network
hiccup," not a clean server error.
**Fix:** `chainDeadlineFor(role)` ([router.ts](../../../lib/ai/router.ts))
computed once, threaded through every round via `completeJSON`'s new
optional `deadlineAt`. A late round that's out of real budget now throws a
fast, classified `ai-timeout` instead of hanging for a window it was never
going to get.

## Real-verification evidence

| Run | Frame | Perspectives | Where it stopped |
|---|---|---|---|
| Pre-fix (branch as inherited) | 9/9 first try | both first try | `global-assumptions-review` repair: `finishReason:length` empty output on every attempt |
| Post-(1)(2) | 9/9 first try | both first try | Repair calls succeed via failover, but 413/json_validate_failed on Groq burn most of the shared deadline |
| Post-(3) | 9/9 first try | 9/9, 8/9 first try | `global_assumptions_packet` — Gemini itself truncates at 900 tokens (new, separate finding — §Known gaps) |
| Post-(4) | 9/9 first try | 9/9, 8/9 first try | Failures now resolve in **~38s** (classified `ai-invalid-output`) instead of 2–3min hangs |

Frame converging 9/9 on the first attempt and both perspectives passing with
zero regenerations, consistently across every post-fix run, is the clearest
positive signal — none of the earlier `main`-branch runs this session
managed that.

## How to tell if this is actually helping, going forward

No automated per-run telemetry exists yet (decision 020's own noted gap,
still open — see §Known gaps). Until that's built, these are the two real
signals already available:

- **`/admin` → AI Router Monitor → Target Health.** Watch `groq ·
  openai/gpt-oss-20b`'s OK/FAIL — if the fixes are working, its fail count
  should stop climbing on swarm/synthesis traffic (it's no longer asked to
  serve the calls that were failing it). Watch `deepinfra`'s OK/FAIL
  ratio too — it was ~85% (59/10) before any of this session's fixes; a
  materially worse ratio after means something regressed, not improved.
- **`/admin/reasoning/runs` (Past Runs).** Watch `haltReason` distribution
  over time. A `frame-review`/`global-assumptions-review` halt citing the
  *same* 1–2 standards on all 3 attempts (not a different pair each time)
  is the "genuinely stuck" pattern from decision 020/doc 08's era — should
  get rarer. A halt where the reviewers' failing-standard set changes every
  attempt is the whack-a-mole pattern (orchestrator-panel.ts's own header
  comment) — the master-review arbitration step (`e95241a`) targets this
  specifically; watch whether halts still show it.

## Known gaps, not fixed here

- **Gemini truncates `global_assumptions_packet` at its 900-token
  first-pass budget** (new finding, this session) — same class of bug as
  (1), just on a first-pass call outside `REPAIR_TOKEN_HEADROOM`'s scope.
  Not fixed; flagged for a follow-up session.
- **No per-run cost/token telemetry.** This doc's evidence is manual
  (log cross-referencing + the existing monitor), not automated. Decision
  020 already named this as separate, not-yet-built work — still true.
- Real cost this session: on the order of a dozen n=2 real runs (`14n+54` ≈
  82 calls each) across today's testing — consistent with, not exceeding,
  the "run sparingly" guidance the app's own UI already surfaces.

## Addendum, 2026-08-12 (later same day) — pinned swarm/synthesis to DeepInfra-only

Samir's explicit call, verbatim: "it should always be using deep infra (no
matter what for now)." `swarmAttempts()`/`synthesisAttempts()`
([router-lanes.ts](../../../lib/ai/router-lanes.ts)) now return only
`TARGETS.deepinfra` — Groq, Gemini, Mistral, and Cerebras removed from both
lanes entirely, not reordered. Deliberate, temporary reduction in
resilience: a genuine DeepInfra outage now fails a swarm/synthesis call
outright instead of failing over. Two reasons (both Samir's, see the
in-code comment for the full statement): a clean read on DeepInfra's real
success rate on this traffic without another provider's failures
confounding it, and DeepInfra being a paid account with no hard
per-request ceiling the way Groq's on-demand tier has, so most of what the
chain protected against doesn't apply here by construction. Scope is
swarm/synthesis only — `suggestor`/`coach`/`critic`/`drafter` untouched.
`isGroqTokenLimitExceeded()`/`isGroqJsonValidateFailed()`/`groqCoolingDown()`
are unused BY THIS LANE now, left alone (other lanes still call them).

**Bug found and fixed while doing this:** `synthesisAttempts()`'s
non-repair (first-pass) branch never gave DeepInfra its own
`DEEPINFRA_SWARM_TIMEOUT_MS` — only the repair branch did. It fell through
to `ATTEMPT_TIMEOUT_MS.synthesis`'s 8s, sized for Groq's speed (Groq used
to lead synthesis). Harmless while DeepInfra was only ever synthesis's
*fallback* (an 8s DeepInfra attempt failing just advanced to Gemini
unnoticed); live-broken the moment DeepInfra became the *only* attempt,
since gpt-oss-20b's hidden-reasoning-token latency (the same reason
`DEEPINFRA_SWARM_TIMEOUT_MS` exists at all, see router-lanes.ts) routinely
exceeds 8s. Fixed: `synthesisAttempts()` now applies the same
`DEEPINFRA_SWARM_TIMEOUT_MS`/`DEEPINFRA_SWARM_LARGE_TIMEOUT_MS` split as
`swarmAttempts()`.

**Real-verification, one real (non-dry-run) n=2 run against
`/admin/reasoning`:**
- `/admin`'s AI Router Monitor: Swarm and Synthesis lanes now render as a
  single step, "Only target — no fallback (deliberate, temporary)" ·
  `deepinfra · openai/gpt-oss-20b`.
- Live traffic: `context-gather-pre` → `frame-generate` → `frame-review`
  (9/9 standards passed) → `context-gather-post` → `breadth-scoping` all
  succeeded, DeepInfra only. Target Health climbed to **31 OK / 3 FAIL, all
  on `deepinfra`** — Groq/Gemini/Mistral/Cerebras stayed at 0/0 the entire
  run, confirming zero fallback traffic reached them.
- **The 3 failures are the trade-off working as designed, not a new bug:**
  `perspectives-generate-details`'s evidence sub-call
  (`perspective_evidence`, which routes through
  `generateWithOptionalSearch`'s search rounds) hit DeepInfra timeouts
  twice in a row (`"Request timed out."`, ~95s each — the search-round
  chain's own deadline, not a hung request) and one `ai-empty-output`
  (`finishReason: "stop"`, no content). Every failure's log line names only
  `deepinfra` — no fallback was attempted, exactly as designed. The client
  surfaced a clean "Could not reach a stage of the pipeline" with a Retry
  affordance rather than hanging.
- **Known gap, not fixed here (flagged for Samir, not fixed per his "no
  matter what" instruction):** `perspective_evidence`/`global_evidence` —
  the two steps that go through `generateWithOptionalSearch`'s multi-round
  search chain — appear to be the ones most exposed by removing the
  fallback tail, since a slow or empty DeepInfra round now has nothing to
  fail over to. Worth watching `/admin/reasoning/runs` for whether this
  pattern (evidence steps specifically) recurs disproportionately now that
  swarm has no relief valve. **Root-caused and mostly fixed the same day —
  see [22-vercel-hobby-duration-and-stagger-fix.md](22-vercel-hobby-duration-and-stagger-fix.md)
  (the stagger/duration half) and
  [23-deepinfra-intermittent-reliability-and-same-target-retry.md](23-deepinfra-intermittent-reliability-and-same-target-retry.md)
  (DeepInfra's own intermittent reliability — confirmed via its dashboard,
  not a network/rate-limit issue — and the same-target-retry fix).**
