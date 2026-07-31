// Server-only orchestration for the reasoning pipeline's setup layers:
// context-gather (both fixed checkpoints), frame, and breadth-scoping. None of
// these fan out; frame is the only one of the three with a review panel
// (decisions/019 — scoping agents deliberately have no panel, keeping the
// reviewer count at exactly 9n+45).

import { completeJSON } from '@/lib/ai/router'
import {
  ContextGatherVerdictSchema,
  type ContextGatherVerdict,
  FramePacketSchema,
  type FramePacket,
  BreadthScopingPacketSchema,
  type BreadthScopingPacket,
  type ReviewPanelVerdict,
} from './contracts'
import {
  REASONING_PERSONA,
  CONTEXT_GATHER_BLOCK,
  FRAME_BLOCK,
  BREADTH_SCOPING_BLOCK,
  serializeFrame,
} from './prompts'
import { runReviewPanel } from './orchestrator-panel'
import { clampN } from './budget'

if (typeof window !== 'undefined') {
  throw new Error('lib/ai/reasoning/orchestrator-setup.ts is server-only and must not run in the browser')
}

export async function runContextGather(context: string, dryRun: boolean): Promise<ContextGatherVerdict> {
  if (dryRun) {
    return { needs_user_input: false, questions_for_user: [], reason: '[dry run] proceeding without asking.' }
  }
  return completeJSON({
    role: 'coach',
    system: `${REASONING_PERSONA}\n\n${CONTEXT_GATHER_BLOCK}`,
    user: context,
    schema: ContextGatherVerdictSchema,
    schemaName: 'context_gather_verdict',
    effort: 'low',
    maxTokens: 400,
  })
}

const FrameModelSchema = FramePacketSchema.omit({ original_query: true })

export async function runFrameGenerate(originalQuery: string, dryRun: boolean): Promise<FramePacket> {
  if (dryRun) {
    return {
      original_query: originalQuery,
      core_question: originalQuery,
      definitions: [{ term: '[dry run] term', definition: '[dry run] definition' }],
      purpose: '[dry run] purpose',
      scope_notes: '[dry run] scope notes',
    }
  }
  const modelOut = await completeJSON({
    role: 'drafter',
    system: `${REASONING_PERSONA}\n\n${FRAME_BLOCK}`,
    user: `Original question: ${originalQuery}`,
    schema: FrameModelSchema,
    schemaName: 'frame_packet',
    effort: 'high',
    maxTokens: 1200,
  })
  return { ...modelOut, original_query: originalQuery }
}

export async function runFrameReview(frame: FramePacket, dryRun: boolean): Promise<ReviewPanelVerdict> {
  return runReviewPanel(
    frame.core_question,
    'frame-review',
    frame,
    `Original question: ${frame.original_query}`,
    dryRun
  )
}

function fitLabelsToN(labels: string[], n: number): string[] {
  if (labels.length >= n) return labels.slice(0, n)
  const padded = [...labels]
  while (padded.length < n) padded.push(`Additional perspective ${padded.length + 1}`)
  return padded
}

// capN is the admin's pre-run cost cap (clamped to MAX_N_PHASE1) — a ceiling,
// not a target. The model may still propose fewer if it thinks fewer suffice.
export async function runBreadthScoping(
  frame: FramePacket,
  capN: number,
  dryRun: boolean
): Promise<BreadthScopingPacket> {
  if (dryRun) {
    const n = clampN(Math.min(2, capN))
    return {
      n,
      rationale: '[dry run] fixed perspective count.',
      candidate_viewpoint_labels: fitLabelsToN(['[dry run] Perspective A', '[dry run] Perspective B'], n),
    }
  }
  const modelOut = await completeJSON({
    role: 'coach',
    system: `${REASONING_PERSONA}\n\n${BREADTH_SCOPING_BLOCK}`,
    user: serializeFrame(frame),
    schema: BreadthScopingPacketSchema,
    schemaName: 'breadth_scoping_packet',
    effort: 'low',
    maxTokens: 500,
  })
  const n = clampN(Math.min(modelOut.n, capN))
  return { ...modelOut, n, candidate_viewpoint_labels: fitLabelsToN(modelOut.candidate_viewpoint_labels, n) }
}
