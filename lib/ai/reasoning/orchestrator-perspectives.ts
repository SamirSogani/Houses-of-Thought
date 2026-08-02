// Server-only orchestration for the Perspectives layer — the pipeline's one
// fan-out point (decisions/019). Split into two generate rounds because the 4
// sub-elements need each bundle's own generated stance text as input
// (lib/ai/reasoning/steps.ts explains why that can't be one request). Failure
// here is the one place that degrades instead of hard-blocking: a bundle
// whose panel fails gets its own bounded regenerations (MAX_REGENERATION_ATTEMPTS,
// lib/ai/reasoning/budget.ts) — only that bundle, not the others — and is
// marked degraded and passed forward only once those are exhausted, since the
// other bundles still give downstream layers something to work with.

import { completeJSON, drafterLaneStress, type DrafterLaneStress } from '@/lib/ai/router'
import { log } from '@/lib/log'
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
import { generateWithOptionalSearch } from './search'
import { MAX_REGENERATION_ATTEMPTS } from './budget'

if (typeof window !== 'undefined') {
  throw new Error('lib/ai/reasoning/orchestrator-perspectives.ts is server-only and must not run in the browser')
}

const StanceModelSchema = PerspectiveStanceSchema.omit({ perspective_id: true, stance_label: true })

// Mirrors runReviewPanel's REVIEWER_STAGGER_MS (orchestrator-panel.ts), but
// widened far past that pattern's original 150ms (2026-07-31 session,
// earlier): a 150ms spread only fixed *simultaneous* 429s — it did nothing
// against Groq's actual constraint, discovered by real-verifying past this
// step for the first time ever: an account-level 8000 TPM (tokens/minute)
// cap on gpt-oss-20b, counted against REQUESTED max_tokens, not just what's
// consumed. This step's 4 sub-calls request 1100+1200+1800+1600 = 5700
// tokens per bundle; at n=2 that's 11400 requested tokens for 8 calls, well
// over one minute's budget if fired close together — confirmed live via
// Groq's own "Limit 8000, Used 7434, Requested 1521" error.
//
// 20s between each flattened call spreads n=2's 8 calls (indices 0-7) across
// ~140s — an effective ~4900 TPM, ~60% of the cap, with real margin since
// actual response latency adds further gaps the math below doesn't count.
// The n=3 case (12 calls, 17100 tokens, ~220s spread) lands at a near-
// identical ~4700 TPM — a fixed per-call stagger scales the total spread
// with the load, keeping the effective rate roughly constant regardless of
// n. Deliberately slow: decision 019's whole premise is a slower, more
// rigorous answer, not a fast one — reliably finishing in minutes beats
// finishing fast and failing.
const DRAFTER_STAGGER_MS = 20_000

// Widened under detected drafter-lane stress (Phase 2 dynamic budget
// enforcement, 03-orchestration-and-failure-handling.md's "Budget
// enforcement" spec) — same flattened call schedule, spread further apart so
// the same total token/request rate lands on fewer live providers. See
// drafterLaneStress() (lib/ai/router-state.ts) for what these levels mean;
// motivated directly by the 2026-08-02 incident where Groq's daily
// exhaustion left only Gemini+Cerebras absorbing the full drafter load
// (plans/active/reasoning-pipeline/13-two-more-real-runs-and-a-grant-bug.md).
//
// 'critical' at 2x (40s) was real-verified live the same day (14-dynamic-
// budget-enforcement.md) and still wasn't enough: with Groq out and Gemini
// also saturated, Cerebras — by then the only target actually serving
// drafter calls — still produced schema-invalid JSON under the load. Bumped
// to 4x on Samir's explicit call: latency doesn't matter here (decision
// 019's whole premise is slower-but-rigorous), so lean hard into spacing
// rather than trying to find a minimal-but-sufficient multiplier.
function effectiveStaggerMs(stress: DrafterLaneStress): number {
  if (stress === 'critical') return DRAFTER_STAGGER_MS * 4
  if (stress === 'degraded') return DRAFTER_STAGGER_MS * 1.5
  return DRAFTER_STAGGER_MS
}

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
        maxTokens: 1000,
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

  // Checked once per call (not per bundle/element) — every element in this
  // batch shares the same schedule, and stress state doesn't change mid-call.
  const stress = drafterLaneStress()
  const staggerMs = effectiveStaggerMs(stress)
  if (stress !== 'none') {
    log.warn('ai/reasoning/perspectives', 'drafter lane under stress — widening stagger', { stress, staggerMs })
  }

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
        new Promise<void>((resolve) => setTimeout(resolve, (i * 4 + j) * staggerMs))

      const [subQuestions, assumptions, evidence, counterargument] = await Promise.all([
        stagger(0).then(() =>
          completeJSON({
            role: 'drafter',
            system: `${REASONING_PERSONA}\n\n${PERSPECTIVE_SUBQUESTIONS_BLOCK}`,
            user: appendRegenerationFeedback(stanceText, feedback),
            schema: PerspectiveBundleSchema.pick({ sub_questions: true }),
            schemaName: 'perspective_subquestions',
            effort: 'high',
            maxTokens: 1100,
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
            maxTokens: 1200,
          })
        ),
        stagger(2).then(() =>
          generateWithOptionalSearch({
            role: 'drafter',
            system: `${REASONING_PERSONA}\n\n${PERSPECTIVE_EVIDENCE_BLOCK}`,
            buildUser: (searchContext) => appendRegenerationFeedback(stanceText, feedback) + searchContext,
            baseSchema: PerspectiveBundleSchema.pick({ evidence: true }),
            schemaName: 'perspective_evidence',
            maxTokens: 1800,
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
            maxTokens: 1600,
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
