// Client-safe step sequence for the reasoning pipeline (decision 019). Every
// layer with a review panel decomposes into two client-driven steps
// (`{layer}-generate`, `{layer}-review`) because chaining generate-then-review
// in one request would sum their worst-case completeJSON latencies past the
// route's budget — see decisions/019 and the Phase 1 plan for why. A layer
// without a panel is one step.
//
// Perspectives generation is itself split into further steps for the SAME
// reason: within a bundle, sub-elements need the stance's own generated text
// as input (01-layers-and-standards.md), so stance generation (round 1, n
// parallel calls) must finish before the rest starts — chaining rounds in one
// request risks the same budget overrun as generate+review.
//
// Evidence (perspective-level AND global) is itself 3 further steps as of
// 2026-08-13 (Samir) — strategy (decide search/ask-user) → populate (write
// items from what came back) → confidence (score what populate wrote) — each
// a genuinely separate call needing the previous one's real output, same
// reasoning as every other split above. strategy's needs_user_input can pause
// the run exactly like context-gather-pre/post do (see
// EvidenceGatherUnit/PendingGather) before populate ever runs.
//
// Mirrors lib/ai/draft.ts's DRAFT_STAGES / nextDraftStage / DRAFT_STAGE_LABELS
// pattern, one level more granular.

export const STEP_ORDER = [
  'context-gather-pre',
  'frame-generate',
  'frame-review',
  'context-gather-post',
  'breadth-scoping',
  'perspectives-generate-stances',
  'perspectives-generate-details',
  'perspectives-evidence-strategy',
  'perspectives-evidence-populate',
  'perspectives-evidence-confidence',
  'perspectives-review',
  'global-assumptions-generate',
  'global-assumptions-review',
  'global-evidence-strategy',
  'global-evidence-populate',
  'global-evidence-confidence',
  'global-evidence-review',
  'conclusions-generate',
  'conclusions-review',
  'implications-generate',
  'implications-review',
  'final-composition',
] as const

export type StepId = (typeof STEP_ORDER)[number]

export function nextStep(step: StepId): StepId | null {
  const i = STEP_ORDER.indexOf(step)
  return i < STEP_ORDER.length - 1 ? STEP_ORDER[i + 1] : null
}

export function isReviewStep(step: StepId): boolean {
  return step.endsWith('-review')
}

// The 6 steps that actually gate through a 9-standard review panel — narrower
// than StepId so lib/ai/reasoning/standards.ts's per-layer criteria matrix can
// be typed for full compile-time completeness (every gate × every standard
// must have an entry; a missing one is a type error, not a silent gap).
export const REVIEW_GATE_STEPS = [
  'frame-review',
  'perspectives-review',
  'global-assumptions-review',
  'global-evidence-review',
  'conclusions-review',
  'implications-review',
] as const
export type ReviewGateStep = (typeof REVIEW_GATE_STEPS)[number]

// Live-checklist copy, present-progressive tone matching DRAFT_STAGE_LABELS.
export const STEP_LABELS: Record<StepId, string> = {
  'context-gather-pre': 'Checking whether the question is ready to reason about…',
  'frame-generate': 'Framing the core question…',
  'frame-review': 'Review panel checking the frame…',
  'context-gather-post': 'Confirming the frame is complete…',
  'breadth-scoping': 'Deciding how many perspectives to explore…',
  'perspectives-generate-stances': 'Staking out independent perspectives…',
  'perspectives-generate-details': 'Drafting sub-questions, assumptions, and counterarguments…',
  'perspectives-evidence-strategy': 'Deciding how to gather evidence for each perspective…',
  'perspectives-evidence-populate': 'Writing evidence from real search results…',
  'perspectives-evidence-confidence': 'Rating each evidence item’s confidence…',
  'perspectives-review': 'Review panel checking each perspective…',
  'global-assumptions-generate': 'Surfacing question-level assumptions…',
  'global-assumptions-review': 'Review panel checking global assumptions…',
  'global-evidence-strategy': 'Deciding how to gather question-level evidence…',
  'global-evidence-populate': 'Writing question-level evidence from real search results…',
  'global-evidence-confidence': 'Rating each question-level evidence item’s confidence…',
  'global-evidence-review': 'Review panel checking global evidence…',
  'conclusions-generate': 'Drawing conclusions…',
  'conclusions-review': 'Review panel checking the conclusions…',
  'implications-generate': 'Mapping implications…',
  'implications-review': 'Review panel checking the implications…',
  'final-composition': 'Composing the final answer…',
}

// Groups the steps into the UI's top-level rows (ReasoningStagesList).
export interface LayerGroup {
  id: string
  label: string
  stepIds: readonly StepId[]
  hasPanel: boolean
}

export const LAYER_GROUPS: readonly LayerGroup[] = [
  { id: 'context-gather-pre', label: 'Context check', stepIds: ['context-gather-pre'], hasPanel: false },
  { id: 'frame', label: 'Frame', stepIds: ['frame-generate', 'frame-review'], hasPanel: true },
  { id: 'context-gather-post', label: 'Context check', stepIds: ['context-gather-post'], hasPanel: false },
  { id: 'breadth-scoping', label: 'Breadth scoping', stepIds: ['breadth-scoping'], hasPanel: false },
  {
    id: 'perspectives',
    label: 'Perspectives',
    stepIds: [
      'perspectives-generate-stances',
      'perspectives-generate-details',
      'perspectives-evidence-strategy',
      'perspectives-evidence-populate',
      'perspectives-evidence-confidence',
      'perspectives-review',
    ],
    hasPanel: true,
  },
  { id: 'global-assumptions', label: 'Global assumptions', stepIds: ['global-assumptions-generate', 'global-assumptions-review'], hasPanel: true },
  {
    id: 'global-evidence',
    label: 'Global evidence',
    stepIds: ['global-evidence-strategy', 'global-evidence-populate', 'global-evidence-confidence', 'global-evidence-review'],
    hasPanel: true,
  },
  { id: 'conclusions', label: 'Conclusions', stepIds: ['conclusions-generate', 'conclusions-review'], hasPanel: true },
  { id: 'implications', label: 'Implications', stepIds: ['implications-generate', 'implications-review'], hasPanel: true },
  { id: 'final-composition', label: 'Final composition', stepIds: ['final-composition'], hasPanel: false },
]

// Express Mode (decision TBD): a streamlined 7-step variant of the pipeline —
// generators only, no review panels, no evidence gathering, no
// context-gather pauses. Added alongside STEP_ORDER; existing thorough-mode
// callers are untouched.
export type PipelineMode = 'thorough' | 'express'

export const EXPRESS_STEP_ORDER = [
  'frame-generate',
  'breadth-scoping',
  'perspectives-generate-stances',
  'perspectives-generate-details',
  'conclusions-generate',
  'implications-generate',
  'final-composition',
] as const

export type ExpressStepId = (typeof EXPRESS_STEP_ORDER)[number]

export const EXPRESS_STEP_LABELS: Record<ExpressStepId, string> = {
  'frame-generate': 'Framing the core question…',
  'breadth-scoping': 'Deciding how many perspectives to explore…',
  'perspectives-generate-stances': 'Staking out independent perspectives…',
  'perspectives-generate-details': 'Drafting sub-questions, assumptions, and counterarguments…',
  'conclusions-generate': 'Drawing conclusions…',
  'implications-generate': 'Mapping implications…',
  'final-composition': 'Composing the final answer…',
}

export const EXPRESS_LAYER_GROUPS: readonly LayerGroup[] = [
  { id: 'frame', label: 'Frame', stepIds: ['frame-generate'], hasPanel: false },
  { id: 'breadth-scoping', label: 'Breadth scoping', stepIds: ['breadth-scoping'], hasPanel: false },
  { id: 'perspectives', label: 'Perspectives', stepIds: ['perspectives-generate-stances', 'perspectives-generate-details'], hasPanel: false },
  { id: 'conclusions', label: 'Conclusions', stepIds: ['conclusions-generate'], hasPanel: false },
  { id: 'implications', label: 'Implications', stepIds: ['implications-generate'], hasPanel: false },
  { id: 'final-composition', label: 'Final composition', stepIds: ['final-composition'], hasPanel: false },
]

export function stepOrderForMode(mode: PipelineMode): readonly StepId[] {
  return mode === 'express' ? EXPRESS_STEP_ORDER : STEP_ORDER
}

export function nextStepForMode(step: StepId, mode: PipelineMode): StepId | null {
  const order = stepOrderForMode(mode)
  const i = order.indexOf(step)
  if (i === -1 || i >= order.length - 1) return null
  return order[i + 1] as StepId
}

export function layerGroupsForMode(mode: PipelineMode): readonly LayerGroup[] {
  return mode === 'express' ? EXPRESS_LAYER_GROUPS : LAYER_GROUPS
}

export function stepLabelsForMode(mode: PipelineMode): Record<string, string> {
  return mode === 'express' ? EXPRESS_STEP_LABELS : STEP_LABELS
}

export type StepFailureMode = 'hard-block' | 'degrade'

// Which review-gated steps hard-block-and-halt vs. degrade-and-continue on a
// failed panel verdict (03-orchestration-and-failure-handling.md). The
// architecture doc's own assumption #5 names "frame, breadth-scoping, or
// either global layer" as hard-block by the rationale "single point of
// failure the whole pipeline depends on, no redundancy" — it doesn't
// separately name conclusions/implications, but the same rationale applies to
// them identically (single agent, no redundancy, downstream layers depend on
// them), so they're included here too. Only perspectives — the one layer with
// real redundancy (the other bundles) — degrades per-unit instead.
export const STEP_FAILURE_MODE: Partial<Record<StepId, StepFailureMode>> = {
  'frame-review': 'hard-block',
  'perspectives-review': 'degrade',
  'global-assumptions-review': 'hard-block',
  'global-evidence-review': 'hard-block',
  'conclusions-review': 'hard-block',
  'implications-review': 'hard-block',
}
