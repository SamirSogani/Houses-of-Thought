// Client-safe contract for GET/POST /api/houses/[id]/console — the
// post-pipeline console (plan doc
// plans/active/reasoning-pipeline/28-post-pipeline-console.md, migration
// 0040). Whole-house sibling of lib/ai/layerFeedback.ts's per-layer
// contract: same click-to-accept posture, but scoped to the entire house and
// able to propose BOTH add_* and remove_* actions (findings.ts), plus —
// unlike layer-feedback — a rerun proposal when the correction implies an
// earlier pipeline stage needs to be redone, not just one item swapped.
//
// This module is also the console family's PUBLIC SURFACE. Each phase built
// on top of doc 28 got its own module once the combined file passed the
// repo's ~600-line guideline — chats (doc 29), loops (doc 30), sandbox
// (doc 31) — and they are re-exported below so every existing
// `from '@/lib/ai/console'` import keeps working unchanged. The split is by
// plan doc, which is how this surface actually accreted; see each module's
// own header. Nothing here imports those modules for anything but the one
// type ConsoleTurn needs, so the re-export cannot become a cycle.

import { z } from 'zod'
import { AiActionSchema } from './findings'
import { DRAFT_STAGES, type DraftStage } from './draft'
import type { StepId } from './reasoning/steps'
import type { ReviseCritique } from './console-loops'

export const RerunProposalSchema = z.object({
  stage: z.enum(DRAFT_STAGES),
  // Plain-language "why" shown to the person before they confirm — never
  // executed from this alone (invariant 2: nothing changes without a click).
  reason: z.string().min(1).max(300),
  // Fed into the pipeline's own regeneration channels (masterReview and/or
  // consoleGuidance, RunStateSchema) once confirmed — see the plan doc for
  // which stages use which channel.
  guidance: z.string().min(1).max(1000),
})
export type RerunProposal = z.infer<typeof RerunProposalSchema>

export const ConsoleResponseSchema = z.object({
  answer: z.string().min(1).max(800),
  // Wider than layer-feedback's max(4) — a whole-house correction can
  // legitimately need a remove + an add together, sometimes across more than
  // one layer in a single reply.
  actions: z.array(AiActionSchema).max(6),
  rerunProposal: RerunProposalSchema.nullable(),
})
export type ConsoleResponse = z.infer<typeof ConsoleResponseSchema>

export interface ConsoleTurn {
  id: string
  // 'system' added by migration 0041 for doc 30's Loop B rerun-completion
  // marker — Phase 2 is the first thing that actually writes one (see
  // rerunMarkerMessage below). ConsoleTranscript renders it as a plain
  // centered note.
  role: 'user' | 'assistant' | 'system'
  message: string
  actions: z.infer<typeof AiActionSchema>[] | null
  rerunProposal: RerunProposal | null
  createdAt: string
  // Loop A, bounded revise (migration 0042) — null/0 on every ordinary turn;
  // set only on a row written by app/api/houses/[id]/console/revise/route.ts.
  // revisesMessageId is the turn THIS one replaces (chain link, walked by
  // groupRevisionChains below); revisionIteration is this lineage's attempt
  // number (0 = not a revision, 1-3 = MAX_REVISE_ITERATIONS' worth of
  // revises); critique is the critic-role verdict that produced this
  // specific row, stored so "shown on expand" has something real behind it.
  revisesMessageId: string | null
  revisionIteration: number
  critique: ReviseCritique | null
}

// Where a confirmed rerun resumes the pipeline's own step dispatcher, and
// whether that stage has the masterReview guidance channel (see plan doc
// 28's table — perspectives has none; every other stage does). Both are
// always fed run.consoleGuidance regardless (RunStateSchema); masterReview
// additionally gives the ONE stage actually being corrected the more precise
// "here's your prior output, revise it per this" framing.
export interface RerunStageInfo {
  resumeStep: StepId
  masterReviewStep: StepId | null
}

export const RERUN_STAGE_INFO: Record<DraftStage, RerunStageInfo> = {
  concepts: { resumeStep: 'frame-generate', masterReviewStep: 'frame-review' },
  perspectives: { resumeStep: 'perspectives-generate-stances', masterReviewStep: null },
  assumptions: { resumeStep: 'global-assumptions-generate', masterReviewStep: 'global-assumptions-review' },
  evidence: { resumeStep: 'global-evidence-strategy', masterReviewStep: 'global-evidence-review' },
  implications: { resumeStep: 'implications-generate', masterReviewStep: 'implications-review' },
}

// The pipeline's OWN internal generation order — NOT the house UI's layer
// order (DRAFT_STAGE_STEP: concepts/perspectives/evidence/assumptions/
// implications). Evidence is house-step 3 and assumptions is house-step 4,
// but internally global-assumptions-generate runs BEFORE
// global-evidence-strategy (steps.ts's STEP_ORDER) — a rerun's cascade must
// follow this order, or "rerun evidence" would wrongly appear to also touch
// assumptions (which actually comes before it, not after).
export const RERUN_STAGE_ORDER: readonly DraftStage[] = ['concepts', 'perspectives', 'assumptions', 'evidence', 'implications']

// Every stage from fromStage onward, in true pipeline order — what a
// confirmed rerun actually regenerates (cascade, plan doc 28's second
// confirmed decision), and so what the confirmation UI shows as "will be
// reset" before the person agrees.
export function cascadeStages(fromStage: DraftStage): DraftStage[] {
  const i = RERUN_STAGE_ORDER.indexOf(fromStage)
  return i === -1 ? [fromStage] : RERUN_STAGE_ORDER.slice(i)
}

// ── Public surface: the per-phase modules, re-exported (see header) ───────
export * from './console-shared'
export * from './console-chats'
export * from './console-loops'
export * from './console-sandbox'
