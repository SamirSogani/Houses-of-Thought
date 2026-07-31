// Server-only orchestration for the Perspectives layer — the pipeline's one
// fan-out point (decisions/019). Split into two generate rounds because the 4
// sub-elements need each bundle's own generated stance text as input
// (lib/ai/reasoning/steps.ts explains why that can't be one request). Failure
// here is the one place that degrades instead of hard-blocking: a bundle
// whose panel fails gets its own bounded regenerations (MAX_REGENERATION_ATTEMPTS,
// lib/ai/reasoning/budget.ts) — only that bundle, not the others — and is
// marked degraded and passed forward only once those are exhausted, since the
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
  appendRegenerationFeedback,
} from './prompts'
import { runReviewPanel } from './orchestrator-panel'
import { MAX_REGENERATION_ATTEMPTS } from './budget'

if (typeof window !== 'undefined') {
  throw new Error('lib/ai/reasoning/orchestrator-perspectives.ts is server-only and must not run in the browser')
}

const StanceModelSchema = PerspectiveStanceSchema.omit({ perspective_id: true, stance_label: true })

// Mirrors runReviewPanel's REVIEWER_STAGGER_MS (orchestrator-panel.ts). Real
// testing (06-phase1.5-bounded-retries.md, 2026-07-31) showed this step's 4
// sub-element calls per bundle, fired in parallel across all n bundles with
// no stagger, exhausted the 2-target drafter lane (Gemini + Cerebras) at
// n=2 — 8 simultaneous calls drew 3 consecutive ai-rate-limited responses.
// Staggering every call's start, flattened across bundles AND sub-elements
// (not just bundles), spreads the full 4n calls over time instead of firing
// them at once.
const DRAFTER_STAGGER_MS = 150

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

// Only a bundle whose last verdict failed AND hasn't exhausted its retries
// needs regenerating — everything else (already passed, or already gave up
// and degraded) is carried forward untouched. Shared by generate and review
// below so the two can never disagree about which bundles are "still live."
function needsRegeneration(verdict: ReviewPanelVerdict | undefined): boolean {
  return verdict != null && !verdict.overall_pass && !verdict.degraded
}

export async function runPerspectivesGenerateDetails(
  frame: FramePacket,
  stances: PerspectiveStance[],
  dryRun: boolean,
  // Present only on a retry loop-back from perspectives-review (03-
  // orchestration-and-failure-handling.md: "only the failing unit
  // regenerates... one perspective's bundle failing doesn't touch any other
  // perspective"). Bundles whose prior verdict already settled (passed, or
  // exhausted retries and degraded) are returned unchanged, not re-asked for.
  repair?: { priorBundles: PerspectiveBundle[]; priorVerdicts: ReviewPanelVerdict[]; priorAttempts: number[] }
): Promise<{ bundles: PerspectiveBundle[]; attempts: number[] }> {
  const frameText = serializeFrame(frame)
  const n = stances.length

  const bundles = await Promise.all(
    stances.map(async (stance, i) => {
      const authoredBy = stances[(i + 1) % n].perspective_id
      if (dryRun) return dryRunBundle(stance, authoredBy)

      const priorVerdict = repair?.priorVerdicts[i]
      if (repair && !needsRegeneration(priorVerdict)) return repair.priorBundles[i]

      const stanceText = `${frameText}\n\n## This perspective's stance\n${stance.stance_label}: ${stance.stance_summary}\nKey claims:\n${stance.key_claims.map((c) => `- ${c}`).join('\n')}`
      const feedback = repair && priorVerdict
        ? { priorArtifact: repair.priorBundles[i], priorVerdict }
        : undefined

      // Flattened across bundles AND sub-elements (i*4+j), not just bundles —
      // see DRAFTER_STAGGER_MS above.
      const stagger = (j: number) =>
        new Promise<void>((resolve) => setTimeout(resolve, (i * 4 + j) * DRAFTER_STAGGER_MS))

      const [subQuestions, assumptions, evidence, counterargument] = await Promise.all([
        stagger(0).then(() =>
          completeJSON({
            role: 'drafter',
            system: `${REASONING_PERSONA}\n\n${PERSPECTIVE_SUBQUESTIONS_BLOCK}`,
            user: appendRegenerationFeedback(stanceText, feedback),
            schema: PerspectiveBundleSchema.pick({ sub_questions: true }),
            schemaName: 'perspective_subquestions',
            effort: 'high',
            maxTokens: 500,
          })
        ),
        stagger(1).then(() =>
          completeJSON({
            role: 'drafter',
            system: `${REASONING_PERSONA}\n\n${PERSPECTIVE_ASSUMPTIONS_BLOCK}`,
            user: appendRegenerationFeedback(stanceText, feedback),
            schema: PerspectiveBundleSchema.pick({ assumptions: true }),
            schemaName: 'perspective_assumptions',
            effort: 'high',
            maxTokens: 500,
          })
        ),
        stagger(2).then(() =>
          completeJSON({
            role: 'drafter',
            system: `${REASONING_PERSONA}\n\n${PERSPECTIVE_EVIDENCE_BLOCK}`,
            user: appendRegenerationFeedback(stanceText, feedback),
            schema: PerspectiveBundleSchema.pick({ evidence: true }),
            schemaName: 'perspective_evidence',
            effort: 'high',
            maxTokens: 700,
          })
        ),
        stagger(3).then(() =>
          completeJSON({
            role: 'drafter',
            system: `${REASONING_PERSONA}\n\n${PERSPECTIVE_COUNTERARGUMENT_BLOCK}`,
            user: appendRegenerationFeedback(stanceText, feedback),
            schema: PerspectiveBundleSchema.shape.counterargument.omit({ authored_by_perspective_id: true }),
            schemaName: 'perspective_counterargument',
            effort: 'high',
            maxTokens: 700,
          })
        ),
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

  const attempts = stances.map((_, i) => {
    if (!repair) return 1
    return needsRegeneration(repair.priorVerdicts[i]) ? repair.priorAttempts[i] + 1 : repair.priorAttempts[i]
  })

  return { bundles, attempts }
}

// The one step that degrades instead of hard-blocking: a bundle that still
// fails after MAX_REGENERATION_ATTEMPTS is marked degraded and kept, since
// the remaining bundles still give the global layers something to work with
// (03-orchestration-and-failure-handling.md). A bundle already settled last
// cycle (passed, or already degraded) is NOT re-submitted to a fresh panel —
// its prior verdict is final and carried forward as-is.
export async function runPerspectivesReview(
  frame: FramePacket,
  bundles: PerspectiveBundle[],
  priorVerdicts: ReviewPanelVerdict[] | null,
  attempts: number[] | null,
  dryRun: boolean
): Promise<ReviewPanelVerdict[]> {
  const context = serializeFrame(frame)
  return Promise.all(
    bundles.map(async (b, i) => {
      const prior = priorVerdicts?.[i]
      if (prior && !needsRegeneration(prior)) return prior
      const verdict = await runReviewPanel(b.perspective_id, 'perspectives-review', b, context, dryRun)
      if (verdict.overall_pass) return verdict
      const attemptsUsed = attempts?.[i] ?? 1
      return attemptsUsed >= MAX_REGENERATION_ATTEMPTS ? { ...verdict, degraded: true } : verdict
    })
  )
}
