// Client-safe contract for Draft Mode (POST /api/ai/draft; decision 016).
// Mirrors lib/ai/findings.ts: pure zod + types, no server imports, shared by the
// route and the builder UI.
//
// Draft Mode drafts MATERIALS, never the verdict: stages cover concepts →
// perspectives → evidence → assumptions → implications. There is deliberately no
// stage for conclusion/reasoning/question/purpose (invariant 1; 016 §1) — those
// stay human-written, and AiActionSchema cannot express them anyway.

import { z } from 'zod'
import { AiActionSchema, type AiAction } from './findings'

export const DRAFT_STAGES = [
  'concepts',
  'perspectives',
  'evidence',
  'assumptions',
  'implications',
] as const

export type DraftStage = (typeof DRAFT_STAGES)[number]

// Which AiAction kinds each stage may return. The route drops anything else
// server-side (same belt-and-suspenders as the suggest route's post-filter).
export const DRAFT_STAGE_KINDS: Record<DraftStage, readonly AiAction['kind'][]> = {
  concepts: ['add_concept'],
  perspectives: ['add_perspective', 'add_subquestion'],
  evidence: ['add_evidence'],
  assumptions: ['add_assumption'],
  implications: ['add_implication', 'add_watchpoint'],
}

// One stage call returns a batch of ordinary AiActions — the same vocabulary the
// co-pilot uses, so the reducer's applyAiAction path (and its provenance rules)
// applies unchanged. Empty is legal: the evidence stage returns no actions when
// the search results genuinely support nothing (never invent a source).
export const DraftResponseSchema = z.object({
  actions: z.array(AiActionSchema).max(12),
})
export type DraftResponse = z.infer<typeof DraftResponseSchema>

// Persisted on State.draft (houses.draft jsonb, migration 0022) for houses the
// AI drafted. null on every other house — the normal flow never sees Draft Mode.
export interface DraftState {
  // Origin marker: 'chat' when the house was started from House Chat
  // (/admin/chat, decision 017); 'reasoning-pipeline' when it was seeded by
  // the real house-scoped reasoning pipeline (plan doc 27, 2026-08-16) rather
  // than the interview+per-stage draft loop. Optional so pre-017 rows load
  // unchanged; it rides the existing houses.draft jsonb (every reducer
  // transition spreads state.draft), so no migration is needed. Not read
  // anywhere yet (same as 'chat' before it) — provenance only.
  via?: 'chat' | 'reasoning-pipeline'
  // Next stage the runner will request; 'done' once generation finished or the
  // user stopped early.
  stage: DraftStage | 'done'
  // Stages that actually inserted items (a stopped draft leaves the rest false).
  drafted: Record<DraftStage, boolean>
  // Per-layer review confirmations — the deferred accept of 016 §2.
  claimed: Record<DraftStage, boolean>
}

export function emptyDraft(): DraftState {
  const flags = () =>
    Object.fromEntries(DRAFT_STAGES.map((s) => [s, false])) as Record<DraftStage, boolean>
  return { stage: DRAFT_STAGES[0], drafted: flags(), claimed: flags() }
}

export function nextDraftStage(stage: DraftStage): DraftStage | 'done' {
  const i = DRAFT_STAGES.indexOf(stage)
  return i < DRAFT_STAGES.length - 1 ? DRAFT_STAGES[i + 1] : 'done'
}

// Drafted-but-unclaimed layers. Empty for non-drafted houses.
export function unclaimedDraftStages(draft: DraftState | null): DraftStage[] {
  if (!draft) return []
  return DRAFT_STAGES.filter((s) => draft.drafted[s] && !draft.claimed[s])
}

// While true, publish/export stay locked and House Strength renders as
// provisional (016 §2). The score itself is never altered (invariant 6).
export function draftGateLocked(draft: DraftState | null): boolean {
  if (!draft) return false
  return draft.stage !== 'done' || unclaimedDraftStages(draft).length > 0
}

// UI copy for the live build checklist — real progress, unlike the mini house's
// cosmetic timer (each label flips when its stage's items actually land).
export const DRAFT_STAGE_LABELS: Record<DraftStage, string> = {
  concepts: 'Pinning down the key concepts…',
  perspectives: 'Drafting perspectives and sub-questions…',
  evidence: 'Searching for real, cited evidence…',
  assumptions: 'Surfacing hidden assumptions…',
  implications: 'Mapping implications and watchpoints…',
}

// Which builder step (1–7) reviews each stage, for the claim banner. Note the
// map is not the identity: concepts live on the Frame step and implications
// come after the (human-only) Conclusion step.
export const DRAFT_STAGE_STEP: Record<DraftStage, number> = {
  concepts: 1,
  perspectives: 2,
  evidence: 3,
  assumptions: 4,
  implications: 6,
}

export function stageForStep(step: number): DraftStage | null {
  const hit = DRAFT_STAGES.find((s) => DRAFT_STAGE_STEP[s] === step)
  return hit ?? null
}
