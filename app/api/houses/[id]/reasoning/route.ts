// POST /api/houses/[id]/reasoning — the house-scoped reasoning pipeline's step
// dispatcher (plans/active/reasoning-pipeline/27-house-scoped-pipeline-
// integration.md; decision 019). Mirrors app/api/admin/reasoning/route.ts's
// shape almost exactly on purpose — same step dispatcher, same RequestSchema
// (imported, not duplicated, from the admin route's own route-schema.ts),
// same regenerate-then-re-review loop, same persistRunStep pattern — this file
// must NOT reinvent the step sequencing, only the gating. Do not modify
// app/api/admin/reasoning/route.ts to "share" this logic; the two routes are
// deliberately kept independent so this route's gating can never leak into
// the admin surface.
//
// Gating (the one real difference from the admin route):
//  - Caller must be signed in AND either own the house or be an 'editor'
//    collaborator (house_collaborators, migration 0004) — checked against the
//    CALLER's OWN session first (same authorization style as this branch's
//    app/api/collaborators/route.ts and app/api/share-link/route.ts), never
//    isCallerAdmin/lib/auth/admin.ts.
//  - capabilitiesFor(accountType).canAuthorDraft must be true — excludes
//    students, exactly matching Draft Mode's own restriction
//    (app/api/ai/draft/route.ts).
//
// No rate limit / quota on this route yet — Samir's explicit call, 2026-08-16
// (plan doc 27's "No rate limit" line): a real, known gap, not silently
// accepted. A coarse per-account cap (ai_usage/increment_ai_usage, migration
// 0011) belongs here before this is exposed beyond Samir personally testing
// it — matches this branch's own pattern of flagging deferred work in
// comments (see app/api/collaborators/route.ts's rate-limit comment) rather
// than omitting it silently.
//
// maxDuration/MAX_BODY_BYTES/the whole step switch below: kept in lockstep
// with app/api/admin/reasoning/route.ts — see that file's own header comment
// for the full rationale (Vercel Fluid Compute's real 300s ceiling, why every
// review-gated layer is split into generate+review steps, etc.). Changes
// there that aren't gating-related should be mirrored here too.

import { NextResponse, after } from 'next/server'
import { z } from 'zod'
import { AiError, drafterLaneStress } from '@/lib/ai/router'
import { createClient } from '@/lib/supabase/server'
import { getCallerCapabilities } from '@/lib/auth/account'
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
  runPerspectivesEvidenceStrategy,
  runPerspectivesEvidencePopulate,
  runPerspectivesEvidenceConfidence,
  runPerspectivesReview,
  PerspectivesGenerateError,
  collectEvidenceGatherUnits,
  flattenEvidenceGatherAnswers,
} from '@/lib/ai/reasoning/orchestrator-perspectives'
import {
  runGlobalAssumptionsGenerate,
  runGlobalAssumptionsReview,
  runGlobalEvidenceStrategy,
  runGlobalEvidencePopulate,
  runGlobalEvidenceConfidence,
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
} from '@/app/api/admin/reasoning/route-schema'

export const maxDuration = 280

const MAX_BODY_BYTES = 300 * 1024

const HouseIdSchema = z.string().uuid()

interface HouseAuthzRow {
  id: string
  owner_id: string
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id: houseIdParam } = await params
  const houseIdParsed = HouseIdSchema.safeParse(houseIdParam)
  if (!houseIdParsed.success) {
    return NextResponse.json({ error: 'invalid-request' }, { status: 400 })
  }
  const houseId = houseIdParsed.data

  // ── Authorization: caller's OWN session, not service role (style matches
  // app/api/collaborators/route.ts / app/api/share-link/route.ts) ───────────
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const { data: houseRow, error: houseError } = await supabase
    .from('houses')
    .select('id, owner_id')
    .eq('id', houseId)
    .maybeSingle()
  if (houseError) {
    log.error('houses/reasoning', 'house lookup failed', { error: houseError.message })
    return NextResponse.json({ error: 'server-error' }, { status: 500 })
  }
  if (!houseRow) {
    return NextResponse.json({ error: 'not-found' }, { status: 404 })
  }
  const house = houseRow as HouseAuthzRow

  let canEdit = house.owner_id === user.id
  if (!canEdit) {
    const { data: collabRow, error: collabError } = await supabase
      .from('house_collaborators')
      .select('role')
      .eq('house_id', houseId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (collabError) {
      log.error('houses/reasoning', 'collaborator lookup failed', { error: collabError.message })
      return NextResponse.json({ error: 'server-error' }, { status: 500 })
    }
    canEdit = (collabRow as { role: string } | null)?.role === 'editor'
  }
  if (!canEdit) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  // Draft Mode's own restriction, applied identically here (plan doc 27 §2):
  // excludes students. Checked after ownership/editor status so a stranger
  // gets 'forbidden' rather than leaking whether they'd otherwise qualify.
  const caps = await getCallerCapabilities()
  if (!caps.canAuthorDraft) {
    return NextResponse.json({ error: 'draft-not-available' }, { status: 403 })
  }

  // ── From here down: same step dispatcher as app/api/admin/reasoning/
  // route.ts, gating already done above. ─────────────────────────────────
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
  const extraContext = buildExtraContext(run)

  // Same persistence pattern as the admin route (see its own header comment
  // for the after()/Vercel-timing rationale) — the only difference is the
  // trailing houseId argument (persistence.ts's new optional param, 0038).
  function persist(patchStep: StepId, patch: Record<string, unknown>, nextStep: StepId | null, isHalted: boolean, haltReason?: string): void {
    if (dryRun) return
    after(() =>
      persistRunStep(
        runId,
        run.originalQuery,
        { ...run, ...patch },
        patchStep,
        runStatusFrom(nextStep, isHalted),
        haltReason,
        panelsOff,
        houseId
      )
    )
  }

  function ok(step: StepId, patch: Record<string, unknown>): Response {
    const nextStep = nextStepAfter(step)
    persist(step, patch, nextStep, false)
    return NextResponse.json({ step, patch, nextStep, halted: false })
  }

  function perspectivesFanOutFailure(step: StepId, err: PerspectivesGenerateError): Response {
    log.error('houses/reasoning', `${step} sub-element failure`, { failures: err.failures })
    persist(step, { lastSubElementFailures: err.failures }, step, false)
    return NextResponse.json({ error: 'ai-upstream-error', subElementFailures: err.failures }, { status: 502 })
  }

  function retryStep(step: StepId, generateStep: StepId, patch: Record<string, unknown>): Response {
    persist(step, patch, generateStep, false)
    return NextResponse.json({ step, patch, nextStep: generateStep, halted: false, retry: true })
  }

  function halted(step: StepId, verdict: ReviewPanelVerdict, patch: Record<string, unknown>): Response {
    if (STEP_FAILURE_MODE[step] !== 'hard-block') {
      log.error('houses/reasoning', 'halted() called on a non-hard-block step', { step })
    }
    const failing = failingStandardIds(verdict)
    const haltReason = `${step} failed review after ${attempt} attempt${attempt === 1 ? '' : 's'}${run.masterReview?.forStep === step ? ' (including one master-reviewer-guided attempt)' : ''} — ${failing.length}/9 standards still failing (${failing.join(', ')}).`
    persist(step, patch, null, true, haltReason)
    return NextResponse.json({ step, patch, nextStep: null, halted: true, haltReason })
  }

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
        const stress = drafterLaneStress()
        const effectiveN = clampNForStress(capN, stress)
        if (effectiveN !== capN) {
          log.warn('houses/reasoning', 'drafter lane under stress — shrinking n pre-flight', {
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
          run.perspectivePartials && run.perspectiveVerdicts
            ? {
                priorPartials: run.perspectivePartials,
                priorVerdicts: run.perspectiveVerdicts,
                priorAttempts: run.perspectiveAttempts ?? run.perspectiveStances.map(() => 1),
              }
            : undefined
        try {
          const partials = await runPerspectivesGenerateDetails(run.frame, run.perspectiveStances, dryRun, repair, extraContext)
          return ok(step, { perspectivePartials: partials, lastSubElementFailures: null })
        } catch (err) {
          if (err instanceof PerspectivesGenerateError) {
            return perspectivesFanOutFailure(step, err)
          }
          throw err
        }
      }

      case 'perspectives-evidence-strategy': {
        if (!run.frame || !run.perspectiveStances || !run.perspectivePartials) {
          return missing('frame/perspectiveStances/perspectivePartials')
        }
        const repair =
          run.perspectiveEvidenceStrategies && run.perspectiveVerdicts
            ? {
                priorStrategies: run.perspectiveEvidenceStrategies,
                priorPartials: run.perspectivePartials,
                priorVerdicts: run.perspectiveVerdicts,
              }
            : undefined
        try {
          const strategies = await runPerspectivesEvidenceStrategy(
            run.frame,
            run.perspectiveStances,
            dryRun,
            devForceNeedsInput,
            repair,
            extraContext
          )
          const units = collectEvidenceGatherUnits(run.perspectiveStances, strategies)
          return ok(step, {
            perspectiveEvidenceStrategies: strategies,
            perspectiveEvidenceGatherUnits: units.length ? units : null,
            perspectiveEvidenceGatherAnswers: units.length ? units.map(() => null) : null,
            lastSubElementFailures: null,
          })
        } catch (err) {
          if (err instanceof PerspectivesGenerateError) {
            return perspectivesFanOutFailure(step, err)
          }
          throw err
        }
      }

      case 'perspectives-evidence-populate': {
        if (!run.frame || !run.perspectiveStances || !run.perspectivePartials || !run.perspectiveEvidenceStrategies) {
          return missing('frame/perspectiveStances/perspectivePartials/perspectiveEvidenceStrategies')
        }
        const userAnswers =
          run.perspectiveEvidenceGatherUnits && run.perspectiveEvidenceGatherAnswers
            ? flattenEvidenceGatherAnswers(run.perspectiveStances, run.perspectiveEvidenceGatherUnits, run.perspectiveEvidenceGatherAnswers)
            : null
        const repair =
          run.perspectiveEvidenceDrafts && run.perspectiveVerdicts
            ? {
                priorDrafts: run.perspectiveEvidenceDrafts,
                priorPartials: run.perspectivePartials,
                priorVerdicts: run.perspectiveVerdicts,
              }
            : undefined
        try {
          const drafts = await runPerspectivesEvidencePopulate(
            run.frame,
            run.perspectiveStances,
            run.perspectiveEvidenceStrategies,
            userAnswers,
            dryRun,
            repair,
            extraContext
          )
          return ok(step, { perspectiveEvidenceDrafts: drafts, lastSubElementFailures: null })
        } catch (err) {
          if (err instanceof PerspectivesGenerateError) {
            return perspectivesFanOutFailure(step, err)
          }
          throw err
        }
      }

      case 'perspectives-evidence-confidence': {
        if (!run.frame || !run.perspectiveStances || !run.perspectivePartials || !run.perspectiveEvidenceDrafts) {
          return missing('frame/perspectiveStances/perspectivePartials/perspectiveEvidenceDrafts')
        }
        const repair =
          run.perspectives && run.perspectiveVerdicts
            ? {
                priorBundles: run.perspectives,
                priorVerdicts: run.perspectiveVerdicts,
                priorAttempts: run.perspectiveAttempts ?? run.perspectiveStances.map(() => 1),
              }
            : undefined
        try {
          const { bundles, attempts } = await runPerspectivesEvidenceConfidence(
            run.frame,
            run.perspectiveStances,
            run.perspectivePartials,
            run.perspectiveEvidenceDrafts,
            dryRun,
            repair,
            extraContext
          )
          return ok(step, { perspectives: bundles, perspectiveAttempts: attempts, lastSubElementFailures: null })
        } catch (err) {
          if (err instanceof PerspectivesGenerateError) {
            return perspectivesFanOutFailure(step, err)
          }
          throw err
        }
      }

      case 'perspectives-review': {
        if (!run.frame || !run.perspectives) return missing('frame/perspectives')
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

      case 'global-evidence-strategy': {
        if (!run.frame || !run.perspectives) return missing('frame/perspectives')
        const masterGuidance =
          run.masterReview?.forStep === 'global-evidence-review' && run.globalEvidence
            ? { priorArtifact: run.globalEvidence, guidance: run.masterReview.guidance }
            : undefined
        const repair =
          !masterGuidance && run.globalEvidence && run.globalEvidenceVerdict && !run.globalEvidenceVerdict.overall_pass
            ? { priorArtifact: run.globalEvidence, priorVerdict: run.globalEvidenceVerdict }
            : undefined
        const strategy = await runGlobalEvidenceStrategy(
          run.frame,
          run.perspectives,
          dryRun,
          devForceNeedsInput,
          repair,
          extraContext,
          masterGuidance
        )
        const unit = strategy.needs_user_input
          ? { unitId: 'global', unitLabel: 'Global evidence', reason: strategy.reason, questions: strategy.questions_for_user }
          : null
        return ok(step, {
          globalEvidenceStrategy: strategy,
          globalEvidenceGatherUnit: unit,
          globalEvidenceGatherAnswer: null,
        })
      }

      case 'global-evidence-populate': {
        if (!run.frame || !run.perspectives || !run.globalEvidenceStrategy) {
          return missing('frame/perspectives/globalEvidenceStrategy')
        }
        const masterGuidance =
          run.masterReview?.forStep === 'global-evidence-review' && run.globalEvidence
            ? { priorArtifact: run.globalEvidence, guidance: run.masterReview.guidance }
            : undefined
        const repair =
          !masterGuidance && run.globalEvidence && run.globalEvidenceVerdict && !run.globalEvidenceVerdict.overall_pass
            ? { priorArtifact: run.globalEvidence, priorVerdict: run.globalEvidenceVerdict }
            : undefined
        const userAnswer = run.globalEvidenceGatherAnswer?.find((a) => a != null) ?? null
        const draft = await runGlobalEvidencePopulate(
          run.frame,
          run.perspectives,
          run.globalEvidenceStrategy,
          userAnswer,
          dryRun,
          repair,
          extraContext,
          masterGuidance
        )
        return ok(step, { globalEvidenceDraft: draft })
      }

      case 'global-evidence-confidence': {
        if (!run.frame || !run.globalEvidenceDraft) return missing('frame/globalEvidenceDraft')
        const masterGuidance =
          run.masterReview?.forStep === 'global-evidence-review' && run.globalEvidence
            ? { priorArtifact: run.globalEvidence, guidance: run.masterReview.guidance }
            : undefined
        const repair =
          !masterGuidance && run.globalEvidence && run.globalEvidenceVerdict && !run.globalEvidenceVerdict.overall_pass
            ? { priorArtifact: run.globalEvidence, priorVerdict: run.globalEvidenceVerdict }
            : undefined
        const packet = await runGlobalEvidenceConfidence(run.frame, run.globalEvidenceDraft, dryRun, repair, extraContext, masterGuidance)
        return ok(step, { globalEvidence: packet })
      }

      case 'global-evidence-review': {
        if (!run.frame || !run.globalEvidence) return missing('frame/globalEvidence')
        const verdict = await runGlobalEvidenceReview(run.frame, run.globalEvidence, dryRun, panelsOff, extraContext)
        if (!verdict.overall_pass) {
          if (attempt < MAX_REGENERATION_ATTEMPTS) {
            return retryStep(step, 'global-evidence-strategy', { globalEvidenceVerdict: verdict })
          }
          return tryMasterReviewOrHalt(
            step,
            'global-evidence-strategy',
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
    const patchStep = step === 'context-gather-adhoc' ? atStep : step
    const message = err instanceof AiError ? err.message : (err as Error)?.message || 'unknown error'
    if (patchStep) persist(patchStep, {}, patchStep, false, `${patchStep} threw: ${message}`)
    if (err instanceof AiError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    log.error('houses/reasoning', 'unhandled error', { step, error: message })
    return NextResponse.json({ error: 'ai-upstream-error' }, { status: 502 })
  }
}
