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
// Admin-only (403 before any quota is spent).

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { AiError, drafterLaneStress } from '@/lib/ai/router'
import { isCallerAdmin } from '@/lib/auth/admin'
import { log } from '@/lib/log'
import { STEP_ORDER, type StepId, nextStep as nextStepAfter, STEP_FAILURE_MODE } from '@/lib/ai/reasoning/steps'
import { MIN_N, MAX_N_PHASE1, MAX_REGENERATION_ATTEMPTS, clampNForStress } from '@/lib/ai/reasoning/budget'
import { serializeFrame, serializePerspectives, formatContextGatherAnswers } from '@/lib/ai/reasoning/prompts'
import {
  ContextGatherVerdictSchema,
  ContextGatherAnswersSchema,
  AdHocContextGatherSchema,
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
import { persistRunStep, runStatusFrom } from '@/lib/ai/reasoning/persistence'

export const maxDuration = 30

// Larger than the draft route's 100KB — this run state accumulates n
// perspective bundles plus every packet/verdict produced so far, not one house.
const MAX_BODY_BYTES = 300 * 1024

const RunStateSchema = z.object({
  originalQuery: z.string().min(1).max(2000),
  contextGatherPre: ContextGatherVerdictSchema.nullish(),
  // Phase 3 item 1 (decision 019): the admin's answers to contextGatherPre's
  // questions_for_user, same index alignment. Threaded into frame-generate's
  // prompt only (orchestrator-setup.ts's userAnswers param) — never
  // re-threaded downstream via extraContext, since the resulting frame
  // already reflects them for everything after.
  contextGatherPreAnswers: ContextGatherAnswersSchema.nullish(),
  frame: FramePacketSchema.nullish(),
  frameVerdict: ReviewPanelVerdictSchema.nullish(),
  contextGatherPost: ContextGatherVerdictSchema.nullish(),
  // Threaded into every downstream generate/review call's context via
  // buildExtraContext below (serializeFrame's extraContext param) — the frame
  // itself is already locked by this checkpoint, so there's no "regenerate
  // frame" step for these to converge through the way contextGatherPreAnswers
  // does.
  contextGatherPostAnswers: ContextGatherAnswersSchema.nullish(),
  breadthScoping: BreadthScopingPacketSchema.nullish(),
  // Admin-triggered, ad-hoc context-gather calls (Phase 3 item 1's larger
  // scope — README's "any layer can trigger 'ask the user something'
  // mid-pipeline," confirmed with Samir 2026-08-04). Append-only; each
  // entry's `answers` starts null and is filled in once the admin resolves
  // it. Capped generously — bounded by how many times an admin actually
  // clicks the control, not a real limit.
  adHocContextGathers: z.array(AdHocContextGatherSchema).max(20).nullish(),
  perspectiveStances: z.array(PerspectiveStanceSchema).nullish(),
  perspectives: z.array(PerspectiveBundleSchema).nullish(),
  perspectiveVerdicts: z.array(ReviewPanelVerdictSchema).nullish(),
  // Per-bundle regeneration count (03-orchestration-and-failure-handling.md);
  // parallel to `perspectives`. Absent/null means "never regenerated yet."
  perspectiveAttempts: z.array(z.number().int()).nullish(),
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

// 'context-gather-adhoc' (Phase 3 item 1) is deliberately NOT part of
// STEP_ORDER — it's admin-triggered at whatever step the run is currently
// paused at, not a fixed position in the linear sequence, so it must never
// flow through nextStepAfter()/STEP_ORDER's indexOf-based advance logic the
// way every other step does.
const StepOrAdHocSchema = z.union([z.enum(STEP_ORDER), z.literal('context-gather-adhoc')])

const RequestSchema = z.object({
  step: StepOrAdHocSchema,
  // Client-generated once per pipeline run (crypto.randomUUID(), see
  // ReasoningPipelinePage.tsx's start()) and resent on every step call — the
  // persistence key for reasoning_runs (Phase 2 item 1, decision 019). Not
  // used for anything else; the route stays otherwise stateless per-request.
  runId: z.string().uuid(),
  capN: z.number().int().min(MIN_N).max(MAX_N_PHASE1).nullish(),
  dryRun: z.boolean().optional(),
  // Required only for step === 'context-gather-adhoc': which real step the
  // client was paused at/before when the admin triggered it — used both as
  // the ad-hoc call's own context ("where in the pipeline is this") and as
  // the `last_step` value persistRunStep records for it (persistence.ts
  // requires a real StepId, and 'context-gather-adhoc' itself isn't one).
  atStep: z.enum(STEP_ORDER).nullish(),
  // Dev-testing only (Phase 3 item 1): forces runContextGather's dryRun
  // branch to simulate needs_user_input: true instead of always false, so the
  // pause/ask/resume UI can be exercised for free. Never has any effect
  // outside dryRun — see orchestrator-setup.ts's runContextGather.
  devForceNeedsInput: z.boolean().optional(),
  // Decision 019 verification stage 3 (A/B the review panel,
  // 04-verification-and-open-questions.md): unlike dryRun, generation stays
  // real — only every runReviewPanel call is replaced with an auto-pass
  // verdict (orchestrator-panel.ts). Lets the same real question be run twice
  // (panels on vs. off) and compared for final-answer quality.
  panelsOff: z.boolean().optional(),
  // Which attempt (1-indexed) this is for the layer currently in flight — the
  // client increments it only across a regenerate-then-re-review loop-back
  // (see `retry` on the response below) and resets it to 1 on any genuinely
  // new layer. Read only by hard-block review steps to decide retry vs halt;
  // perspectives-review tracks its own per-bundle counts in run state instead
  // (a single scalar can't represent "n independent bundles' attempt counts").
  attempt: z.number().int().min(1).max(MAX_REGENERATION_ATTEMPTS).nullish(),
  run: RunStateSchema,
})

function failingStandardIds(verdict: ReviewPanelVerdict): string[] {
  return (Object.keys(verdict.standards) as (keyof ReviewPanelVerdict['standards'])[]).filter(
    (id) => !verdict.standards[id].pass
  )
}

function missing(what: string): Response {
  return NextResponse.json({ error: 'invalid-request', detail: `missing ${what} in run state` }, { status: 400 })
}

// Phase 3 item 1 (decision 019): folds context-gather-post's + every ad-hoc
// call's answers into one block for serializeFrame's extraContext param.
// contextGatherPre's answers are deliberately excluded — those already fold
// into frame-generate directly (see the frame-generate case below), so by the
// time this runs the frame itself already reflects them.
function buildExtraContext(run: RunState): string | null {
  const parts: string[] = []
  const post = formatContextGatherAnswers(run.contextGatherPost, run.contextGatherPostAnswers)
  if (post) parts.push(post)
  for (const gather of run.adHocContextGathers ?? []) {
    const text = formatContextGatherAnswers(gather.verdict, gather.answers)
    if (text) parts.push(`${text}\n(asked while paused at: ${gather.atStep})`)
  }
  return parts.length ? parts.join('\n\n') : null
}

// What an admin-triggered ad-hoc context-gather call (Phase 3 item 1) sees —
// whatever's accumulated so far, richest-available first. Reuses the same
// serialize* helpers every other step already calls; the closing line names
// where in the pipeline the admin paused, since CONTEXT_GATHER_BLOCK
// (prompts.ts) is otherwise layer-agnostic.
function buildAdHocContext(run: RunState, atStep: StepId): string {
  const parts = [`Original question: ${run.originalQuery}`]
  if (run.frame) parts.push(serializeFrame(run.frame, buildExtraContext(run)))
  if (run.perspectives) parts.push(`## Vetted perspectives\n${serializePerspectives(run.perspectives)}`)
  if (run.globalAssumptions) {
    parts.push(`## Global assumptions\n${run.globalAssumptions.question_level_assumptions.join('; ')}`)
  }
  if (run.globalEvidence) {
    parts.push(`## Global evidence\n${run.globalEvidence.question_level_evidence.map((e) => e.claim_id).join('; ')}`)
  }
  if (run.conclusions) parts.push(`## Conclusions\n${run.conclusions.conclusions.join('; ')}`)
  if (run.implications) parts.push(`## Implications\n${run.implications.implications.map((i) => i.text).join('; ')}`)
  parts.push(
    `The admin has manually paused the pipeline just before "${atStep}" to ask: is there anything essential still missing or ambiguous given everything produced so far?`
  )
  return parts.join('\n\n')
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
    const haltReason = `${step} failed review after ${MAX_REGENERATION_ATTEMPTS} attempts — ${failing.length}/9 standards still failing (${failing.join(', ')}).`
    persist(step, patch, null, true, haltReason)
    return NextResponse.json({ step, patch, nextStep: null, halted: true, haltReason })
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
        const repair =
          run.frame && run.frameVerdict && !run.frameVerdict.overall_pass
            ? { priorFrame: run.frame, priorVerdict: run.frameVerdict }
            : undefined
        const userAnswers = formatContextGatherAnswers(run.contextGatherPre, run.contextGatherPreAnswers)
        const frame = await runFrameGenerate(run.originalQuery, dryRun, repair, userAnswers)
        return ok(step, { frame })
      }

      case 'frame-review': {
        if (!run.frame) return missing('frame')
        const verdict = await runFrameReview(run.frame, dryRun, panelsOff)
        if (!verdict.overall_pass) {
          if (attempt < MAX_REGENERATION_ATTEMPTS) return retryStep(step, 'frame-generate', { frameVerdict: verdict })
          return halted(step, verdict, { frameVerdict: verdict })
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
        const repair =
          run.globalAssumptions && run.globalAssumptionsVerdict && !run.globalAssumptionsVerdict.overall_pass
            ? { priorArtifact: run.globalAssumptions, priorVerdict: run.globalAssumptionsVerdict }
            : undefined
        const packet = await runGlobalAssumptionsGenerate(run.frame, run.perspectives, dryRun, repair, extraContext)
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
          return halted(step, verdict, { globalAssumptionsVerdict: verdict })
        }
        return ok(step, { globalAssumptionsVerdict: verdict })
      }

      case 'global-evidence-generate': {
        if (!run.frame || !run.perspectives) return missing('frame/perspectives')
        const repair =
          run.globalEvidence && run.globalEvidenceVerdict && !run.globalEvidenceVerdict.overall_pass
            ? { priorArtifact: run.globalEvidence, priorVerdict: run.globalEvidenceVerdict }
            : undefined
        const packet = await runGlobalEvidenceGenerate(run.frame, run.perspectives, dryRun, repair, extraContext)
        return ok(step, { globalEvidence: packet })
      }

      case 'global-evidence-review': {
        if (!run.frame || !run.globalEvidence) return missing('frame/globalEvidence')
        const verdict = await runGlobalEvidenceReview(run.frame, run.globalEvidence, dryRun, panelsOff, extraContext)
        if (!verdict.overall_pass) {
          if (attempt < MAX_REGENERATION_ATTEMPTS) {
            return retryStep(step, 'global-evidence-generate', { globalEvidenceVerdict: verdict })
          }
          return halted(step, verdict, { globalEvidenceVerdict: verdict })
        }
        return ok(step, { globalEvidenceVerdict: verdict })
      }

      case 'conclusions-generate': {
        if (!run.frame || !run.perspectives || !run.globalAssumptions || !run.globalEvidence) {
          return missing('frame/perspectives/globalAssumptions/globalEvidence')
        }
        const repair =
          run.conclusions && run.conclusionsVerdict && !run.conclusionsVerdict.overall_pass
            ? { priorArtifact: run.conclusions, priorVerdict: run.conclusionsVerdict }
            : undefined
        const packet = await runConclusionsGenerate(
          run.frame,
          run.perspectives,
          run.globalAssumptions,
          run.globalEvidence,
          dryRun,
          repair,
          extraContext
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
          return halted(step, verdict, { conclusionsVerdict: verdict })
        }
        return ok(step, { conclusionsVerdict: verdict })
      }

      case 'implications-generate': {
        if (!run.frame || !run.conclusions) return missing('frame/conclusions')
        const degradedNotes = degradedPerspectiveNotes(run)
        const repair =
          run.implications && run.implicationsVerdict && !run.implicationsVerdict.overall_pass
            ? { priorArtifact: run.implications, priorVerdict: run.implicationsVerdict }
            : undefined
        const packet = await runImplicationsGenerate(run.frame, run.conclusions, degradedNotes, dryRun, repair, extraContext)
        return ok(step, { implications: packet })
      }

      case 'implications-review': {
        if (!run.frame || !run.implications) return missing('frame/implications')
        const verdict = await runImplicationsReview(run.frame, run.implications, dryRun, panelsOff, extraContext)
        if (!verdict.overall_pass) {
          if (attempt < MAX_REGENERATION_ATTEMPTS) {
            return retryStep(step, 'implications-generate', { implicationsVerdict: verdict })
          }
          return halted(step, verdict, { implicationsVerdict: verdict })
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

function degradedPerspectiveNotes(run: RunState): string[] {
  if (!run.perspectiveVerdicts) return []
  return run.perspectiveVerdicts
    .map((v, i) => (v.degraded ? `${run.perspectives?.[i]?.stance_label ?? v.subject_id}: review panel did not pass` : null))
    .filter((x): x is string => x !== null)
}
