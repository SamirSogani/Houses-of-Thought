// Server-only orchestration for the reasoning pipeline's global layers and
// final composition: global assumptions/evidence (question-level, informed by
// all perspectives but scoped to none), conclusions, implications, and
// packaging into the FinalAnswer. All five reviewed layers here hard-block on
// a failed panel (lib/ai/reasoning/steps.ts STEP_FAILURE_MODE) — none has the
// redundancy the Perspectives layer has.

import { completeJSON } from '@/lib/ai/router'
import {
  type FramePacket,
  type PerspectiveBundle,
  GlobalAssumptionsPacketSchema,
  type GlobalAssumptionsPacket,
  GlobalEvidencePacketSchema,
  type GlobalEvidencePacket,
  ConclusionsPacketSchema,
  type ConclusionsPacket,
  ImplicationsPacketSchema,
  type ImplicationsPacket,
  FinalAnswerSchema,
  type FinalAnswer,
  type ReviewPanelVerdict,
} from './contracts'
import {
  REASONING_PERSONA,
  GLOBAL_ASSUMPTIONS_BLOCK,
  GLOBAL_EVIDENCE_BLOCK,
  CONCLUSIONS_BLOCK,
  IMPLICATIONS_BLOCK,
  FINAL_COMPOSITION_BLOCK,
  serializeFrame,
  serializePerspectives,
  appendRegenerationFeedback,
} from './prompts'

// Shared shape for "regenerate this after a failed panel verdict" across the
// four hard-block global/conclusions/implications generators below.
interface Repair<T> {
  priorArtifact: T
  priorVerdict: ReviewPanelVerdict
}
import { runReviewPanel } from './orchestrator-panel'

if (typeof window !== 'undefined') {
  throw new Error('lib/ai/reasoning/orchestrator-global.ts is server-only and must not run in the browser')
}

function questionContext(frame: FramePacket, bundles: PerspectiveBundle[]): string {
  return `${serializeFrame(frame)}\n\n## Vetted perspectives\n${serializePerspectives(bundles)}`
}

export async function runGlobalAssumptionsGenerate(
  frame: FramePacket,
  bundles: PerspectiveBundle[],
  dryRun: boolean,
  repair?: Repair<GlobalAssumptionsPacket>
): Promise<GlobalAssumptionsPacket> {
  if (dryRun) {
    return {
      question_level_assumptions: ['[dry run] question-level assumption.'],
      cross_perspective_notes: '[dry run] cross-perspective note.',
    }
  }
  return completeJSON({
    role: 'drafter',
    system: `${REASONING_PERSONA}\n\n${GLOBAL_ASSUMPTIONS_BLOCK}`,
    user: appendRegenerationFeedback(questionContext(frame, bundles), repair),
    schema: GlobalAssumptionsPacketSchema,
    schemaName: 'global_assumptions_packet',
    effort: 'high',
    maxTokens: 900,
  })
}

export async function runGlobalAssumptionsReview(
  frame: FramePacket,
  bundles: PerspectiveBundle[],
  packet: GlobalAssumptionsPacket,
  dryRun: boolean
): Promise<ReviewPanelVerdict> {
  return runReviewPanel(frame.core_question, 'global-assumptions-review', packet, questionContext(frame, bundles), dryRun)
}

export async function runGlobalEvidenceGenerate(
  frame: FramePacket,
  bundles: PerspectiveBundle[],
  dryRun: boolean,
  repair?: Repair<GlobalEvidencePacket>
): Promise<GlobalEvidencePacket> {
  if (dryRun) {
    return { question_level_evidence: [{ claim_id: '[dry run] claim', source_ref: '[dry run] source', confidence: 'low' }] }
  }
  return completeJSON({
    role: 'drafter',
    system: `${REASONING_PERSONA}\n\n${GLOBAL_EVIDENCE_BLOCK}`,
    user: appendRegenerationFeedback(questionContext(frame, bundles), repair),
    schema: GlobalEvidencePacketSchema,
    schemaName: 'global_evidence_packet',
    effort: 'high',
    maxTokens: 900,
  })
}

export async function runGlobalEvidenceReview(
  frame: FramePacket,
  packet: GlobalEvidencePacket,
  dryRun: boolean
): Promise<ReviewPanelVerdict> {
  return runReviewPanel(frame.core_question, 'global-evidence-review', packet, serializeFrame(frame), dryRun)
}

export async function runConclusionsGenerate(
  frame: FramePacket,
  bundles: PerspectiveBundle[],
  globalAssumptions: GlobalAssumptionsPacket,
  globalEvidence: GlobalEvidencePacket,
  dryRun: boolean,
  repair?: Repair<ConclusionsPacket>
): Promise<ConclusionsPacket> {
  if (dryRun) return { conclusions: ['[dry run] conclusion.'], supporting_chain: ['[dry run] supporting step.'] }
  const context = `${questionContext(frame, bundles)}\n\n## Global assumptions\n${globalAssumptions.question_level_assumptions.map((a) => `- ${a}`).join('\n')}\n\n## Global evidence\n${globalEvidence.question_level_evidence.map((e) => `- ${e.claim_id} (${e.source_ref}, ${e.confidence})`).join('\n')}`
  return completeJSON({
    role: 'drafter',
    system: `${REASONING_PERSONA}\n\n${CONCLUSIONS_BLOCK}`,
    user: appendRegenerationFeedback(context, repair),
    schema: ConclusionsPacketSchema,
    schemaName: 'conclusions_packet',
    effort: 'high',
    maxTokens: 900,
  })
}

export async function runConclusionsReview(
  frame: FramePacket,
  packet: ConclusionsPacket,
  dryRun: boolean
): Promise<ReviewPanelVerdict> {
  return runReviewPanel(frame.core_question, 'conclusions-review', packet, serializeFrame(frame), dryRun)
}

export async function runImplicationsGenerate(
  frame: FramePacket,
  conclusions: ConclusionsPacket,
  degradedNotes: string[],
  dryRun: boolean,
  repair?: Repair<ImplicationsPacket>
): Promise<ImplicationsPacket> {
  if (dryRun) {
    return {
      implications: [
        { ikind: 'pos', text: '[dry run] implication.', horizon: 'Near-term', who: '[dry run] who' },
        { ikind: 'neg', text: '[dry run] implication.', horizon: 'Long-term', who: '[dry run] who' },
      ],
      confidence: 'medium',
      caveats_from_degraded_layers: degradedNotes,
    }
  }
  const context = `${serializeFrame(frame)}\n\n## Conclusions\n${conclusions.conclusions.map((c) => `- ${c}`).join('\n')}\n\n## Supporting chain\n${conclusions.supporting_chain.map((s) => `- ${s}`).join('\n')}${degradedNotes.length ? `\n\n## Degraded upstream layers\n${degradedNotes.map((d) => `- ${d}`).join('\n')}` : ''}`
  return completeJSON({
    role: 'drafter',
    system: `${REASONING_PERSONA}\n\n${IMPLICATIONS_BLOCK}`,
    user: appendRegenerationFeedback(context, repair),
    schema: ImplicationsPacketSchema,
    schemaName: 'implications_packet',
    effort: 'high',
    maxTokens: 900,
  })
}

export async function runImplicationsReview(
  frame: FramePacket,
  packet: ImplicationsPacket,
  dryRun: boolean
): Promise<ReviewPanelVerdict> {
  return runReviewPanel(frame.core_question, 'implications-review', packet, serializeFrame(frame), dryRun)
}

export async function runFinalComposition(
  frame: FramePacket,
  implications: ImplicationsPacket,
  dryRun: boolean
): Promise<FinalAnswer> {
  if (dryRun) {
    return {
      core_question: frame.core_question,
      answer: '[dry run] composed answer.',
      caveats: implications.caveats_from_degraded_layers,
    }
  }
  const context = `${serializeFrame(frame)}\n\n## Implications\n${implications.implications.map((i) => `- (${i.ikind}) ${i.text} — ${i.who}, ${i.horizon}`).join('\n')}\n\nConfidence: ${implications.confidence}${implications.caveats_from_degraded_layers.length ? `\nDegraded upstream: ${implications.caveats_from_degraded_layers.join('; ')}` : ''}`
  return completeJSON({
    role: 'coach',
    system: `${REASONING_PERSONA}\n\n${FINAL_COMPOSITION_BLOCK}`,
    user: context,
    schema: FinalAnswerSchema,
    schemaName: 'final_answer',
    effort: 'low',
    maxTokens: 1200,
  })
}
