// POST /api/admin/reasoning — the reasoning pipeline's step dispatcher
// (decision 019; architecture: plans/active/reasoning-pipeline/). One route,
// 17 step types, stateless: the client resends the whole accumulated run
// state every call (like /api/ai/draft's "house-so-far in" pattern) and this
// route returns only the new fields that step produced (`patch`), which the
// client merges in. maxDuration=60 per step (raised from 30, 2026-08-10 —
// Samir: DeepInfra gpt-oss-20b's real reasoning latency on the swarm/
// synthesis lanes needed more room than 30s could give with any fallback
// margin left — see lib/ai/router.ts's CHAIN_DEADLINE_MS and
// lib/ai/router-lanes.ts's DEEPINFRA_SWARM_TIMEOUT_MS, both keyed to this
// same 60s. NOTE: Vercel Hobby plan — this ceiling needs Fluid Compute
// enabled on the project (Vercel dashboard → Settings) to actually be
// honored; unverified from this codebase, confirm there if steps start
// getting hard-killed instead of gracefully erroring); a review-gated layer
// is always split into two steps (generate, review) — and Perspectives
// generation into two more — so a single request never chains two dependent
// completeJSON-latency-bounded batches. See lib/ai/reasoning/steps.ts.
//
// Admin-only (403 before any quota is spent).

import { NextResponse } from 'next/server'
import { AiError, drafterLaneStress } from '@/lib/ai/router'
import { isCallerAdmin } from '@/lib/auth/admin'
import { log } from '@/lib/log'
import { type StepId, nextStep as nextStepAfter, STEP_FAILURE_MODE } from '@/lib/ai/reasoning/steps'
import { MAX_N_PHASE1, MAX_REGENERATION_ATTEMPTS, clampNForStress } from '@/lib/ai/reasoning/budget'
import { serializeFrame, formatContextGatherAnswers } from '@/lib/ai/reasoning/prompts'
import { type ReviewPanelVerdict } from '@/lib/ai/reasoning/contracts'
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
  questionContext,
} from '@/lib/ai/reasoning/orchestrator-global'
import { runMasterReview } from '@/lib/ai/reasoning/orchestrator-panel'
import { persistRunStep, runStatusFrom } from '@/lib/ai/reasoning/persistence'
import {
  RequestSchema,
  failingStandardIds,
  missing,
  buildExtraContext,
  buildAdHocContext,
  degradedPerspectiveNotes,
} from './route-schema'

export const maxDuration = 60

// Larger than the draft route's 100KB — this run state accumulates n
// perspective bundles plus every packet/verdict produced so far, not one house.
const MAX_BODY_BYTES = 300 * 1024

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
  const { step, run, runId, atStep } = parsed.data
  const dryRun = parsed.data.dryRun ?? false
  const panelsOff = parsed.data.panelsOff ?? false
  const capN = parsed.data.capN ?? MAX_N_PHASE1
  const attempt = parsed.data.attempt ?? 1
  const devForceNeedsInput = parsed.data.devForceNeedsInput ?? false
  // Phase 3 item 1's confirmed re-contextualization mechanism: context-gather-
  // post's + any ad-hoc calls' answers so far, folded into one block threaded
  // through every downstream generate/review call via serializeFrame's
  // extraContext param. Computed once per request since it doesn't depend on
  // which step is running.
  const extraContext = buildExtraContext(run)

  // Fire-and-forget persistence (Phase 2 item 1, decision 019): every real
  // (non-dry-run) step response upserts the full merged run state — not just
  // on completion, so a halted run is captured too. See
  // lib/ai/reasoning/persistence.ts and 15-persistence.md. Nested (rather
  // than module-level) so it closes over this request's `run`/`runId`/
  // `dryRun` without threading them through every one of ok/retryStep/
  // halted's ~15 call sites below.
  function persist(patchStep: StepId, patch: Record<string, unknown>, nextStep: StepId | null, isHalted: boolean, haltReason?: string): void {
    if (dryRun) return
    void persistRunStep(runId, run.originalQuery, { ...run, ...patch }, patchStep, runStatusFrom(nextStep, isHalted), haltReason, panelsOff)
  }

  function ok(step: StepId, patch: Record<string, unknown>): Response {
    const nextStep = nextStepAfter(step)
    persist(step, patch, nextStep, false)
    return NextResponse.json({ step, patch, nextStep, halted: false })
  }

  // A failed panel verdict with regenerations still available: loop the client
  // back to `generateStep` (NOT the linear nextStep) instead of halting. The
  // client just follows whatever `nextStep` a response carries, so looping
  // backward needs no special client-side case — but it DOES need `retry:
  // true` to know to increment its attempt counter rather than reset it (see
  // ReasoningPipelinePage.tsx) — two review steps in the same STEP_ORDER
  // position (a fresh pass vs. a loop-back) would otherwise be indistinguishable.
  function retryStep(step: StepId, generateStep: StepId, patch: Record<string, unknown>): Response {
    persist(step, patch, generateStep, false)
    return NextResponse.json({ step, patch, nextStep: generateStep, halted: false, retry: true })
  }

  // Only called for steps whose failure mode is 'hard-block' (steps.ts) once
  // MAX_REGENERATION_ATTEMPTS is exhausted; the dev-time check below guards
  // against a future edit adding a case here without updating
  // STEP_FAILURE_MODE, or vice versa.
  function halted(step: StepId, verdict: ReviewPanelVerdict, patch: Record<string, unknown>): Response {
    if (STEP_FAILURE_MODE[step] !== 'hard-block') {
      log.error('ai/reasoning/route', 'halted() called on a non-hard-block step', { step })
    }
    const failing = failingStandardIds(verdict)
    // attempt reflects however many tries this actually took — MAX_REGENERATION_ATTEMPTS
    // normally, or MASTER_REVIEW_ATTEMPT when the one master-guided try also failed
    // (tryMasterReviewOrHalt below).
    const haltReason = `${step} failed review after ${attempt} attempt${attempt === 1 ? '' : 's'}${run.masterReview?.forStep === step ? ' (including one master-reviewer-guided attempt)' : ''} — ${failing.length}/9 standards still failing (${failing.join(', ')}).`
    persist(step, patch, null, true, haltReason)
    return NextResponse.json({ step, patch, nextStep: null, halted: true, haltReason })
  }

  // Called instead of halted() when a hard-block layer's review still fails
  // at attempt === MAX_REGENERATION_ATTEMPTS (2026-08-11 addendum to 03-
  // orchestration-and-failure-handling.md): one last, master-guided attempt
  // before genuinely halting. A master reviewer sees all 9 standard verdicts
  // TOGETHER — something no single standard-reviewer does (orchestrator-
  // panel.ts's runReviewPanel, deliberately blind) — looks for a genuine
  // contradiction between them, and synthesizes one clear set of instructions
  // for the next *-generate call (via masterGuidance, threaded through the
  // matching generate case below) to follow instead of the raw 9-note dump.
  // Fires at most once per layer per run: run.masterReview.forStep already
  // matching `step` means this WAS that one extra attempt and it failed too
  // — no more chances, halt for real instead of looping forever.
  async function tryMasterReviewOrHalt(
    step: StepId,
    generateStep: StepId,
    artifact: unknown,
    verdict: ReviewPanelVerdict,
    context: string,
    patch: Record<string, unknown>
  ): Promise<Response> {
    if (run.masterReview?.forStep === step) {
      return halted(step, verdict, patch)
    }
    const guidance = await runMasterReview(verdict, artifact, context, dryRun)
    return retryStep(step, generateStep, { ...patch, masterReview: { forStep: step, guidance } })
  }

  try {
    // Phase 3 item 1's ad-hoc path: admin-triggered, not part of STEP_ORDER's
    // linear advance — handled before the switch below since it shares this
    // route's error handling but not ok()/retryStep()/halted()'s nextStep
    // semantics (there is no "next step" for an aside).
    if (step === 'context-gather-adhoc') {
      if (!atStep) return missing('atStep')
      const context = buildAdHocContext(run, atStep)
      const verdict = await runContextGather(context, dryRun, devForceNeedsInput)
      const adHocContextGathers = [...(run.adHocContextGathers ?? []), { atStep, verdict, answers: null }]
      persist(atStep, { adHocContextGathers }, atStep, false)
      return NextResponse.json({ step, patch: { adHocContextGathers }, nextStep: null, halted: false })
    }

    switch (step) {
      case 'context-gather-pre': {
        const verdict = await runContextGather(`Original question: ${run.originalQuery}`, dryRun, devForceNeedsInput)
        return ok(step, { contextGatherPre: verdict })
      }

      case 'frame-generate': {
        const masterGuidance =
          run.masterReview?.forStep === 'frame-review' && run.frame
            ? { priorFrame: run.frame, guidance: run.masterReview.guidance }
            : undefined
        const repair =
          !masterGuidance && run.frame && run.frameVerdict && !run.frameVerdict.overall_pass
            ? { priorFrame: run.frame, priorVerdict: run.frameVerdict }
            : undefined
        const userAnswers = formatContextGatherAnswers(run.contextGatherPre, run.contextGatherPreAnswers)
        const frame = await runFrameGenerate(run.originalQuery, dryRun, repair, userAnswers, masterGuidance)
        return ok(step, { frame })
      }

      case 'frame-review': {
        if (!run.frame) return missing('frame')
        const verdict = await runFrameReview(run.frame, dryRun, panelsOff)
        if (!verdict.overall_pass) {
          if (attempt < MAX_REGENERATION_ATTEMPTS) return retryStep(step, 'frame-generate', { frameVerdict: verdict })
          return tryMasterReviewOrHalt(
            step,
            'frame-generate',
            run.frame,
            verdict,
            `Original question: ${run.frame.original_query}`,
            { frameVerdict: verdict }
          )
        }
        return ok(step, { frameVerdict: verdict })
      }

      case 'context-gather-post': {
        if (!run.frame) return missing('frame')
        const verdict = await runContextGather(
          `${serializeFrame(run.frame, extraContext)}\n\nIs this frame complete enough to proceed?`,
          dryRun,
          devForceNeedsInput
        )
        return ok(step, { contextGatherPost: verdict })
      }

      case 'breadth-scoping': {
        if (!run.frame) return missing('frame')
        // Phase 2 dynamic budget enforcement (03-orchestration-and-failure-
        // handling.md "Budget enforcement"): shrink n below what the client
        // requested when the drafter lane is already under detected live
        // pressure, rather than starting a large fan-out into a lane that's
        // cascading. See drafterLaneStress() (lib/ai/router-state.ts).
        const stress = drafterLaneStress()
        const effectiveN = clampNForStress(capN, stress)
        if (effectiveN !== capN) {
          log.warn('ai/reasoning/route', 'drafter lane under stress — shrinking n pre-flight', {
            stress,
            requestedN: capN,
            effectiveN,
          })
        }
        const scoping = await runBreadthScoping(run.frame, effectiveN, dryRun, extraContext)
        return ok(step, { breadthScoping: scoping })
      }

      case 'perspectives-generate-stances': {
        if (!run.frame || !run.breadthScoping) return missing('frame/breadthScoping')
        const stances = await runPerspectivesGenerateStances(run.frame, run.breadthScoping, dryRun, extraContext)
        return ok(step, { perspectiveStances: stances })
      }

      case 'perspectives-generate-details': {
        if (!run.frame || !run.perspectiveStances) return missing('frame/perspectiveStances')
        const repair =
          run.perspectives && run.perspectiveVerdicts
            ? {
                priorBundles: run.perspectives,
                priorVerdicts: run.perspectiveVerdicts,
                priorAttempts: run.perspectiveAttempts ?? run.perspectives.map(() => 1),
              }
            : undefined
        const { bundles, attempts } = await runPerspectivesGenerateDetails(
          run.frame,
          run.perspectiveStances,
          dryRun,
          repair,
          extraContext
        )
        return ok(step, { perspectives: bundles, perspectiveAttempts: attempts })
      }

      case 'perspectives-review': {
        if (!run.frame || !run.perspectives) return missing('frame/perspectives')
        // Degrade-and-continue, per bundle: a bundle whose verdict still
        // fails after MAX_REGENERATION_ATTEMPTS is marked degraded, but a
        // bundle with retries left loops the WHOLE step back to regenerate
        // — never halts, even if every bundle is currently failing.
        const verdicts = await runPerspectivesReview(
          run.frame,
          run.perspectives,
          run.perspectiveVerdicts ?? null,
          run.perspectiveAttempts ?? null,
          dryRun,
          panelsOff,
          extraContext
        )
        const stillRetrying = verdicts.some((v) => !v.overall_pass && !v.degraded)
        if (stillRetrying) return retryStep(step, 'perspectives-generate-details', { perspectiveVerdicts: verdicts })
        return ok(step, { perspectiveVerdicts: verdicts })
      }

      case 'global-assumptions-generate': {
        if (!run.frame || !run.perspectives) return missing('frame/perspectives')
        const masterGuidance =
          run.masterReview?.forStep === 'global-assumptions-review' && run.globalAssumptions
            ? { priorArtifact: run.globalAssumptions, guidance: run.masterReview.guidance }
            : undefined
        const repair =
          !masterGuidance && run.globalAssumptions && run.globalAssumptionsVerdict && !run.globalAssumptionsVerdict.overall_pass
            ? { priorArtifact: run.globalAssumptions, priorVerdict: run.globalAssumptionsVerdict }
            : undefined
        const packet = await runGlobalAssumptionsGenerate(run.frame, run.perspectives, dryRun, repair, extraContext, masterGuidance)
        return ok(step, { globalAssumptions: packet })
      }

      case 'global-assumptions-review': {
        if (!run.frame || !run.perspectives || !run.globalAssumptions) return missing('frame/perspectives/globalAssumptions')
        const verdict = await runGlobalAssumptionsReview(
          run.frame,
          run.perspectives,
          run.globalAssumptions,
          dryRun,
          panelsOff,
          extraContext
        )
        if (!verdict.overall_pass) {
          if (attempt < MAX_REGENERATION_ATTEMPTS) {
            return retryStep(step, 'global-assumptions-generate', { globalAssumptionsVerdict: verdict })
          }
          return tryMasterReviewOrHalt(
            step,
            'global-assumptions-generate',
            run.globalAssumptions,
            verdict,
            questionContext(run.frame, run.perspectives, extraContext),
            { globalAssumptionsVerdict: verdict }
          )
        }
        return ok(step, { globalAssumptionsVerdict: verdict })
      }

      case 'global-evidence-generate': {
        if (!run.frame || !run.perspectives) return missing('frame/perspectives')
        const masterGuidance =
          run.masterReview?.forStep === 'global-evidence-review' && run.globalEvidence
            ? { priorArtifact: run.globalEvidence, guidance: run.masterReview.guidance }
            : undefined
        const repair =
          !masterGuidance && run.globalEvidence && run.globalEvidenceVerdict && !run.globalEvidenceVerdict.overall_pass
            ? { priorArtifact: run.globalEvidence, priorVerdict: run.globalEvidenceVerdict }
            : undefined
        const packet = await runGlobalEvidenceGenerate(run.frame, run.perspectives, dryRun, repair, extraContext, masterGuidance)
        return ok(step, { globalEvidence: packet })
      }

      case 'global-evidence-review': {
        if (!run.frame || !run.globalEvidence) return missing('frame/globalEvidence')
        const verdict = await runGlobalEvidenceReview(run.frame, run.globalEvidence, dryRun, panelsOff, extraContext)
        if (!verdict.overall_pass) {
          if (attempt < MAX_REGENERATION_ATTEMPTS) {
            return retryStep(step, 'global-evidence-generate', { globalEvidenceVerdict: verdict })
          }
          return tryMasterReviewOrHalt(
            step,
            'global-evidence-generate',
            run.globalEvidence,
            verdict,
            serializeFrame(run.frame, extraContext),
            { globalEvidenceVerdict: verdict }
          )
        }
        return ok(step, { globalEvidenceVerdict: verdict })
      }

      case 'conclusions-generate': {
        if (!run.frame || !run.perspectives || !run.globalAssumptions || !run.globalEvidence) {
          return missing('frame/perspectives/globalAssumptions/globalEvidence')
        }
        const masterGuidance =
          run.masterReview?.forStep === 'conclusions-review' && run.conclusions
            ? { priorArtifact: run.conclusions, guidance: run.masterReview.guidance }
            : undefined
        const repair =
          !masterGuidance && run.conclusions && run.conclusionsVerdict && !run.conclusionsVerdict.overall_pass
            ? { priorArtifact: run.conclusions, priorVerdict: run.conclusionsVerdict }
            : undefined
        const packet = await runConclusionsGenerate(
          run.frame,
          run.perspectives,
          run.globalAssumptions,
          run.globalEvidence,
          dryRun,
          repair,
          extraContext,
          masterGuidance
        )
        return ok(step, { conclusions: packet })
      }

      case 'conclusions-review': {
        if (!run.frame || !run.conclusions) return missing('frame/conclusions')
        const verdict = await runConclusionsReview(run.frame, run.conclusions, dryRun, panelsOff, extraContext)
        if (!verdict.overall_pass) {
          if (attempt < MAX_REGENERATION_ATTEMPTS) {
            return retryStep(step, 'conclusions-generate', { conclusionsVerdict: verdict })
          }
          return tryMasterReviewOrHalt(
            step,
            'conclusions-generate',
            run.conclusions,
            verdict,
            serializeFrame(run.frame, extraContext),
            { conclusionsVerdict: verdict }
          )
        }
        return ok(step, { conclusionsVerdict: verdict })
      }

      case 'implications-generate': {
        if (!run.frame || !run.conclusions) return missing('frame/conclusions')
        const degradedNotes = degradedPerspectiveNotes(run)
        const masterGuidance =
          run.masterReview?.forStep === 'implications-review' && run.implications
            ? { priorArtifact: run.implications, guidance: run.masterReview.guidance }
            : undefined
        const repair =
          !masterGuidance && run.implications && run.implicationsVerdict && !run.implicationsVerdict.overall_pass
            ? { priorArtifact: run.implications, priorVerdict: run.implicationsVerdict }
            : undefined
        const packet = await runImplicationsGenerate(
          run.frame,
          run.conclusions,
          degradedNotes,
          dryRun,
          repair,
          extraContext,
          masterGuidance
        )
        return ok(step, { implications: packet })
      }

      case 'implications-review': {
        if (!run.frame || !run.implications) return missing('frame/implications')
        const verdict = await runImplicationsReview(run.frame, run.implications, dryRun, panelsOff, extraContext)
        if (!verdict.overall_pass) {
          if (attempt < MAX_REGENERATION_ATTEMPTS) {
            return retryStep(step, 'implications-generate', { implicationsVerdict: verdict })
          }
          return tryMasterReviewOrHalt(
            step,
            'implications-generate',
            run.implications,
            verdict,
            serializeFrame(run.frame, extraContext),
            { implicationsVerdict: verdict }
          )
        }
        return ok(step, { implicationsVerdict: verdict })
      }

      case 'final-composition': {
        if (!run.frame || !run.implications) return missing('frame/implications')
        const finalAnswer = await runFinalComposition(run.frame, run.implications, dryRun, extraContext)
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
