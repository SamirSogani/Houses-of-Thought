# 07 — Phase 1.5 continued: drafter stagger, schema audit, widened drafter lane, daily run cap (2026-07-31)

Written the same day as 06, picking up its "Updated next steps." **Code below
is committed; this doc records what was and wasn't real-verified** — check
`git log` if that ever seems stale.

## 1. Drafter stagger — shipped, NOT yet real-verified

`DRAFTER_STAGGER_MS` (150ms, matching `REVIEWER_STAGGER_MS`) added to
`lib/ai/reasoning/orchestrator-perspectives.ts`'s `runPerspectivesGenerateDetails`.
Previously all 4 sub-element calls × n bundles fired with zero stagger (4n
truly simultaneous drafter calls — the thing 06 identified as exhausting the
2-target lane at n=2). Now every call's start is delayed by a flattened
`(i*4+j) * 150ms` — bundle index AND sub-element index both count, not just
bundles, so the full 4n calls trickle rather than burst.

Verified: typecheck clean (via 05's documented throwaway-tsconfig workaround —
a concurrent `next dev` process in this directory again produced the same
stale `.next/types` error 05 flagged) and the existing 7-case
`orchestrator-perspectives.test.ts` suite passes unchanged. **Not
real-verified** — see below, the session's real test never reached this step.

## 2. Schema audit (06's item 2) — done, no changes needed

Audited `ConclusionsPacketSchema`, `ImplicationsPacketSchema`,
`GlobalAssumptionsPacketSchema`, `GlobalEvidencePacketSchema`,
`PerspectiveBundleSchema` (`contracts.ts`) against what their prompts
(`prompts.ts`) actually ask for, using the pattern the two real bugs so far
share: a single string field asked to hold **multiple distinct sub-parts**
(`scope_notes`: practical/social/economic/procedural + spectrum note +
out-of-scope, all in one field) or to **quote-plus-reason** in one cramped
cap (`SingleStandardVerdictSchema.notes`).

None of the five schemas' fields fit that shape — every field here is either
array-bounded with short items (`question_level_assumptions`,
`supporting_chain`, `conclusions`, evidence items' `claim_id`/`source_ref`) or
explicitly asked for 1-2 sentences (`cross_perspective_notes`). No cap
changes made. This is a desk audit, not live-exercised — if real testing at
these layers ever produces a truncation-shaped failure, revisit; don't
preemptively widen caps with no evidence, same reasoning 05/06 used for the
two caps that DID need it.

## 3. Real-test attempt — blocked earlier than last time

Checked `/admin` before spending anything: both drafter targets still showed
06's session-old `RATE-LIMITED` status (~29m stale). A fresh "Run live check"
probe showed Gemini still genuinely rate-limited but **Cerebras recovered to
UP** — enough headroom to justify a real attempt.

Ran a real n=2 pipeline, same question as 06 ("Should our school ban
homework?") for continuity. Frame-generate converged faster than 06's
original run (6/9 → 8/9 passed, vs. 06's 4/9 → 6/9 → 9/9) — interesting but
inconclusive at n=1, could be the accumulated prompt tuning paying off or
could be noise.

**Before frame's second regeneration finished, the drafter lane went down
again**: Gemini still 429, and — new this session — **Cerebras started
returning `ERROR · empty-output`** (a distinct failure mode from the 429s
seen so far; 9 ok / 29 fail on the admin monitor). Both drafter targets down
simultaneously exhausted all 3 transport retries and surfaced the manual
Retry/New-question UI, exactly as designed. This happened at frame-generate,
**before ever reaching `perspectives-generate-details`** — so the stagger fix
above remains real-unverified; this session hit the capacity ceiling even
earlier in the pipeline than 06 did.

No deeper diagnostic available: `lib/log.ts` writes only to console, and the
`next dev` process in this directory belongs to a different chat session —
its stdout isn't accessible here, so the raw-content diagnostic (05's bug #2)
couldn't be inspected this time.

**Decision: stopped rather than burning more quota.** The drafter lane has
shown no real headroom for most of today's testing (Gemini's 429 predates
this session entirely). Chasing it further without evidence of recovery just
spends quota to relearn what's already known.

## 4. Drafter lane widened to Mistral + Groq — shipped, real-test blocked differently

Samir pointed out the drafter lane didn't have to be just Gemini/Cerebras —
Mistral and Groq were healthy all session and already back the other two
lanes. `lib/ai/router.ts`'s `attemptsForRole('drafter')` was hardcoded to
exactly `[geminiFlash, cerebrasGptOss120b]`, unlike `suggestorAttempts()` /
`realtimeAttempts()`'s full 4-target chains. Added `draftAttempts()`
following the same pattern (Mistral after Cerebras, then Groq with the
existing cooldown/penalty-box handling) — this is a **shared router.ts
change**, so it affects every `role: 'drafter'` caller app-wide (Draft Mode,
`/api/ai/research`, mini-house, strawman, chat-conclusions), not just the
reasoning pipeline. `router-monitor.ts`'s `buildLanes()` is a separate
hardcoded source of truth for the admin display and needed the identical
update — confirmed via the browser (`/admin` now shows all 4 targets in the
drafter lane). Two `router.test.ts` cases that pinned the old 2-target shape
were updated to exercise the full chain; typecheck + full suite (71 tests)
pass. Committed separately from the stagger fix.

Retried the real n=2 run immediately after, expecting the wider lane to
finally get past frame. Instead hit a **different, hard stop on the very
first step**: `enforceReasoningRunLimit()` (`lib/ai/limits.ts`) — this app's
own `ADMIN_REASONING_DAILY_RUN_CAP = 8`, a deliberate per-day cap on real
reasoning-pipeline run-starts (incremented once per "Run pipeline" click,
independent of and separate from any AI provider's own quota). Cumulative
real runs today (06's session + this session's 3 attempts) had already
crossed 8 — the UI correctly showed "The co-pilot is resting — daily limit
reached. It resets tomorrow," failing before any AI call was even made. This
is working as designed, not a bug — don't try to raise or bypass the cap to
force a test through.

## Updated next steps

1. **Real-verify both the stagger fix and the widened drafter lane** at
   `perspectives-generate-details` — blocked for the rest of today (2026-07-31)
   by `ADMIN_REASONING_DAILY_RUN_CAP`, not by provider health. Resume tomorrow;
   check `/admin`'s live probe for provider health first, but the run-count
   cap is now the binding constraint, not Gemini/Cerebras specifically.
2. If Cerebras's `empty-output` failure mode (item 3, above) recurs, look
   closer — check whether `completeJSON`'s raw-content diagnostic logging
   (`lib/ai/router.ts`, 05's bug #2) actually captures it, this time from a
   session where the dev server's own stdout is reachable.
3. Schema audit is DONE — don't re-open unless real testing at
   perspectives-review/global/conclusions/implications produces an actual
   truncation failure.
4. Phase 2 proper (05's breakdown: persist packets/verdicts, dynamic budget
   enforcement, A/B the review panel) still blocked behind a full real run
   of perspectives-review onward — unchanged from 06.
