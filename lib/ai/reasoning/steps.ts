// Client-safe step sequence for the reasoning pipeline (decision 019). Every
// layer with a review panel decomposes into two client-driven steps
// (`{layer}-generate`, `{layer}-review`) because chaining generate-then-review
// in one request would sum their worst-case completeJSON latencies past the
// route's 30s budget — see decisions/019 and the Phase 1 plan for why. A layer
// without a panel is one step.
//
// Perspectives generation is itself split into two further steps for the SAME
// reason: within a bundle, the 4 sub-elements need the stance's own generated
// text as input (01-layers-and-standards.md), so stance generation (round 1,
// n parallel calls) must finish before sub-element generation (round 2, 4n
// parallel calls) starts — chaining both rounds in one request risks the same
// budget overrun as generate+review. 17 steps total. Summing calls per step at
// n=3 still reproduces the architecture doc's `14n+54` exactly (96) — this
// split changes round-trip granularity, not the total call count.
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
  'perspectives-review',
  'global-assumptions-generate',
  'global-assumptions-review',
  'global-evidence-generate',
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
  'perspectives-generate-details': 'Drafting sub-questions, assumptions, evidence, and counterarguments…',
  'perspectives-review': 'Review panel checking each perspective…',
  'global-assumptions-generate': 'Surfacing question-level assumptions…',
  'global-assumptions-review': 'Review panel checking global assumptions…',
  'global-evidence-generate': 'Gathering question-level evidence…',
  'global-evidence-review': 'Review panel checking global evidence…',
  'conclusions-generate': 'Drawing conclusions…',
  'conclusions-review': 'Review panel checking the conclusions…',
  'implications-generate': 'Mapping implications…',
  'implications-review': 'Review panel checking the implications…',
  'final-composition': 'Composing the final answer…',
}

// Groups the 17 steps into the UI's top-level rows (ReasoningStagesList).
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
  { id: 'perspectives', label: 'Perspectives', stepIds: ['perspectives-generate-stances', 'perspectives-generate-details', 'perspectives-review'], hasPanel: true },
  { id: 'global-assumptions', label: 'Global assumptions', stepIds: ['global-assumptions-generate', 'global-assumptions-review'], hasPanel: true },
  { id: 'global-evidence', label: 'Global evidence', stepIds: ['global-evidence-generate', 'global-evidence-review'], hasPanel: true },
  { id: 'conclusions', label: 'Conclusions', stepIds: ['conclusions-generate', 'conclusions-review'], hasPanel: true },
  { id: 'implications', label: 'Implications', stepIds: ['implications-generate', 'implications-review'], hasPanel: true },
  { id: 'final-composition', label: 'Final composition', stepIds: ['final-composition'], hasPanel: false },
]

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
