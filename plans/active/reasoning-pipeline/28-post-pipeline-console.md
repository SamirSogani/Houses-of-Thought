# 28 — Post-pipeline console

Samir's ask (2026-08-19): once the inline reasoning pipeline (plan doc 27)
finishes on a house, there should be a place — "maybe a continue button which
opens up a new window with the full reasoning pipeline" — that works like a
chatbot: ask it a question about the house, or tell it something's wrong, and
it answers. It can also propose edits (not just additions) to the house, and
can re-run pipeline stages if the conversation implies something upstream
needs to change — only after the person agrees.

Two decisions confirmed with Samir before building (both "recommended"
options):
- **Edits are click-to-accept, not silent writes.** Same invariant every
  other AI surface in this app already follows. Extends the existing
  `AiAction` vocabulary (`lib/ai/findings.ts`) with `remove_*` counterparts to
  every `add_*` kind, rather than inventing a parallel free-form edit
  vocabulary — "revise the house" becomes "propose removing the wrong item +
  propose adding the corrected one," both individually click-to-accept,
  reusing the existing add-action machinery entirely.
- **A confirmed rerun cascades** — reruns the requested stage and every stage
  after it (matches how the pipeline actually depends on its own upstream
  output), with a preview of exactly which claimed/edited layers would be
  reset before the person confirms.

This is additional to, not a replacement for, the per-layer thread from plan
doc 27's follow-up work (`LayerFeedbackThread`/`house_layer_feedback`,
2026-08-18) — that stays for quick in-context questions on one layer; this is
a whole-house surface entered deliberately once a pipeline run is done.

## Architecture

**"New window" = a dedicated route** (`/build/[id]/console`), not a literal
OS popup — normal web-app navigation, gets its own URL/back-button/reload
behavior, which matters for a page meant to be revisited.

**Reuses the pipeline's own step dispatcher for reruns — no new
orchestration engine.** `app/api/houses/[id]/reasoning/route.ts`'s existing
step machine already has a "regenerate this step given guidance" channel
(`run.masterReview: { forStep, guidance }`), used today only for
review-panel-driven regeneration. Nothing in the orchestrator layer cares
where the guidance text came from — feeding it a chat-derived string instead
of a panel verdict works identically. Confirmed live in the route code which
stages have this channel wired today:

| House stage | Resume step | masterReview channel? |
|---|---|---|
| concepts | `frame-generate` | yes (`forStep: 'frame-review'`) |
| perspectives | `perspectives-generate-stances` | **no** — no per-bundle review-driven regen path exists |
| assumptions | `global-assumptions-generate` | yes (`forStep: 'global-assumptions-review'`) |
| evidence | `global-evidence-strategy` | yes, all 3 sub-steps (`forStep: 'global-evidence-review'`) |
| implications | `implications-generate` | yes (`forStep: 'implications-review'`) |

Perspectives has no masterReview hook — extending `orchestrator-perspectives.ts`
and duplicating that extension across both route.ts files (they're
deliberately kept independent, plan doc 27) is real pipeline-orchestration
surface, not wiring. Instead: **a new `run.consoleGuidance: string | null`
field**, folded into `buildExtraContext()` (`route-schema.ts`) alongside
`contextGatherPost`/`adHocContextGathers` — that function's output already
threads into every downstream generate call across the whole pipeline,
`perspectives-generate-stances` included. One small, additive change to a
file both routes already share (schemas/pure-helpers only, per that file's
own header comment), not a change to either route's dispatch logic. For the
four stages with a masterReview channel, the console sets both: masterReview
for the precise "here's your prior output, revise it per this" framing on
the one stage being corrected, consoleGuidance so the correction stays live
through the rest of the cascade (masterReview.forStep only matches once).

**Cascade is automatic, not special-cased.** `nextStep()` (`steps.ts`) is a
flat linear walk with no "already done, skip" branching — resuming the
dispatcher at any step and letting it run to `final-composition` regenerates
everything after it by construction, using whatever `run` state it's handed
at each point.

**Client loop**: extends `useReasoningPipelineRunner` with a `rerunFrom()`
entry point alongside `start()` — both just seed the hook's existing
step/run/phase state differently before handing off to the SAME effect loop
(retry/regeneration/gather-handling all reused, not duplicated).

**Run state comes from `reasoning_runs`** (already persisted per-house since
migration 0038), loaded via a new `GET` on
`app/api/houses/[id]/reasoning/route.ts` (same auth gate as its `POST`) —
the console page can't rely on in-memory pipeline state surviving a real
navigation to a new route.

## New surfaces

- `house_console_messages` (migration 0041) — whole-house chat transcript,
  same shape/RLS posture as `house_layer_feedback` (0039), grant included in
  the same migration this time (0039 shipped without it, fixed in a
  same-day follow-up — folding the lesson in up front here).
- `app/api/houses/[id]/console/route.ts` — GET transcript, POST a turn
  (message → answer + proposed `AiAction[]` + optional `rerunProposal:
  { stage, reason, guidance }`). New `console` AiRole/lane (DeepInfra-first,
  same shape as `feedback`'s lane — whole-house context is bigger than one
  layer's, so it gets `feedback`'s original numbers, not suggestor's
  post-real-verification 45s/55s/60s ones, sized generously from the start
  instead of repeating that same discovery).
- `AiActionSchema` (`lib/ai/findings.ts`): 9 new `remove_*` kinds, one per
  existing `add_*` kind. `applyAiAction`/`aiActionApplicable`
  (`lib/build/aiActions.ts`) gain matching cases — same name/text-match +
  splice semantics the reducer's own manual `REMOVE_*` actions already use.
- `/build/[id]/console` — the page. Chat transcript, proposed-action chips
  (reused pattern from `LayerFeedbackThread`), a rerun-confirmation view
  (which stages/claims would reset) before any rerun actually starts, and
  `ReasoningStagesList` (reused from the admin surface) for live progress
  while a rerun runs.
- Entry point: once `state.draft?.via === 'reasoning-pipeline'` and the
  pipeline is done, a "Continue in full console" affordance appears (near
  `ReasoningPipelineCard`/`CopilotPanel`).

## Deliberately out of scope for v1

- Direct/silent edits (decided against above).
- Rerunning "conclusions" as a directly-selectable stage — it's not a house
  `DraftStage` (the AI never drafts the conclusion itself); it still
  regenerates naturally as part of an evidence/assumptions rerun's cascade,
  which also refreshes the one-click "use as my conclusion" suggestion.
- Real-time collaborative viewing of the console (no presence/multi-viewer
  concerns — same single-owner assumption as the rest of Draft Mode).
