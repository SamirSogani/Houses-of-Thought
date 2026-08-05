# 18 — Context-gather actually acts on `needs_user_input` (Phase 3 item 1)

Built 2026-08-04, following [17](17-panels-off-runs-browser-indicator.md)
(Phase 2 item 3's follow-up). Resolves [05](05-phase1-status-and-next-phases.md)'s
Phase 3 item 1: "even the two *fixed* checkpoints don't currently act on
`needs_user_input` today — the client always proceeds regardless of what
context-gather says."

**Code below is committed** — check `git log` if that ever seems stale.
**Real-verified 2026-08-04, same day** — see
[19](19-context-gather-real-verification.md) for the full evidence.

## Design (confirmed with Samir before implementing)

Four decisions, confirmed via explicit question rounds before any code:

1. **Scope: the larger "arbitrary layer boundary" shape, not just the two
   fixed checkpoints.** Recommended starting narrow (matching doc 05's exact
   named gap); Samir chose the README's target architecture instead — "any
   layer can trigger 'ask the user something' mid-pipeline." Resolved as
   **admin-triggered, ad-hoc** rather than automatic-at-every-boundary (the
   item's own name in doc 05, "*Ad-hoc* context-gather at arbitrary layer
   boundaries," pointed there directly, and it was confirmed explicitly): an
   "Ask a clarifying question" control appears whenever the pipeline is
   paused, firing one context-gather call scoped to whatever's accumulated so
   far, at whatever step the admin happens to be sitting on. Zero extra quota
   cost unless actually clicked. The two fixed checkpoints (context-gather-pre,
   context-gather-post) still fire automatically as before — this adds a
   third, manual way to reach the same underlying mechanism at any other
   point, not a replacement.
2. **Structured multiple-choice questions, mirroring this app's own
   AskUserQuestion UX** — up to 3 model-proposed options per question, plus an
   always-available free-text "Other" fallback. A real contract change:
   `questions_for_user` went from `string[]` to
   `{ question: string; options: string[] (≤3) }[]`.
3. **Answers actually re-contextualize generation, not just get logged for
   audit** — confirmed over "storage only." The mechanism is asymmetric by
   design, not uniform:
   - `context-gather-pre`'s answers fold into `frame-generate`'s prompt only
     (one new `userAnswers` param, same shape as `appendRegenerationFeedback`'s
     existing prior-artifact-plus-feedback pattern). The frame then carries
     that context forward automatically — everything downstream already reads
     the frame via `serializeFrame`, so pre-answers are never re-threaded a
     second time.
   - `context-gather-post`'s and every ad-hoc call's answers append into
     `serializeFrame`'s output (`extraContext`, a new optional 2nd param) —
     because by that point the frame is already generated and reviewed, so
     there is no "regenerate frame" step for an answer to converge through.
     `serializeFrame` is the one choke point nearly every downstream
     generate/review call already goes through, which is what makes this
     reach the whole rest of the run instead of needing a bespoke hook per
     layer.
4. **Skippable, not mandatory** — confirmed, matching the existing "search
   enriches, never substitutes" philosophy already in `runContextGather`
   (orchestrator-setup.ts). The admin can Skip any question box without
   answering; a run never deadlocks waiting on an answer.

A fifth item (a dev-only way to force a synthetic `needs_user_input: true` for
free UI testing, since dryRun's own branch always returned `false`) wasn't put
to a vote — it's additive, dev-only, zero risk, so it was just built.

## What's built

**Contracts** (`lib/ai/reasoning/contracts.ts`):
`ContextGatherQuestionSchema` (`question` + `options`, ≤3 each);
`ContextGatherVerdictSchema.questions_for_user` now an array of these instead
of plain strings; new `ContextGatherAnswersSchema` (`(string | null)[]`, ≤3 —
`null` means skipped); new `AdHocContextGatherSchema`
(`{ atStep, verdict, answers }`) for the ad-hoc list.

**Prompts** (`lib/ai/reasoning/prompts.ts`): `CONTEXT_GATHER_BLOCK` now asks
for `options` per question ("leave options empty if the question is too
open-ended for a short pick-list to make sense" — confirmed live, see 19);
`serializeFrame` gained the `extraContext` param; new
`formatContextGatherAnswers()` folds a resolved verdict + its answers into one
text block, shared by both the pre→frame-generate path and the
post/ad-hoc→extraContext path.

**Orchestration**: `runContextGather` (orchestrator-setup.ts) gained
`forceNeedsInput` (dev-testing only, dryRun-gated) and now extracts
`.question` from the new object shape before calling `runSearches`.
`runFrameGenerate` gained `userAnswers`. `extraContext` threaded as a new
trailing optional param through every function in orchestrator-setup.ts,
orchestrator-perspectives.ts, and orchestrator-global.ts that already calls
`serializeFrame`/`questionContext` (12 functions) — mechanical, one line each,
matching how `panelsOff` was threaded through the same surface in
[16](16-ab-review-panel.md).

**Route** (`app/api/admin/reasoning/route.ts`): `RunStateSchema` gained
`contextGatherPreAnswers`, `contextGatherPostAnswers`, `adHocContextGathers`
(no migration needed — these live inside the existing JSONB `run_state` blob,
per [15](15-persistence.md)'s "single blob" design). `RequestSchema.step` is
now a union of `STEP_ORDER` and the literal `'context-gather-adhoc'` —
deliberately **not** added to `STEP_ORDER` itself, since it has no fixed
linear position and must never flow through `nextStepAfter()`'s
indexOf-based advance logic. The ad-hoc branch is handled before the main
switch (shares error handling, not `ok()`/`retryStep()`/`halted()`'s
nextStep semantics — there is no "next step" for an aside). Two new helpers:
`buildExtraContext()` (folds post + every ad-hoc answer into one block) and
`buildAdHocContext()` (what an ad-hoc call sees — whatever's accumulated so
far, richest-available first, plus which step the admin paused at).

**New component** (`components/admin/reasoning/ContextGatherAnswerBox.tsx`):
the interactive question box — option buttons + an "Other…" free-text
fallback per question, Submit/Skip. Used **only** by
`ReasoningPipelinePage.tsx`. Deliberately never imported by
`ReasoningStagesList.tsx` — a past, already-`done` run has no one left to
answer, so `ReasoningStagesList.tsx`'s `ContextGatherNote` stays read-only for
both the live page and the historical `/admin/reasoning/runs` browser, and now
additionally renders each question's given answer as plain text
(`→ answer`) when present, plus a new read-only "Ad-hoc questions" section for
`adHocContextGathers`.

**Client state machine** (`ReasoningPipelinePage.tsx`): new `Phase` value
`'awaiting-input'`, distinct from `'paused'` (admin clicked Pause) and
`'halted'` (exhausted retries). New `PendingGather` tracks the verdict
currently awaiting a response plus where to resume: a fixed checkpoint
(`origin: 'pre' | 'post'`) resumes the step loop at `resumeStep` once
resolved; an ad-hoc ask (`origin: 'adhoc'`) returns to `'paused'` instead —
the admin resumes separately, since they paused for their own reason, not
because of this question. `askClarifyingQuestion()` is a one-off fetch outside
the main step-loop effect, available whenever `phase === 'paused'`.

## Phase 3 checklist

Item 1 (this doc) is done. See [05](05-phase1-status-and-next-phases.md) for
items 2-4.
