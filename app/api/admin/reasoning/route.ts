// POST /api/admin/reasoning — the reasoning pipeline's step dispatcher
// (decision 019; architecture: plans/active/reasoning-pipeline/). One route,
// 17 step types, stateless: the client resends the whole accumulated run
// state every call (like /api/ai/draft's "house-so-far in" pattern) and this
// route returns only the new fields that step produced (`patch`), which the
// client merges in. maxDuration=30 per step; a review-gated layer is always
// split into two steps (generate, review) — and Perspectives generation into
// two more — so a single request never chains two dependent
// completeJSON-latency-bounded batches. See lib/ai/reasoning/steps.ts.
//
// Admin-only (403 before any quota is spent). enforceReasoningRunLimit fires
// only on the first step of a run (context-gather-pre) — a per-day cap on
// RUNS, not calls, using its own ai_usage subject namespace, deliberately NOT
// the shared pooled enforceAiLimit (see lib/ai/limits.ts for why).

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { AiError } from '@/lib/ai/router'
import { isCallerAdmin } from '@/lib/auth/admin'
import { enforceReasoningRunLimit } from '@/lib/ai/limits'
import { log } from '@/lib/log'
import { STEP_ORDER, type StepId, nextStep as nextStepAfter, STEP_FAILURE_MODE } from '@/lib/ai/reasoning/steps'
import { MIN_N, MAX_N_PHASE1 } from '@/lib/ai/reasoning/budget'
import { serializeFrame } from '@/lib/ai/reasoning/prompts'
import {
  ContextGatherVerdictSchema,
  FramePacketSchema,
  BreadthScopingPacketSchema,
  PerspectiveStanceSchema,
  PerspectiveBundleSchema,
  ReviewPanelVerdictSchema,
  GlobalAssumptionsPacketSchema,
  GlobalEvidencePacketSchema,
  ConclusionsPacketSchema,
  ImplicationsPacketSchema,
  type ReviewPanelVerdict,
} from '@/lib/ai/reasoning/contracts'
import {
  runContextGather,
  runFrameGenerate,
  runFrameReview,
  runBreadthScoping,
} from '@/lib/ai/reasoning/orchestrator-setup'
import {
  runPerspectivesGenerateStances,
  runPerspectivesGenerateDetails,
  runPerspectivesReview,
} from '@/lib/ai/reasoning/orchestrator-perspectives'
import {
  runGlobalAssumptionsGenerate,
  runGlobalAssumptionsReview,
  runGlobalEvidenceGenerate,
  runGlobalEvidenceReview,
  runConclusionsGenerate,
  runConclusionsReview,
  runImplicationsGenerate,
  runImplicationsReview,
  runFinalComposition,
} from '@/lib/ai/reasoning/orchestrator-global'

export const maxDuration = 30

// Larger than the draft route's 100KB — this run state accumulates n
// perspective bundles plus every packet/verdict produced so far, not one house.
const MAX_BODY_BYTES = 300 * 1024

const RunStateSchema = z.object({
  originalQuery: z.string().min(1).max(2000),
  contextGatherPre: ContextGatherVerdictSchema.nullish(),
  frame: FramePacketSchema.nullish(),
  frameVerdict: ReviewPanelVerdictSchema.nullish(),
  contextGatherPost: ContextGatherVerdictSchema.nullish(),
  breadthScoping: BreadthScopingPacketSchema.nullish(),
  perspectiveStances: z.array(PerspectiveStanceSchema).nullish(),
  perspectives: z.array(PerspectiveBundleSchema).nullish(),
  perspectiveVerdicts: z.array(ReviewPanelVerdictSchema).nullish(),
  globalAssumptions: GlobalAssumptionsPacketSchema.nullish(),
  globalAssumptionsVerdict: ReviewPanelVerdictSchema.nullish(),
  globalEvidence: GlobalEvidencePacketSchema.nullish(),
  globalEvidenceVerdict: ReviewPanelVerdictSchema.nullish(),
  conclusions: ConclusionsPacketSchema.nullish(),
  conclusionsVerdict: ReviewPanelVerdictSchema.nullish(),
  implications: ImplicationsPacketSchema.nullish(),
  implicationsVerdict: ReviewPanelVerdictSchema.nullish(),
})
type RunState = z.infer<typeof RunStateSchema>

const RequestSchema = z.object({
  step: z.enum(STEP_ORDER),
  capN: z.number().int().min(MIN_N).max(MAX_N_PHASE1).nullish(),
  dryRun: z.boolean().optional(),
  run: RunStateSchema,
})

function failingStandardIds(verdict: ReviewPanelVerdict): string[] {
  return (Object.keys(verdict.standards) as (keyof ReviewPanelVerdict['standards'])[]).filter(
    (id) => !verdict.standards[id].pass
  )
}

function ok(step: StepId, patch: Record<string, unknown>): Response {
  return NextResponse.json({ step, patch, nextStep: nextStepAfter(step), halted: false })
}

// Only called for steps whose failure mode is 'hard-block' (steps.ts); the
// dev-time check below guards against a future edit adding a case here
// without updating STEP_FAILURE_MODE, or vice versa.
function halted(step: StepId, verdict: ReviewPanelVerdict, patch: Record<string, unknown>): Response {
  if (STEP_FAILURE_MODE[step] !== 'hard-block') {
    log.error('ai/reasoning/route', 'halted() called on a non-hard-block step', { step })
  }
  const failing = failingStandardIds(verdict)
  return NextResponse.json({
    step,
    patch,
    nextStep: null,
    halted: true,
    haltReason: `${step} failed review — ${failing.length}/9 standards failed (${failing.join(', ')}).`,
  })
}

function missing(what: string): Response {
  return NextResponse.json({ error: 'invalid-request', detail: `missing ${what} in run state` }, { status: 400 })
}

export async function POST(req: Request): Promise<Response> {
  if (!(await isCallerAdmin())) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const raw = await req.text()
  if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'payload-too-large' }, { status: 413 })
  }

  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 })
  }

  const parsed = RequestSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid-request' }, { status: 400 })
  }
  const { step, run } = parsed.data
  const dryRun = parsed.data.dryRun ?? false
  const capN = parsed.data.capN ?? MAX_N_PHASE1

  // Run-level cap: checked once, at the true start of a run — not per step.
  if (step === 'context-gather-pre' && !dryRun) {
    try {
      await enforceReasoningRunLimit()
    } catch (err) {
      if (err instanceof AiError) return NextResponse.json({ error: err.message }, { status: err.status })
      throw err
    }
  }

  try {
    switch (step) {
      case 'context-gather-pre': {
        const verdict = await runContextGather(`Original question: ${run.originalQuery}`, dryRun)
        return ok(step, { contextGatherPre: verdict })
      }

      case 'frame-generate': {
        const frame = await runFrameGenerate(run.originalQuery, dryRun)
        return ok(step, { frame })
      }

      case 'frame-review': {
        if (!run.frame) return missing('frame')
        const verdict = await runFrameReview(run.frame, dryRun)
        if (!verdict.overall_pass) return halted(step, verdict, { frameVerdict: verdict })
        return ok(step, { frameVerdict: verdict })
      }

      case 'context-gather-post': {
        if (!run.frame) return missing('frame')
        const verdict = await runContextGather(
          `${serializeFrame(run.frame)}\n\nIs this frame complete enough to proceed?`,
          dryRun
        )
        return ok(step, { contextGatherPost: verdict })
      }

      case 'breadth-scoping': {
        if (!run.frame) return missing('frame')
        const scoping = await runBreadthScoping(run.frame, capN, dryRun)
        return ok(step, { breadthScoping: scoping })
      }

      case 'perspectives-generate-stances': {
        if (!run.frame || !run.breadthScoping) return missing('frame/breadthScoping')
        const stances = await runPerspectivesGenerateStances(run.frame, run.breadthScoping, dryRun)
        return ok(step, { perspectiveStances: stances })
      }

      case 'perspectives-generate-details': {
        if (!run.frame || !run.perspectiveStances) return missing('frame/perspectiveStances')
        const bundles = await runPerspectivesGenerateDetails(run.frame, run.perspectiveStances, dryRun)
        return ok(step, { perspectives: bundles })
      }

      case 'perspectives-review': {
        if (!run.frame || !run.perspectives) return missing('frame/perspectives')
        // Degrade-and-continue: never halts, even if every bundle failed.
        const verdicts = await runPerspectivesReview(run.frame, run.perspectives, dryRun)
        return ok(step, { perspectiveVerdicts: verdicts })
      }

      case 'global-assumptions-generate': {
        if (!run.frame || !run.perspectives) return missing('frame/perspectives')
        const packet = await runGlobalAssumptionsGenerate(run.frame, run.perspectives, dryRun)
        return ok(step, { globalAssumptions: packet })
      }

      case 'global-assumptions-review': {
        if (!run.frame || !run.globalAssumptions) return missing('frame/globalAssumptions')
        const verdict = await runGlobalAssumptionsReview(run.frame, run.globalAssumptions, dryRun)
        if (!verdict.overall_pass) return halted(step, verdict, { globalAssumptionsVerdict: verdict })
        return ok(step, { globalAssumptionsVerdict: verdict })
      }

      case 'global-evidence-generate': {
        if (!run.frame || !run.perspectives) return missing('frame/perspectives')
        const packet = await runGlobalEvidenceGenerate(run.frame, run.perspectives, dryRun)
        return ok(step, { globalEvidence: packet })
      }

      case 'global-evidence-review': {
        if (!run.frame || !run.globalEvidence) return missing('frame/globalEvidence')
        const verdict = await runGlobalEvidenceReview(run.frame, run.globalEvidence, dryRun)
        if (!verdict.overall_pass) return halted(step, verdict, { globalEvidenceVerdict: verdict })
        return ok(step, { globalEvidenceVerdict: verdict })
      }

      case 'conclusions-generate': {
        if (!run.frame || !run.perspectives || !run.globalAssumptions || !run.globalEvidence) {
          return missing('frame/perspectives/globalAssumptions/globalEvidence')
        }
        const packet = await runConclusionsGenerate(
          run.frame,
          run.perspectives,
          run.globalAssumptions,
          run.globalEvidence,
          dryRun
        )
        return ok(step, { conclusions: packet })
      }

      case 'conclusions-review': {
        if (!run.frame || !run.conclusions) return missing('frame/conclusions')
        const verdict = await runConclusionsReview(run.frame, run.conclusions, dryRun)
        if (!verdict.overall_pass) return halted(step, verdict, { conclusionsVerdict: verdict })
        return ok(step, { conclusionsVerdict: verdict })
      }

      case 'implications-generate': {
        if (!run.frame || !run.conclusions) return missing('frame/conclusions')
        const degradedNotes = degradedPerspectiveNotes(run)
        const packet = await runImplicationsGenerate(run.frame, run.conclusions, degradedNotes, dryRun)
        return ok(step, { implications: packet })
      }

      case 'implications-review': {
        if (!run.frame || !run.implications) return missing('frame/implications')
        const verdict = await runImplicationsReview(run.frame, run.implications, dryRun)
        if (!verdict.overall_pass) return halted(step, verdict, { implicationsVerdict: verdict })
        return ok(step, { implicationsVerdict: verdict })
      }

      case 'final-composition': {
        if (!run.frame || !run.implications) return missing('frame/implications')
        const finalAnswer = await runFinalComposition(run.frame, run.implications, dryRun)
        return ok(step, { finalAnswer })
      }

      default:
        return NextResponse.json({ error: 'invalid-request', detail: 'unknown step' }, { status: 400 })
    }
  } catch (err) {
    if (err instanceof AiError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    log.error('ai/reasoning/route', 'unhandled error', { step, error: (err as Error)?.message })
    return NextResponse.json({ error: 'ai-upstream-error' }, { status: 502 })
  }
}

function degradedPerspectiveNotes(run: RunState): string[] {
  if (!run.perspectiveVerdicts) return []
  return run.perspectiveVerdicts
    .map((v, i) => (v.degraded ? `${run.perspectives?.[i]?.stance_label ?? v.subject_id}: review panel did not pass` : null))
    .filter((x): x is string => x !== null)
}
