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
  type MasterReviewGuidance,
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
  appendMasterGuidance,
} from './prompts'
import { REPAIR_TOKEN_HEADROOM } from './budget'

// Shared shape for "regenerate this after a failed panel verdict" across the
// four hard-block global/conclusions/implications generators below.
interface Repair<T> {
  priorArtifact: T
  priorVerdict: ReviewPanelVerdict
}

// Shared shape for the ONE extra attempt a hard-block layer earns after
// exhausting MAX_REGENERATION_ATTEMPTS still failing (route.ts's master-
// review escalation) — takes priority over Repair<T>'s raw per-standard notes
// when present (the two are never both set on the same call).
interface MasterGuided<T> {
  priorArtifact: T
  guidance: MasterReviewGuidance
}
import { runReviewPanel } from './orchestrator-panel'
import { generateWithOptionalSearch } from './search'

if (typeof window !== 'undefined') {
  throw new Error('lib/ai/reasoning/orchestrator-global.ts is server-only and must not run in the browser')
}

// extraContext (Phase 3 item 1, decision 019): context-gather-post's + any
// ad-hoc calls' answers so far, pre-formatted by route.ts's
// buildExtraContext. Threaded through every function in this file that builds
// a context string, so an answer re-contextualizes everything downstream of
// wherever it was given, not just the very next call.
export function questionContext(frame: FramePacket, bundles: PerspectiveBundle[], extraContext?: string | null): string {
  return `${serializeFrame(frame, extraContext)}\n\n## Vetted perspectives\n${serializePerspectives(bundles)}`
}

export async function runGlobalAssumptionsGenerate(
  frame: FramePacket,
  bundles: PerspectiveBundle[],
  dryRun: boolean,
  repair?: Repair<GlobalAssumptionsPacket>,
  extraContext?: string | null,
  masterGuidance?: MasterGuided<GlobalAssumptionsPacket>
): Promise<GlobalAssumptionsPacket> {
  if (dryRun) {
    return {
      question_level_assumptions: ['[dry run] question-level assumption.'],
      cross_perspective_notes: '[dry run] cross-perspective note.',
    }
  }
  const context = questionContext(frame, bundles, extraContext)
  const isRepair = !!repair || !!masterGuidance
  return completeJSON({
    role: 'swarm',
    system: `${REASONING_PERSONA}\n\n${GLOBAL_ASSUMPTIONS_BLOCK}`,
    user: masterGuidance
      ? appendMasterGuidance(context, masterGuidance.priorArtifact, masterGuidance.guidance)
      : appendRegenerationFeedback(context, repair),
    schema: GlobalAssumptionsPacketSchema,
    schemaName: 'global_assumptions_packet',
    // medium(first pass)/high(repair or master-guided) — 2026-08-11, Samir:
    // same split as every generate call in the pipeline; see
    // reasoningEffortFor's allowHighReasoning (router-shared.ts).
    effort: isRepair ? 'high' : 'medium',
    allowHighReasoning: isRepair,
    // +REPAIR_TOKEN_HEADROOM on repair only — see budget.ts for why.
    maxTokens: isRepair ? 900 + REPAIR_TOKEN_HEADROOM : 900,
  })
}

export async function runGlobalAssumptionsReview(
  frame: FramePacket,
  bundles: PerspectiveBundle[],
  packet: GlobalAssumptionsPacket,
  dryRun: boolean,
  panelsOff = false,
  extraContext?: string | null
): Promise<ReviewPanelVerdict> {
  return runReviewPanel(
    frame.core_question,
    'global-assumptions-review',
    packet,
    questionContext(frame, bundles, extraContext),
    dryRun,
    panelsOff
  )
}

export async function runGlobalEvidenceGenerate(
  frame: FramePacket,
  bundles: PerspectiveBundle[],
  dryRun: boolean,
  repair?: Repair<GlobalEvidencePacket>,
  extraContext?: string | null,
  masterGuidance?: MasterGuided<GlobalEvidencePacket>
): Promise<GlobalEvidencePacket> {
  if (dryRun) {
    return { question_level_evidence: [{ claim_id: '[dry run] claim', source_ref: '[dry run] source', confidence: 'low' }] }
  }
  const context = questionContext(frame, bundles, extraContext)
  const isRepair = !!repair || !!masterGuidance
  return generateWithOptionalSearch({
    role: 'swarm',
    system: `${REASONING_PERSONA}\n\n${GLOBAL_EVIDENCE_BLOCK}`,
    buildUser: (searchContext) =>
      (masterGuidance
        ? appendMasterGuidance(context, masterGuidance.priorArtifact, masterGuidance.guidance)
        : appendRegenerationFeedback(context, repair)) + searchContext,
    baseSchema: GlobalEvidencePacketSchema,
    schemaName: 'global_evidence_packet',
    // medium(first pass)/high(repair or master-guided) — 2026-08-11, Samir:
    // same split as every generate call in the pipeline; see
    // reasoningEffortFor's allowHighReasoning (router-shared.ts).
    effort: isRepair ? 'high' : 'medium',
    allowHighReasoning: isRepair,
    // 900 -> 1800, third instance of the exact same fix this session
    // (conclusions_packet, implications_packet): up to 8 items, each with a
    // 600-char claim_id AND a 600-char source_ref. Confirmed live: Gemini
    // truncated mid-JSON on the 2nd evidence item, twice in a row, at this
    // cap - immediately after global_assumptions_packet (smaller max, no
    // truncation seen) passed clean, isolating this as the schema-shape
    // issue, not a fluke of that particular call.
    // 1800 -> 2400 (2026-08-10, Samir): same fix again, one provider later —
    // perspective_evidence (orchestrator-perspectives.ts, identical
    // claim/source_ref/confidence/caveats shape) real-verified truncating
    // mid-JSON on gpt-oss-20b at 1800. Bumped this twin call to match before
    // it hits the same wall, even though it hasn't been caught live yet.
    // +REPAIR_TOKEN_HEADROOM on repair only — see budget.ts for why.
    maxTokens: isRepair ? 2400 + REPAIR_TOKEN_HEADROOM : 2400,
  })
}

export async function runGlobalEvidenceReview(
  frame: FramePacket,
  packet: GlobalEvidencePacket,
  dryRun: boolean,
  panelsOff = false,
  extraContext?: string | null
): Promise<ReviewPanelVerdict> {
  return runReviewPanel(
    frame.core_question,
    'global-evidence-review',
    packet,
    serializeFrame(frame, extraContext),
    dryRun,
    panelsOff
  )
}

export async function runConclusionsGenerate(
  frame: FramePacket,
  bundles: PerspectiveBundle[],
  globalAssumptions: GlobalAssumptionsPacket,
  globalEvidence: GlobalEvidencePacket,
  dryRun: boolean,
  repair?: Repair<ConclusionsPacket>,
  extraContext?: string | null,
  masterGuidance?: MasterGuided<ConclusionsPacket>
): Promise<ConclusionsPacket> {
  if (dryRun) return { conclusions: ['[dry run] conclusion.'], supporting_chain: ['[dry run] supporting step.'] }
  const context = `${questionContext(frame, bundles, extraContext)}\n\n## Global assumptions\n${globalAssumptions.question_level_assumptions.map((a) => `- ${a}`).join('\n')}\n\n## Global evidence\n${globalEvidence.question_level_evidence.map((e) => `- ${e.claim_id} (${e.source_ref}, ${e.confidence})`).join('\n')}`
  const isRepair = !!repair || !!masterGuidance
  return completeJSON({
    role: 'swarm',
    system: `${REASONING_PERSONA}\n\n${CONCLUSIONS_BLOCK}`,
    user: masterGuidance
      ? appendMasterGuidance(context, masterGuidance.priorArtifact, masterGuidance.guidance)
      : appendRegenerationFeedback(context, repair),
    schema: ConclusionsPacketSchema,
    schemaName: 'conclusions_packet',
    // medium(first pass)/high(repair or master-guided) — 2026-08-11, Samir:
    // same split as every generate call in the pipeline; see
    // reasoningEffortFor's allowHighReasoning (router-shared.ts).
    effort: isRepair ? 'high' : 'medium',
    allowHighReasoning: isRepair,
    // 900 -> 1800 (real traffic 2026-08-02): ConclusionsPacketSchema's own
    // bounds allow up to 4 conclusions + 8 supporting_chain items at 600 chars
    // each - 900 tokens can't cover that even at typical (non-maxed) length.
    // Confirmed live: Gemini's raw output truncated mid-JSON on the 3rd
    // conclusion, twice in a row, at exactly this cap.
    // +REPAIR_TOKEN_HEADROOM on repair only — see budget.ts for why.
    maxTokens: isRepair ? 1800 + REPAIR_TOKEN_HEADROOM : 1800,
  })
}

export async function runConclusionsReview(
  frame: FramePacket,
  packet: ConclusionsPacket,
  dryRun: boolean,
  panelsOff = false,
  extraContext?: string | null
): Promise<ReviewPanelVerdict> {
  return runReviewPanel(
    frame.core_question,
    'conclusions-review',
    packet,
    serializeFrame(frame, extraContext),
    dryRun,
    panelsOff
  )
}

export async function runImplicationsGenerate(
  frame: FramePacket,
  conclusions: ConclusionsPacket,
  degradedNotes: string[],
  dryRun: boolean,
  repair?: Repair<ImplicationsPacket>,
  extraContext?: string | null,
  masterGuidance?: MasterGuided<ImplicationsPacket>
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
  const context = `${serializeFrame(frame, extraContext)}\n\n## Conclusions\n${conclusions.conclusions.map((c) => `- ${c}`).join('\n')}\n\n## Supporting chain\n${conclusions.supporting_chain.map((s) => `- ${s}`).join('\n')}${degradedNotes.length ? `\n\n## Degraded upstream layers\n${degradedNotes.map((d) => `- ${d}`).join('\n')}` : ''}`
  const isRepair = !!repair || !!masterGuidance
  return completeJSON({
    role: 'swarm',
    system: `${REASONING_PERSONA}\n\n${IMPLICATIONS_BLOCK}`,
    user: masterGuidance
      ? appendMasterGuidance(context, masterGuidance.priorArtifact, masterGuidance.guidance)
      : appendRegenerationFeedback(context, repair),
    schema: ImplicationsPacketSchema,
    schemaName: 'implications_packet',
    // medium(first pass)/high(repair or master-guided) — 2026-08-11, Samir:
    // same split as every generate call in the pipeline; see
    // reasoningEffortFor's allowHighReasoning (router-shared.ts).
    effort: isRepair ? 'high' : 'medium',
    allowHighReasoning: isRepair,
    // 900 -> 1800, same fix and same evidence shape as conclusions_packet
    // above: ImplicationsPacketSchema allows up to 8 implications (each with
    // a 600-char text AND a 600-char who) plus 6 caveats at 600 chars -
    // structurally larger than conclusions_packet's own bounds, so it needed
    // at least the same headroom. Confirmed live: Gemini truncated mid-JSON
    // on the first implication's text field, twice in a row, at this cap.
    // +REPAIR_TOKEN_HEADROOM on repair only — see budget.ts for why.
    maxTokens: isRepair ? 1800 + REPAIR_TOKEN_HEADROOM : 1800,
  })
}

export async function runImplicationsReview(
  frame: FramePacket,
  packet: ImplicationsPacket,
  dryRun: boolean,
  panelsOff = false,
  extraContext?: string | null
): Promise<ReviewPanelVerdict> {
  return runReviewPanel(
    frame.core_question,
    'implications-review',
    packet,
    serializeFrame(frame, extraContext),
    dryRun,
    panelsOff
  )
}

export async function runFinalComposition(
  frame: FramePacket,
  implications: ImplicationsPacket,
  dryRun: boolean,
  extraContext?: string | null
): Promise<FinalAnswer> {
  if (dryRun) {
    return {
      core_question: frame.core_question,
      answer: '[dry run] composed answer.',
      caveats: implications.caveats_from_degraded_layers,
    }
  }
  const context = `${serializeFrame(frame, extraContext)}\n\n## Implications\n${implications.implications.map((i) => `- (${i.ikind}) ${i.text} — ${i.who}, ${i.horizon}`).join('\n')}\n\nConfidence: ${implications.confidence}${implications.caveats_from_degraded_layers.length ? `\nDegraded upstream: ${implications.caveats_from_degraded_layers.join('; ')}` : ''}`
  return completeJSON({
    role: 'synthesis',
    system: `${REASONING_PERSONA}\n\n${FINAL_COMPOSITION_BLOCK}`,
    user: context,
    schema: FinalAnswerSchema,
    schemaName: 'final_answer',
    // 'medium' (was 'low', 2026-08-11) — no repair path exists for final
    // composition (packaging only, no review panel), so every call here is a
    // "first-pass" call by definition; matches the medium-first-pass default
    // every other generate call now uses.
    effort: 'medium',
    maxTokens: 1200,
  })
}
