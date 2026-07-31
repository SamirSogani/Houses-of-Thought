# 05 — Phase 1 status and next phases (handoff)

Written 2026-07-30 so a fresh session can pick this up without the
conversation that built it. **Everything below is uncommitted** — check
`git status`/`git diff` first; nothing here should be assumed already merged.

## What's actually done and real-verified

All 17 steps (`lib/ai/reasoning/steps.ts` `STEP_ORDER`) are wired end-to-end.
**Dry-run mode works fully** (free, zero API calls — confirms plumbing after
any change). **Real (non-dry-run) verification only reached the Frame layer**
— every real run so far hard-blocked at `frame-review` before perspectives,
global layers, conclusions, implications, or final-composition ever got a
real model call. That's the single biggest verification gap: **the pipeline
past Frame has never been exercised with real completeJSON calls.**

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

## Known open issue — where Frame-prompt tuning left off

`FRAME_BLOCK` in `lib/ai/reasoning/prompts.ts` has been through 3 real
iterations:
1. Original: produced verbose, padded `core_question` (e.g. added "specific
   institution," "all mandatory" to a clean question) — failed clarity/depth.
2. Fix: "restate concisely, don't pad if already clear" — fixed padding and
   depth (broader `scope_notes`), but over-corrected: pure verbatim
   preservation left decision-context (who/why) and loaded binary phrasing
   ("ban") unaddressed — failed clarity/logic instead.
3. Fix: keep `core_question` wording untouched even if loaded, but push "the
   full spectrum of options is in scope" into `scope_notes` and "who holds
   this decision" into `purpose` instead. **This fix has not been verified —
   provider rate-limiting blocked the real run before frame-review could be
   reached again.**

**Next step:** check provider health (below), then run a real n=2 pass at
`/admin/reasoning` with "Should our school ban homework?" and check whether
`frame-review` passes cleanly. If clarity/logic still fail, read the actual
reviewer notes (expand "Frame review" in the UI, or `preview_logs` /
server console for the `panel verdict` log line) before editing blind.

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
| `app/admin/reasoning/page.tsx` + `components/admin/reasoning/*` | UI |
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

## Phase 1.5 — next, cheapest and highest-value

1. **Bounded retries** (2 retries/3 attempts, per decision 019's
   orchestration design) for both generate and review steps, feeding the
   panel's failing-standard notes back as targeted context on retry. Today's
   session hit exactly the failures this would absorb automatically instead
   of surfacing a manual "Retry" click.
2. **Distinguish rate-limit failures from invalid-output failures** — the
   former needs a wait-then-retry (a same-instant retry won't help if the
   whole chain is exhausted, as seen today); the latter benefits from the
   existing "here's what was wrong, fix it" retry pattern.
3. **Finish the Frame prompt convergence** (see above).
4. **Audit other packet schemas' max-lengths** against what their prompts
   actually ask for — `ConclusionsPacketSchema`, `ImplicationsPacketSchema`,
   `GlobalAssumptionsPacketSchema`, `GlobalEvidencePacketSchema`,
   `PerspectiveBundleSchema` — using the same fix pattern as the
   `notes` field (raised 400→700).
5. **First real test of perspectives-generate onward** — never yet exercised
   with real model calls; only proven via dry run.

## Phase 2

1. Persist packets/verdicts (new table, or decide against once Phase 1.5's
   log volume shows whether it's actually needed).
2. Dynamic budget enforcement — shrink `n` / tighten retries under live
   pressure, directly motivated by today's real capacity limits.
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
