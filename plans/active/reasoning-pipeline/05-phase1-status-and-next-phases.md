# 05 — Phase 1 status and next phases (handoff)

Written 2026-07-30 so a fresh session can pick this up without the
conversation that built it. **Everything below is uncommitted** — check
`git status`/`git diff` first; nothing here should be assumed already merged.
**Phase 1.5's bounded retries (below) shipped and were real-verified
2026-07-31 — see
[06-phase1.5-bounded-retries.md](06-phase1.5-bounded-retries.md) for that
session's full findings** (the Frame prompt convergence story, 2 more real
bugs fixed, and real verification reaching past Frame for the first time).
This file is kept as the Phase-1-build historical record; 06 is now the
current-status doc.

## What's actually done and real-verified

All 17 steps (`lib/ai/reasoning/steps.ts` `STEP_ORDER`) are wired end-to-end.
**Dry-run mode works fully** (free, zero API calls — confirms plumbing after
any change). Real (non-dry-run) verification reached only the Frame layer as
of 2026-07-30 — see 06 for why that changed the next day.

Two real bugs were found and fixed live:
1. `SingleStandardVerdictSchema.notes` was capped at 400 chars; the reviewer
   prompt asked for cited, substantive reasoning that routinely ran longer.
   Fixed: cap raised to 700 (`lib/ai/reasoning/contracts.ts`), prompt given an
   explicit length target (`lib/ai/reasoning/prompts.ts` `buildReviewerPrompt`).
2. `completeJSON` (`lib/ai/router.ts`) had no visibility into what a model
   actually returned on `ai-invalid-output` — added a diagnostic `log.error`
   with the raw content on final failure. This is a shared file; the change
   is additive-only (no behavior change), but be aware other sessions may be
   using it too.

Built ahead of the original schedule: `LAYER_STANDARD_CRITERIA` in
`lib/ai/reasoning/standards.ts` — a 54-entry (9 standards × 6 reviewed gates)
matrix giving each standard a criterion specific to what that layer's
artifact actually is, replacing one generic definition reused everywhere.
Verified live producing genuinely differentiated, substantive review notes
(e.g. Frame's "depth" now asks how many considerations were named, not
whether the framing argues anything).

Reverted: an early attempt to round-robin the review panel's 9 calls across
three provider-diverse roles (`critic`/`suggestor`/`drafter`), on the theory
that concurrent same-provider load was the cause of the invalid-output bug.
That theory was wrong (see bug #1 above), and live provider data later showed
the round-robin was actively routing calls into providers that happened to be
saturated that day. Reverted to `role: 'critic'` for all 9 calls, relying on
its own 4-provider failover chain instead. **Don't reintroduce cross-role
spreading without new evidence it's needed.**

## Frame-prompt tuning — resolved 2026-07-31

`FRAME_BLOCK` in `lib/ai/reasoning/prompts.ts` went through 3 iterations in
this doc's original writing (padding → over-corrected verbatim-preservation →
push spectrum/purpose out of `core_question`). Fix #3's real verification was
blocked at the time by provider capacity (a live-check probe passing doesn't
mean the next real completeJSON call succeeds — the drafter lane has very
little real spare capacity). **Resolved the next day — see
[06](06-phase1.5-bounded-retries.md#real-verified-live-2026-07-31--the-frame-prompt-convergence-story)
for the full story**: fix #3 doesn't pass cleanly alone, but Phase 1.5's new
regeneration loop converges it in 2 more rounds, and the actual winning fix
was narrower than expected (disambiguating "our" → "a K-12 school", not
abandoning the binary "ban" wording fix #3 deliberately kept).

## Before spending any real API calls

Check `http://localhost:3000/admin` (AI Router Monitor) target health first.
If Gemini or Cerebras show `RATE-LIMITED` or `ERROR`, real `drafter`-role
calls (frame-generate, perspective generators, global layers, conclusions,
implications) have nowhere to fail over to and will fail — wait, or use dry
run (always safe, zero cost) to verify structural changes instead.

## File map

| File | What it is |
|---|---|
| `lib/ai/reasoning/contracts.ts` | Packet zod schemas |
| `lib/ai/reasoning/steps.ts` | `STEP_ORDER`, `ReviewGateStep`, `STEP_FAILURE_MODE` |
| `lib/ai/reasoning/standards.ts` | 9 standards + `LAYER_STANDARD_CRITERIA` |
| `lib/ai/reasoning/prompts.ts` | All prompt blocks, incl. `FRAME_BLOCK` (mid-iteration) |
| `lib/ai/reasoning/budget.ts` | Cost model, `MAX_N_PHASE1 = 3` |
| `lib/ai/reasoning/orchestrator-{panel,setup,perspectives,global}.ts` | Server-only execution |
| `app/api/admin/reasoning/route.ts` | The 17-step dispatcher |
| `app/admin/reasoning/page.tsx` + `components/admin/reasoning/*` | UI; `ReasoningPipelinePage.tsx` now retries `ai-rate-limited` automatically (Phase 1.5 #2) |
| `lib/ai/limits.ts` | Added `ADMIN_REASONING_DAILY_RUN_CAP` + `enforceReasoningRunLimit` |
| `lib/ai/router.ts` | Added raw-content diagnostic logging (shared file, additive-only) |

## Verification workflow for a fresh session

1. `git status`/`git diff` — confirm what's actually applied.
2. Check provider health at `/admin` before any real (non-dry-run) test.
3. Typecheck: `./node_modules/.bin/tsc --noEmit` may pick up a stale
   `.next/types` cache from a concurrent `next dev` process in this same
   directory (`ps aux | grep next-server` to check). If so, typecheck against
   a throwaway tsconfig instead: `{"extends": "./tsconfig.json", "include":
   ["next-env.d.ts", "**/*.ts", "**/*.tsx"], "exclude": ["node_modules",
   ".next"]}` — delete it after.
4. Dry run first (free) after any change, then real n=2 if provider health
   allows.

## Phase 1.5 — status

All shipped and real-verified 2026-07-31 — see
[06](06-phase1.5-bounded-retries.md) for the full build (both the
transport-level and verdict-driven retry halves) and live-verification
results:

1. ~~Bounded retries (generate + review)~~ — DONE.
2. ~~Distinguish rate-limit vs. invalid-output failures~~ — DONE.
3. ~~Finish the Frame prompt convergence~~ — DONE (resolved, see above).
4. **Remaining:** audit other packet schemas' max-lengths
   (`ConclusionsPacketSchema`, `ImplicationsPacketSchema`,
   `GlobalAssumptionsPacketSchema`, `GlobalEvidencePacketSchema`,
   `PerspectiveBundleSchema`) — not yet real-exercised, so not yet confirmed
   necessary the way `scope_notes`/`notes` were.
5. **Remaining:** first real test of perspectives-review onward — reached
   for the first time 2026-07-31 but paused on a real rate-limit; see 06's
   "Updated next steps."

## Phase 2

1. ~~Persist packets/verdicts~~ — DONE (built, unit-tested, dry-run
   verified), not yet real-verified live (migration needs applying first) —
   see [15](15-persistence.md).
2. ~~Dynamic budget enforcement~~ — DONE, real-verified 2026-08-02, see
   [14](14-dynamic-budget-enforcement.md) (including a real residual gap it
   surfaced: Cerebras can still produce invalid JSON under sufficiently
   severe simultaneous multi-provider stress).
3. A/B the review panel (panels on vs. auto-pass) — decision 019 verification
   stage 3, confirms the 9-reviewer cost is earning better answers.

## Phase 3

1. Ad-hoc context-gather at arbitrary layer boundaries — a real UX feature
   (pause pipeline, ask the user, resume). Note: even the two *fixed*
   checkpoints don't currently act on `needs_user_input` today — the client
   always proceeds regardless of what context-gather says. Worth fixing as
   part of this phase, not before.
2. Precise per-call cost metering (`increment_ai_usage_by` + migration).
3. Product decision: attach to `/admin/chat`? Resolve decision 017's "the
   chat never answers directly" tension (decision 019's Deferred/open).
4. Load-test large `n` (verification stage 5) — only once everything above is
   solid at small `n`.
