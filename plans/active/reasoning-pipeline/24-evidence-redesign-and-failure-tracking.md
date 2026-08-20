# 24 — Evidence redesign (strategy/populate/confidence split) and sub-element failure tracking

**Date:** 2026-08-13 · Branch: `reasoning-pipeline-deepinfra-tuning`, same
session as [20](20-deepinfra-tuning-real-verification.md) (DeepInfra-only
pinning), [22](22-vercel-hobby-duration-and-stagger-fix.md) (stagger/duration
fix), and [23](23-deepinfra-intermittent-reliability-and-same-target-retry.md)
(same-target retry). This doc is a follow-on to 23, not a fix for a new
failure — it's Samir's own scoping of a further mitigation plus two other
changes bundled into the same request:

> try the prompt change (it's already been implemented before though why not
> again), for evidence it is simple, the model should just decide whether to
> ask the user for more evidence, ask brave search, or do both. Assigning
> confidence levels should be for a seperate request / subagent. Another
> agent should take the evidence and basically fetch the data then input it
> into the JSON, there is no "avoid inventing citations" or "real vs
> hypothetical sourcing". We should be able to track where and when something
> failed in perspectives, so we need to know whether sub-questions, evidence,
> assumptions, or counterarguments failed (add that tracking mechanism)

Three independent pieces:

## 1. Prompt mitigation for unbounded reasoning

Doc 23 traced DeepInfra's intermittent failures to `gpt-oss-20b`'s own
Harmony-format reasoning behavior — sometimes the hidden reasoning phase
never reaches the `final` channel at all. `REASONING_PERSONA`
(prompts.ts) gained a new hard rule directed at exactly this:

> This task does not need extended internal deliberation — decide promptly
> and answer. Spending a long time reasoning before answering doesn't improve
> the result here and risks never producing an answer at all, which fails
> this step outright rather than just running slower.

A prompt instruction is a soft mitigation, not a fix — `reasoning_effort` is
already documented as a suggestion the model doesn't strictly honor (doc 20).
It's additive to 23's same-target retry, not a replacement for it.

## 2. Evidence generation: 1 call → 3 phases

Both per-perspective evidence and global (question-level) evidence were each
a single call doing three jobs at once: decide how to gather evidence,
actually gather it, and grade its own confidence. Split into three, each its
own call/subagent:

1. **Strategy** — decide `search_queries` (up to 3) and/or
   `needs_user_input` (with `questions_for_user`, reusing
   `ContextGatherQuestionSchema`). Nothing else — no evidence content, no
   confidence. Effort fixed at `medium`, never bumped to `high` even on
   repair — "deciding search-vs-ask is a simple call by design," there's no
   real content to revise.
2. **Populate** — "another agent... take the evidence and basically fetch
   the data then input it into the JSON" (Samir). Runs `runSearches`
   (search.ts) once per unit that asked for it, folds in the user's answer
   if strategy paused and they answered, and writes `claim_id`/`source_ref`/
   caveats **only from that real, already-fetched data**. `generateWithOptionalSearch`
   (the old multi-round search loop, up to `MAX_SEARCH_ROUNDS`=2 round-trips)
   is retired entirely — strategy decides search terms once, up front, so
   there's nothing left to iterate on.
3. **Confidence** — a separate call scores each populated item's confidence
   (low/medium/high), matched back by `claim_id`. Kept apart from populate
   per Samir's explicit scoping ("Assigning confidence levels should be for
   a seperate request / subagent") — one call is never simultaneously
   fetching evidence and grading its own find.

See [01](01-layers-and-standards.md) for where this sits in the layer
sequence, [02](02-data-contracts.md) for the intermediate contracts
(`EvidenceStrategy`, `EvidenceGatherUnit`, `EvidenceItemDraft`,
`PerspectivePartialBundle`), and [21](21-ai-call-mechanics-reference.md) for
the exact effort/maxTokens/function per call. Final shapes
(`PerspectiveBundle.evidence[]`, `GlobalEvidencePacket`) are unchanged — only
how they're populated changed.

**Epistemic hedging removed.** The old evidence prompt carried "avoid
inventing citations" / "real vs. hypothetical sourcing" language — necessary
when one call both decided *and* wrote evidence with no guarantee real
search ever ran. Populate now only ever works from real search results or a
real user answer, so that language no longer applies to anything the model
could actually do; it was removed rather than carried forward as dead
caution.

### The pause UX: a real pause, not a flag

One clarifying question needed answering before implementation: does
evidence-strategy's "ask the user" need to actually pause the run and wait
for an answer, the same way context-gather already does — or is it enough
to flag that more input would help, without blocking? Samir's answer: **a
real pause, like context-gather.** Consequences accepted going in: `STEP_ORDER` grows
(3 new client-visible steps for perspectives, 3 for global — see below), the
AI-call count per run increases (`generators` went `5n+9` → `7n+11`, see
[03](03-orchestration-and-failure-handling.md)), and every doc referencing
step counts or call-count formulas needed updating to match (this doc's own
purpose, in part).

Implementation mirrors context-gather's existing pattern exactly:
- `route.ts`'s `perspectives-evidence-strategy` case always computes
  `nextStep` as if advancing straight to `-populate`; it's the **client**
  that notices `perspectiveEvidenceGatherUnits`/`globalEvidenceGatherUnit` is
  non-empty and pauses instead of auto-advancing — same division of
  responsibility as `ContextGatherVerdict.needs_user_input`.
- `collectEvidenceGatherUnits` (orchestrator-perspectives.ts) aggregates
  however many of the `n` perspectives actually asked something into one
  client-visible pause, tagged by `unitId`/`unitLabel` — global evidence is
  always exactly one unit.
- `EvidenceGatherAnswerBox.tsx` (new component, sibling of
  `ContextGatherAnswerBox.tsx`) renders however many units paused, each with
  its own free-text question rows (evidence-strategy's questions don't carry
  quick-pick `options` the way context-gather's do — the strategy call is
  deliberately simple). `flattenEvidenceGatherAnswers` reassembles per-unit
  answers back into a per-perspective array for populate to consume.
- `ReasoningPipelinePage.tsx`'s step-loop effect gained the same
  needs-input check for `perspectives-evidence-strategy`/
  `global-evidence-strategy` that context-gather's pre/post checkpoints
  already had; `PendingEvidenceGather` is `PendingGather`'s sibling, minus
  the `'adhoc'` origin (evidence-strategy is only ever a fixed loop step,
  never admin-triggered ad hoc, so resolving always resumes the loop).
- **Dev-testing parity:** `devForceNeedsInput` (already wired to
  `runContextGather`'s `forceNeedsInput`, for exercising the pause UI in
  dry-run mode for free) was extended to both new strategy functions the
  same way — otherwise the new pause path would have had no free way to
  test at all. Forces every stance's dry-run strategy to ask, so the
  multi-unit aggregation can be verified too, not just the single-unit case.

### New step count and call-count model

`STEP_ORDER` grew from 17 to 22 steps: `perspectives-evidence-strategy` /
`-populate` / `-confidence` (replacing one `perspectives-evidence-generate`-
shaped slot with three) and the same for `global-evidence-*`.
`estimatePipelineCost` (budget.ts): `generators = 7n + 11` (was `5n + 9`),
`reviewers = 9n + 45` (unchanged — evidence still isn't independently
reviewed, just as part of the whole bundle/packet at `perspectives-review` /
`global-evidence-review`), `total = 16n + 56` (was `14n + 54`).

## 3. Sub-element failure tracking

Motivated directly by this session's own debugging pain (doc 23): Vercel
Hobby's 1-hour log retention made it hard to tell, after the fact, *which*
part of a perspectives failure actually happened — was it sub-questions,
assumptions, counterargument, or one of evidence's now-3 phases?

- `SubElementFailure { perspectiveId, stanceLabel, subElement, errorMessage }`
  and `PERSPECTIVE_SUB_ELEMENTS` (contracts.ts) name all 6 trackable
  sub-elements: `sub_questions`, `assumptions`, `counterargument`,
  `evidence_strategy`, `evidence_populate`, `evidence_confidence`.
- Every perspectives fan-out step now uses `Promise.allSettled` (via a new
  shared `fanOutTracked` helper, orchestrator-perspectives.ts) instead of
  `Promise.all`, so a failure in one perspective's one sub-element no longer
  masks what happened to every other perspective/sub-element in the same
  batch — all failures in the batch are collected, not just the first one
  thrown.
- `PerspectivesGenerateError` carries the full `SubElementFailure[]`; a new
  `perspectivesFanOutFailure(step, err)` helper in `route.ts` turns that into
  the error response's `subElementFailures` field, which the client already
  had UI for (added in an earlier sub-phase of this session,
  `ReasoningPipelinePage.tsx`'s `subElementFailures` state).

## Verification

`npx tsc --noEmit`, `npx eslint .` (0 errors — 28 pre-existing unrelated
warnings), `npx vitest run` (109/109, up from 97 before this phase) all
clean. A dry-run smoke test through the full 22-step flow in-browser (n=2,
`devForceNeedsInput` on) exercised both new pause types end-to-end: the
multi-unit perspectives pause (one answered, one skipped — both paths
render/resolve correctly, including the `→ answer` note in
`ReasoningStagesList`'s read-only display) and the single-unit global pause
(skipped), through to a completed `FinalAnswer` card with every reviewed gate
at 9/9. No console errors beyond an unrelated local-dev CSP warning
(Vercel Analytics' debug script, blocked by CSP — present regardless of this
change).

Real (non-dry-run) end-to-end verification against production, given the
size of this change (5 new/changed orchestrator functions, 2 new prompt
call-shapes, a new client pause path) and its real API cost at `16n+56` calls
per run, is a deliberate follow-up rather than done in this session — noted
here rather than run speculatively.
