# 08 — Phase 1.5: the real root cause, and a halt-never-fires bug (2026-08-01)

Written the day after 07, continuing the same real-testing arc. **Everything
below is committed** — check `git log` if that ever seems stale. This doc
supersedes 07 for current status.

## 1. The real root cause: reasoning_effort starving output

Three providers (Mistral, Cerebras, Groq/qwen, Groq/gpt-oss-20b) each showed
what looked like separate malformed-output bugs across 07 and this session's
early testing. They were the same bug: drafter-role calls pass `effort:
'high'`, and `reasoningEffortFor` (router-shared.ts) passed that straight
through to gpt-oss/qwen reasoning models unchanged — unlike Gemini, which
already capped it. Confirmed live: `high` reasoning can consume a call's
*entire* `maxTokens` budget on internal reasoning before emitting any answer
content, surfacing on Groq as `json_validate_failed` with an **empty**
`failed_generation`.

Fix: gpt-oss now always gets `'low'` (its floor — the family only accepts
`low`/`high`), qwen always gets `'none'` (its floor — `none`/`default`),
regardless of requested effort. Real-verified: a full run afterward showed
**zero** empty-output failures anywhere.

## 2. Comprehensive upstream-failure diagnostics

`callProvider` (router.ts) now logs full request context — provider, model,
schemaName, effort, resolved reasoning_effort, useJsonSchema, maxTokens — on
**any** upstream failure, not just completeJSON's post-retry give-up. This is
what let #1 and #3 get root-caused with real data instead of guessing from a
500-char raw-content preview.

## 3. Groq's json_validate_failed: real but not empty, and now cascadable

After #1 shipped, `json_validate_failed` recurred — but this time with a
**fully populated** `failed_generation`: coherent, on-topic, complete-looking
JSON that just never got a closing quote on its last string, or was missing
one required field. Verified via `python3 -c json.loads(...)`: genuinely
malformed, not a truncation artifact. This is Groq's own strict
`json_schema` decoding failing on its own generation — not a bad request
from us — yet it was being thrown as an immediate terminal error (`execute()`'s
generic 400-is-terminal rule), the one failure mode with zero retry path
(not even completeJSON's own single self-correction retry, since a thrown
400 never reaches that layer).

Added `isGroqJsonValidateFailed` (router-shared.ts): status 400 + the
`json_validate_failed` code text, checked *before* the generic 400 rule,
cascades to the next provider like `ai-empty-output` already does.
Real-verified: the same run that hit this twice during Frame regeneration
cascaded past both cleanly — Frame still reached 9/9 and the pipeline kept
going, where previously either occurrence alone would have killed the run.

## 4. Two more schema caps raised on real evidence

Same pattern as every prior cap fix this project — a reviewer or generator
producing genuinely substantive, on-task content that exceeds a cap sized
before real traffic existed:

- `SingleStandardVerdictSchema.notes`: 700 → 1000 chars. Perspectives-review
  produces the densest artifact any reviewer sees; a detailed accuracy
  critique failed completeJSON's self-correction retry twice at 700.
- `PerspectiveBundleSchema.counterargument.target_claims`/`rebuttals`: max
  array length 6 → 8, matching `key_claims`' own precedent (target_claims is
  literally drawn from key_claims, so shouldn't be capped tighter than its
  source). Real traffic showed the model routinely rebutting more than 6
  claims despite the prompt's own "1-6" instruction.

Perspectives' `maxTokens` were also raised across all 5 calls (stances 700→
1000; subquestions/assumptions/evidence/counterargument 500-700→1100-1800)
for headroom now that reasoning_effort isn't competing with output for the
same budget.

## 5. Drafter stagger widened 150ms → 20s

`DRAFTER_STAGGER_MS` (orchestrator-perspectives.ts) existed to avoid
*simultaneous* 429s, but real testing found Groq's actual constraint is an
account-level **8000 tokens/minute** cap on gpt-oss-20b, charged against
*requested* `max_tokens` regardless of how much is consumed — confirmed via
Groq's own error: `"Limit 8000, Used 7434, Requested 1521"`. This step's 4
sub-calls request ~5700 tokens/bundle; at n=2 that's ~11400 requested tokens
for 8 calls, well over one minute's budget if fired close together.

20s between each flattened call spreads n=2's 8 calls across ~140s (~60% of
the cap, real margin since actual response latency adds further gaps the
math doesn't count) — and scales proportionally for n=3, keeping the
effective rate roughly constant regardless of n. Deliberately slow: **per
Samir, decision 019's whole premise is a better answer, not a fast one —
reliably finishing in minutes beats finishing fast and failing.**
`orchestrator-perspectives.test.ts` was rewritten to use
`vi.useFakeTimers()`/`vi.runAllTimersAsync()` so test speed stays decoupled
from this constant.

## 6. The halt-never-fires bug — the most important fix this session

Also found while real-verifying #5: **every hard-block layer's
3-attempt halt safety net was silently non-functional.**
`ReasoningPipelinePage.tsx`'s `layerAttemptRef` reset to 1 on *any*
non-retry response — including a `*-generate` step's own response, which is
never itself `retry: true` even mid-regeneration-loop. Every retry that
looped back through generate silently wiped the count, so the paired review
step always saw `attempt=1` sent from the client, `attempt < MAX_REGENERATION_ATTEMPTS`
always held, and a layer whose content genuinely never improves would
regenerate **forever** instead of halting after 3 real attempts.

Frame's real convergence record never surfaced this — it always happened to
genuinely pass before the (broken) cap would matter. Global assumptions did:
reached for the first time this session (a new milestone in its own right —
see below), it never converged, and the log showed **20+ real
`global-assumptions-review` panel-verdict calls** before the run was
manually paused. That's real quota burned on an unbounded loop, not a
one-off — worth flagging plainly.

Fixed by only resetting on a **completed review step**
(`isReviewStep`, steps.ts) passing — never on a generate step's own
response. Real-verified immediately after, cheaply: the very next run had
Frame itself fail to converge, and it correctly **halted after exactly 3
real attempts** (3 panel-verdict log entries, confirmed, not 20+).

No React test infra exists in this repo (no `.test.tsx` precedent) — this
client-side fix is typecheck + live-verified only, consistent with this
repo's existing posture on route-handler testing (05/06 already noted this
gap for route.ts).

## Real-verification milestones this session

In order, each a first: perspectives-generate-details completing with real
content (previously always blocked by rate-limits or malformed output) →
perspectives-review producing real per-standard verdicts → both bundles
degrading gracefully after exhausting retries (the designed
degrade-not-crash path, working) → global assumptions reached (new
territory, immediately surfaced the halt bug above) → Frame reaching a
genuine, cleanly-halted non-convergence after the fix, proving it correctly.

**Not yet real-verified**: a full run reaching `global-evidence`,
`conclusions`, `implications`, or `final-composition`. Global assumptions'
own near-total review failure (7-9 of 9 standards failing across ~20 real
attempts, never improving) is itself worth a closer look once reached again
— unclear yet whether that's a genuine `GLOBAL_ASSUMPTIONS_BLOCK` prompt/
criteria problem (a Frame-Logic/Accuracy-shaped issue) or an artifact of
something else; no real evidence yet either way.

## Updated next steps

1. **Real-verify past global assumptions** — first full run since the halt
   fix landed. Check `/admin` for provider health first (Gemini in
   particular has been unreliable all session; Groq/Cerebras have been the
   working pair).
2. If global assumptions keeps failing hard (not just failing to halt, but
   genuinely never passing), look at `LAYER_STANDARD_CRITERIA['global-assumptions-review']`
   and `GLOBAL_ASSUMPTIONS_BLOCK` (prompts.ts) the way Frame's Logic/Accuracy
   contradiction was diagnosed in 07 — don't assume it's the same fix, look
   at the actual failing-standard notes first.
3. Once a run reaches `final-composition` for real, Phase 2 proper (05's
   breakdown: persist packets/verdicts, dynamic budget enforcement, A/B the
   review panel) is finally unblocked.
