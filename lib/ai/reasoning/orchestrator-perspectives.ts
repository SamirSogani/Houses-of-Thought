// Server-only orchestration for the Perspectives layer — the pipeline's one
// fan-out point (decisions/019). Split into two generate rounds because the 4
// sub-elements need each bundle's own generated stance text as input
// (lib/ai/reasoning/steps.ts explains why that can't be one request). Failure
// here is the one place that degrades instead of hard-blocking: a perspective
// bundle whose panel fails is marked degraded and passed forward, since the
// other bundles still give downstream layers something to work with.

import { completeJSON } from '@/lib/ai/router'
import {
  type FramePacket,
  type BreadthScopingPacket,
  PerspectiveStanceSchema,
  type PerspectiveStance,
  PerspectiveBundleSchema,
  type PerspectiveBundle,
  type ReviewPanelVerdict,
} from './contracts'
import {
  REASONING_PERSONA,
  PERSPECTIVE_STANCE_BLOCK,
  PERSPECTIVE_SUBQUESTIONS_BLOCK,
  PERSPECTIVE_ASSUMPTIONS_BLOCK,
  PERSPECTIVE_EVIDENCE_BLOCK,
  PERSPECTIVE_COUNTERARGUMENT_BLOCK,
  serializeFrame,
} from './prompts'
import { runReviewPanel } from './orchestrator-panel'

if (typeof window !== 'undefined') {
  throw new Error('lib/ai/reasoning/orchestrator-perspectives.ts is server-only and must not run in the browser')
}

const StanceModelSchema = PerspectiveStanceSchema.omit({ perspective_id: true, stance_label: true })

export async function runPerspectivesGenerateStances(
  frame: FramePacket,
  scoping: BreadthScopingPacket,
  dryRun: boolean
): Promise<PerspectiveStance[]> {
  const frameText = serializeFrame(frame)
  return Promise.all(
    scoping.candidate_viewpoint_labels.map(async (label, i) => {
      const perspective_id = `p${i + 1}`
      if (dryRun) {
        return {
          perspective_id,
          stance_label: label,
          stance_summary: `[dry run] stance summary for ${label}.`,
          key_claims: [`[dry run] key claim for ${label}.`],
        }
      }
      const modelOut = await completeJSON({
        role: 'drafter',
        system: `${REASONING_PERSONA}\n\n${PERSPECTIVE_STANCE_BLOCK}`,
        user: `${frameText}\n\nYour assigned viewpoint label: ${label}`,
        schema: StanceModelSchema,
        schemaName: 'perspective_stance',
        effort: 'high',
        maxTokens: 700,
      })
      return { perspective_id, stance_label: label, ...modelOut }
    })
  )
}

function dryRunBundle(stance: PerspectiveStance, authoredBy: string): PerspectiveBundle {
  return {
    ...stance,
    sub_questions: [`[dry run] sub-question for ${stance.stance_label}.`],
    assumptions: [`[dry run] assumption for ${stance.stance_label}.`],
    evidence: [],
    counterargument: {
      authored_by_perspective_id: authoredBy,
      target_claims: stance.key_claims.slice(0, 1),
      rebuttals: [`[dry run] rebuttal against ${stance.stance_label}.`],
    },
  }
}

export async function runPerspectivesGenerateDetails(
  frame: FramePacket,
  stances: PerspectiveStance[],
  dryRun: boolean
): Promise<PerspectiveBundle[]> {
  const frameText = serializeFrame(frame)
  const n = stances.length

  return Promise.all(
    stances.map(async (stance, i) => {
      const authoredBy = stances[(i + 1) % n].perspective_id
      if (dryRun) return dryRunBundle(stance, authoredBy)

      const stanceText = `${frameText}\n\n## This perspective's stance\n${stance.stance_label}: ${stance.stance_summary}\nKey claims:\n${stance.key_claims.map((c) => `- ${c}`).join('\n')}`

      const [subQuestions, assumptions, evidence, counterargument] = await Promise.all([
        completeJSON({
          role: 'drafter',
          system: `${REASONING_PERSONA}\n\n${PERSPECTIVE_SUBQUESTIONS_BLOCK}`,
          user: stanceText,
          schema: PerspectiveBundleSchema.pick({ sub_questions: true }),
          schemaName: 'perspective_subquestions',
          effort: 'high',
          maxTokens: 500,
        }),
        completeJSON({
          role: 'drafter',
          system: `${REASONING_PERSONA}\n\n${PERSPECTIVE_ASSUMPTIONS_BLOCK}`,
          user: stanceText,
          schema: PerspectiveBundleSchema.pick({ assumptions: true }),
          schemaName: 'perspective_assumptions',
          effort: 'high',
          maxTokens: 500,
        }),
        completeJSON({
          role: 'drafter',
          system: `${REASONING_PERSONA}\n\n${PERSPECTIVE_EVIDENCE_BLOCK}`,
          user: stanceText,
          schema: PerspectiveBundleSchema.pick({ evidence: true }),
          schemaName: 'perspective_evidence',
          effort: 'high',
          maxTokens: 700,
        }),
        completeJSON({
          role: 'drafter',
          system: `${REASONING_PERSONA}\n\n${PERSPECTIVE_COUNTERARGUMENT_BLOCK}`,
          user: stanceText,
          schema: PerspectiveBundleSchema.shape.counterargument.omit({ authored_by_perspective_id: true }),
          schemaName: 'perspective_counterargument',
          effort: 'high',
          maxTokens: 700,
        }),
      ])

      return {
        ...stance,
        ...subQuestions,
        ...assumptions,
        ...evidence,
        counterargument: { authored_by_perspective_id: authoredBy, ...counterargument },
      }
    })
  )
}

// The one step that degrades instead of hard-blocking: a bundle whose panel
// fails is marked degraded and kept, since the remaining bundles still give
// the global layers something to work with (03-orchestration-and-failure-handling.md).
export async function runPerspectivesReview(
  frame: FramePacket,
  bundles: PerspectiveBundle[],
  dryRun: boolean
): Promise<ReviewPanelVerdict[]> {
  const context = serializeFrame(frame)
  const verdicts = await Promise.all(
    bundles.map((b) => runReviewPanel(b.perspective_id, 'perspectives-review', b, context, dryRun))
  )
  return verdicts.map((v) => (v.overall_pass ? v : { ...v, degraded: true }))
}
