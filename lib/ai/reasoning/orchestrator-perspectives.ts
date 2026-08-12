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
import { generateWithOptionalSearch } from './search'
import { MAX_REGENERATION_ATTEMPTS, REPAIR_TOKEN_HEADROOM } from './budget'

if (typeof window !== 'undefined') {
  throw new Error('lib/ai/reasoning/orchestrator-perspectives.ts is server-only and must not run in the browser')
}

const StanceModelSchema = PerspectiveStanceSchema.omit({ perspective_id: true, stance_label: true })

// RETIRED 2026-08-12 (Samir, root-causing "the pipeline consistently stops
// on perspectives-generate or global-assumptions" on real Vercel Hobby
// traffic): this used to be DRAFTER_STAGGER_MS, 20s (up to 4x under detected
// stress) between each of this step's flattened calls — sized to keep this
// step's real request rate under Groq's account-level 8000 TPM ceiling, back
// when these calls rode the 'drafter' role/lane. That's been gone since
// decision 020 (2026-08-10) moved this whole file to 'swarm', and gone
// further still since this session's DeepInfra-only pinning
// (router-lanes.ts's swarmAttempts()) removed Groq from the swarm chain
// entirely — there is no TPM ceiling left in this lane to protect against
// (DeepInfra is a paid account with no such per-request cap, the same fact
// that justified going DeepInfra-only in the first place).
//
// What the 20s/call number actually bought us, once its original purpose was
// gone, was pure self-inflicted latency: at n=2, the flattened schedule ran
// this step's 8 calls from 0s to 140s — comfortably past
// app/api/admin/reasoning/route.ts's 60s maxDuration even before any stress
// multiplier, so Vercel hard-killed the function outright before the code's
// own graceful timeout/cascade logic ever got a chance to run. This is the
// deterministic half of that bug (the other half — the route's maxDuration
// itself being far tighter than Hobby actually requires — is fixed in
// router.ts's CHAIN_DEADLINE_MS and this route's own maxDuration; see
// plans/active/reasoning-pipeline/20-deepinfra-tuning-real-verification.md's
// addendum for the full real-verified diagnosis). Replaced by
// SWARM_STAGGER_MS below — small and constant, matching runReviewPanel's
// REVIEWER_STAGGER_MS (orchestrator-panel.ts) — purely to avoid firing every
// call in the exact same instant, not to throttle a rate limit that no
// longer exists here.
const SWARM_STAGGER_MS = 150

export async function runPerspectivesGenerateStances(
  frame: FramePacket,
  scoping: BreadthScopingPacket,
  dryRun: boolean,
  // Phase 3 item 1's re-contextualization mechanism (context-gather-post +
  // any ad-hoc calls so far) — route.ts's buildExtraContext.
  extraContext?: string | null
): Promise<PerspectiveStance[]> {
  const frameText = serializeFrame(frame, extraContext)
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
        role: 'swarm',
        system: `${REASONING_PERSONA}\n\n${PERSPECTIVE_STANCE_BLOCK}`,
        user: `${frameText}\n\nYour assigned viewpoint label: ${label}`,
        schema: StanceModelSchema,
        schemaName: 'perspective_stance',
        // No repair path exists for stance generation (only the 4 sub-
        // elements below get regenerated after a failed review) — always a
        // first-pass call, so always 'medium'. See allowHighReasoning
        // comments below for why 'high' is reserved for repair specifically.
        effort: 'medium',
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
  repair?: { priorBundles: PerspectiveBundle[]; priorVerdicts: ReviewPanelVerdict[]; priorAttempts: number[] },
  // Phase 3 item 1's re-contextualization mechanism — route.ts's buildExtraContext.
  extraContext?: string | null
): Promise<{ bundles: PerspectiveBundle[]; attempts: number[] }> {
  const frameText = serializeFrame(frame, extraContext)
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
      // see SWARM_STAGGER_MS above.
      const stagger = (j: number) =>
        new Promise<void>((resolve) => setTimeout(resolve, (i * 4 + j) * SWARM_STAGGER_MS))

      // medium(first pass)/high(repair) for all 4 — 2026-08-11, Samir: same
      // split as every other generate call in the pipeline. `feedback`
      // presence already distinguishes first-pass from repair for this
      // bundle (computed once above), so it doubles as the effort switch too.
      const genEffort = feedback ? 'high' : 'medium'
      const [subQuestions, assumptions, evidence, counterargument] = await Promise.all([
        stagger(0).then(() =>
          completeJSON({
            role: 'swarm',
            system: `${REASONING_PERSONA}\n\n${PERSPECTIVE_SUBQUESTIONS_BLOCK}`,
            user: appendRegenerationFeedback(stanceText, feedback),
            schema: PerspectiveBundleSchema.pick({ sub_questions: true }),
            schemaName: 'perspective_subquestions',
            effort: genEffort,
            allowHighReasoning: !!feedback,
            // +REPAIR_TOKEN_HEADROOM on repair only — see budget.ts for why.
            maxTokens: feedback ? 1100 + REPAIR_TOKEN_HEADROOM : 1100,
          })
        ),
        stagger(1).then(() =>
          completeJSON({
            role: 'swarm',
            system: `${REASONING_PERSONA}\n\n${PERSPECTIVE_ASSUMPTIONS_BLOCK}`,
            user: appendRegenerationFeedback(stanceText, feedback),
            schema: PerspectiveBundleSchema.pick({ assumptions: true }),
            schemaName: 'perspective_assumptions',
            effort: genEffort,
            allowHighReasoning: !!feedback,
            // +REPAIR_TOKEN_HEADROOM on repair only — see budget.ts for why.
            maxTokens: feedback ? 1200 + REPAIR_TOKEN_HEADROOM : 1200,
          })
        ),
        stagger(2).then(() =>
          generateWithOptionalSearch({
            role: 'swarm',
            system: `${REASONING_PERSONA}\n\n${PERSPECTIVE_EVIDENCE_BLOCK}`,
            buildUser: (searchContext) => appendRegenerationFeedback(stanceText, feedback) + searchContext,
            baseSchema: PerspectiveBundleSchema.pick({ evidence: true }),
            schemaName: 'perspective_evidence',
            effort: genEffort,
            allowHighReasoning: !!feedback,
            // 1800 → 2400 (2026-08-10, Samir): real-verified live truncating
            // mid-JSON on gpt-oss-20b — its evidence items (rich citations:
            // study names, years, journals) run longer than Llama's did at
            // the same budget. global_evidence (orchestrator-global.ts) gets
            // the same bump — identical shape/pattern, same risk, even
            // though it hasn't been caught truncating yet live.
            // +REPAIR_TOKEN_HEADROOM on repair only — see budget.ts for why.
            maxTokens: feedback ? 2400 + REPAIR_TOKEN_HEADROOM : 2400,
          })
        ),
        stagger(3).then(() =>
          completeJSON({
            role: 'swarm',
            system: `${REASONING_PERSONA}\n\n${PERSPECTIVE_COUNTERARGUMENT_BLOCK}`,
            user: appendRegenerationFeedback(stanceText, feedback),
            schema: PerspectiveBundleSchema.shape.counterargument.omit({ authored_by_perspective_id: true }),
            schemaName: 'perspective_counterargument',
            effort: genEffort,
            allowHighReasoning: !!feedback,
            // +REPAIR_TOKEN_HEADROOM on repair only — see budget.ts for why.
            maxTokens: feedback ? 1600 + REPAIR_TOKEN_HEADROOM : 1600,
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
  dryRun: boolean,
  panelsOff = false,
  // Phase 3 item 1's re-contextualization mechanism — route.ts's buildExtraContext.
  extraContext?: string | null
): Promise<ReviewPanelVerdict[]> {
  const context = serializeFrame(frame, extraContext)
  return Promise.all(
    bundles.map(async (b, i) => {
      const prior = priorVerdicts?.[i]
      if (prior && !needsRegeneration(prior)) return prior
      // The other perspectives' labels — so the panel knows this bundle is
      // deliberately narrow and doesn't fault it for ground a sibling
      // perspective owns (see buildReviewerPrompt, prompts.ts).
      const siblingLabels = bundles.filter((_, j) => j !== i).map((sib) => sib.stance_label)
      const verdict = await runReviewPanel(
        b.perspective_id,
        'perspectives-review',
        b,
        context,
        dryRun,
        panelsOff,
        siblingLabels
      )
      if (verdict.overall_pass) return verdict
      const attemptsUsed = attempts?.[i] ?? 1
      return attemptsUsed >= MAX_REGENERATION_ATTEMPTS ? { ...verdict, degraded: true } : verdict
    })
  )
}
