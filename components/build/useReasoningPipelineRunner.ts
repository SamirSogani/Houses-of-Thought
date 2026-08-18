'use client'

// House-scoped reasoning pipeline's client stage loop (plan doc
// plans/active/reasoning-pipeline/27-house-scoped-pipeline-integration.md
// §2). Adapted from components/admin/reasoning/ReasoningPipelinePage.tsx's
// step-loop effect — same "resend the whole RunState, merge the response's
// patch, advance" pattern — reshaped into a hook so it can live in
// BuildHousePage (survives tab switches / the mobile drawer closing, same
// rationale as useDraftRunner.ts) and drive the embedded
// ReasoningPipelineCard instead of a standalone admin page.
//
// Differences from the admin page's version (judgment calls, not oversights):
//  - houseId-scoped: calls POST /api/houses/[id]/reasoning, not the admin
//    route.
//  - dryRun/panelsOff/devForceNeedsInput are never exposed here — this is the
//    real thing for a real house, not a dev-testing surface.
//  - n (perspective count) is fixed at HOUSE_PIPELINE_N, not user-selectable
//    — the embedded UI has no room for (and this route has no rate limit
//    yet to justify exposing) a cost dial the way the admin form's n-picker
//    does.
//  - No ad-hoc "ask a clarifying question while paused" affordance — the
//    admin page's askClarifyingQuestion() has no equivalent here; scoped out
//    to keep the embedded surface simple. Pause/resume/reset (start over)
//    cover the same ground for a first version.
//  - On the run's genuine completion (nextStep === null, not halted), this
//    hook itself dispatches APPLY_REASONING_RESULT with the mapped actions
//    (lib/ai/reasoning/houseMapping.ts) — the admin page has no house to
//    write into, so it has nothing analogous.

import { useEffect, useRef, useState } from 'react'
import type { Action } from '@/lib/build/types'
import { isReviewStep, type StepId } from '@/lib/ai/reasoning/steps'
import { MIN_N } from '@/lib/ai/reasoning/budget'
import type { ContextGatherVerdict, EvidenceGatherUnit, SubElementFailure } from '@/lib/ai/reasoning/contracts'
import type { RunState } from '@/components/admin/reasoning/ReasoningStagesList'
import { mapReasoningRunToActions } from '@/lib/ai/reasoning/houseMapping'

export type ReasoningPipelinePhase = 'idle' | 'running' | 'paused' | 'awaiting-input' | 'halted' | 'done'

export interface PendingGather {
  origin: 'pre' | 'post'
  verdict: ContextGatherVerdict
  resumeStep: StepId | null
}

export interface PendingEvidenceGather {
  kind: 'perspectives' | 'global'
  units: EvidenceGatherUnit[]
  resumeStep: StepId | null
}

interface StepResponse {
  step: StepId
  patch: Partial<RunState>
  nextStep: StepId | null
  halted: boolean
  haltReason?: string
  retry?: boolean
}

// Same bounded wait-then-retry model as the admin page (decision 019's "2
// retries/3 attempts") — see that file's comment for why this is short, not
// long: the whole loop must fit inside this route's serverless budget.
const RATE_LIMIT_RETRY_DELAYS_MS = [5_000, 15_000]
const MAX_STEP_ATTEMPTS = RATE_LIMIT_RETRY_DELAYS_MS.length + 1

// Fixed, not user-selectable — see module comment above.
const HOUSE_PIPELINE_N = MIN_N

export interface ReasoningPipelineRunner {
  phase: ReasoningPipelinePhase
  step: StepId | null
  run: RunState
  pendingGather: PendingGather | null
  pendingEvidenceGather: PendingEvidenceGather | null
  errorCode: string | null
  subElementFailures: SubElementFailure[] | null
  haltReason: string | null
  retryInfo: { attempt: number; waitMs: number } | null
  regenerationInfo: { attempt: number } | null
  start: (question: string) => void
  pause: () => void
  resume: () => void
  reset: () => void
  resolvePendingGather: (answers: (string | null)[]) => void
  skipPendingGather: () => void
  resolvePendingEvidenceGather: (answersPerUnit: (string | null)[][]) => void
  skipPendingEvidenceGather: () => void
}

export function useReasoningPipelineRunner(
  dispatch: React.Dispatch<Action>,
  houseId: string | undefined
): ReasoningPipelineRunner {
  const [phase, setPhase] = useState<ReasoningPipelinePhase>('idle')
  const [step, setStep] = useState<StepId | null>(null)
  const [run, setRun] = useState<RunState>({ originalQuery: '' })
  const [pendingGather, setPendingGather] = useState<PendingGather | null>(null)
  const [pendingEvidenceGather, setPendingEvidenceGather] = useState<PendingEvidenceGather | null>(null)
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [subElementFailures, setSubElementFailures] = useState<SubElementFailure[] | null>(null)
  const [haltReason, setHaltReason] = useState<string | null>(null)
  const [retryInfo, setRetryInfo] = useState<{ attempt: number; waitMs: number } | null>(null)
  const [regenerationInfo, setRegenerationInfo] = useState<{ attempt: number } | null>(null)

  const runIdRef = useRef('')
  const runRef = useRef(run)
  runRef.current = run
  const layerAttemptRef = useRef(1)
  const dispatchRef = useRef(dispatch)
  dispatchRef.current = dispatch

  useEffect(() => {
    if (phase !== 'running' || !step || !houseId) return
    let cancelled = false
    const controller = new AbortController()

    ;(async () => {
      for (let attempt = 1; attempt <= MAX_STEP_ATTEMPTS; attempt++) {
        try {
          const res = await fetch(`/api/houses/${houseId}/reasoning`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              step,
              runId: runIdRef.current,
              capN: HOUSE_PIPELINE_N,
              attempt: layerAttemptRef.current,
              run: runRef.current,
            }),
            signal: controller.signal,
          })
          if (cancelled) return
          if (!res.ok) {
            const body = (await res.json().catch(() => ({}))) as {
              error?: string
              subElementFailures?: SubElementFailure[]
            }
            const code = body.error ?? 'ai-upstream-error'
            const waitMs = RATE_LIMIT_RETRY_DELAYS_MS[attempt - 1]
            if (code === 'ai-rate-limited' && waitMs !== undefined) {
              setRetryInfo({ attempt, waitMs })
              await new Promise((resolve) => setTimeout(resolve, waitMs))
              if (cancelled) return
              continue
            }
            setRetryInfo(null)
            setErrorCode(code)
            setSubElementFailures(body.subElementFailures ?? null)
            setPhase('paused')
            return
          }
          setRetryInfo(null)
          setSubElementFailures(null)
          const data = (await res.json()) as StepResponse
          setRun((prev) => ({ ...prev, ...data.patch }))

          const gatherVerdict =
            step === 'context-gather-pre'
              ? data.patch.contextGatherPre
              : step === 'context-gather-post'
                ? data.patch.contextGatherPost
                : undefined
          if (gatherVerdict?.needs_user_input) {
            setPendingGather({
              origin: step === 'context-gather-pre' ? 'pre' : 'post',
              verdict: gatherVerdict,
              resumeStep: data.nextStep,
            })
            setPhase('awaiting-input')
            return
          }

          if (step === 'perspectives-evidence-strategy' && data.patch.perspectiveEvidenceGatherUnits?.length) {
            setPendingEvidenceGather({
              kind: 'perspectives',
              units: data.patch.perspectiveEvidenceGatherUnits,
              resumeStep: data.nextStep,
            })
            setPhase('awaiting-input')
            return
          }
          if (step === 'global-evidence-strategy' && data.patch.globalEvidenceGatherUnit) {
            setPendingEvidenceGather({
              kind: 'global',
              units: [data.patch.globalEvidenceGatherUnit],
              resumeStep: data.nextStep,
            })
            setPhase('awaiting-input')
            return
          }

          if (data.retry) {
            layerAttemptRef.current += 1
            setRegenerationInfo({ attempt: layerAttemptRef.current })
          } else if (isReviewStep(step)) {
            layerAttemptRef.current = 1
            setRegenerationInfo(null)
          }
          if (data.halted) {
            setHaltReason(data.haltReason ?? 'Pipeline halted.')
            setPhase('halted')
            return
          }
          if (data.nextStep === null) {
            // final-composition just landed — map every finished packet into
            // the house as one unclaimed draft batch (plan doc 27 §3) before
            // settling. mapReasoningRunToActions deliberately never touches
            // houses.question/conclusion/reasoning — see that module's own
            // header comment for why.
            const finished = { ...runRef.current, ...data.patch }
            const actions = mapReasoningRunToActions(finished)
            if (actions.length > 0) {
              dispatchRef.current({ type: 'APPLY_REASONING_RESULT', actions })
            }
            setPhase('done')
            return
          }
          setStep(data.nextStep)
          return
        } catch (err) {
          if ((err as Error)?.name === 'AbortError' || cancelled) return
          setRetryInfo(null)
          setErrorCode('ai-network-error')
          setPhase('paused')
          return
        }
      }
    })()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [phase, step, houseId])

  function start(question: string) {
    const q = question.trim()
    if (!q || !houseId) return
    runIdRef.current = crypto.randomUUID()
    setRun({ originalQuery: q })
    setErrorCode(null)
    setSubElementFailures(null)
    setHaltReason(null)
    setRetryInfo(null)
    setRegenerationInfo(null)
    setPendingGather(null)
    setPendingEvidenceGather(null)
    layerAttemptRef.current = 1
    setStep('context-gather-pre')
    setPhase('running')
  }

  function pause() {
    setPhase('paused')
    setRetryInfo(null)
  }

  function resume() {
    setErrorCode(null)
    setRetryInfo(null)
    setPhase('running')
  }

  function reset() {
    setPhase('idle')
    setStep(null)
    setRun({ originalQuery: '' })
    setErrorCode(null)
    setSubElementFailures(null)
    setHaltReason(null)
    setRetryInfo(null)
    setRegenerationInfo(null)
    setPendingGather(null)
    setPendingEvidenceGather(null)
    layerAttemptRef.current = 1
  }

  function resolvePendingGather(answers: (string | null)[]) {
    if (!pendingGather) return
    const { origin, resumeStep } = pendingGather
    setRun((prev) =>
      origin === 'pre' ? { ...prev, contextGatherPreAnswers: answers } : { ...prev, contextGatherPostAnswers: answers }
    )
    setPendingGather(null)
    setPhase('running')
    setStep(resumeStep)
  }

  function skipPendingGather() {
    if (!pendingGather) return
    resolvePendingGather(pendingGather.verdict.questions_for_user.map(() => null))
  }

  function resolvePendingEvidenceGather(answersPerUnit: (string | null)[][]) {
    if (!pendingEvidenceGather) return
    const { kind, resumeStep } = pendingEvidenceGather
    setRun((prev) =>
      kind === 'perspectives'
        ? { ...prev, perspectiveEvidenceGatherAnswers: answersPerUnit }
        : { ...prev, globalEvidenceGatherAnswer: answersPerUnit[0] ?? null }
    )
    setPendingEvidenceGather(null)
    setPhase('running')
    setStep(resumeStep)
  }

  function skipPendingEvidenceGather() {
    if (!pendingEvidenceGather) return
    resolvePendingEvidenceGather(pendingEvidenceGather.units.map((u) => u.questions.map(() => null)))
  }

  return {
    phase,
    step,
    run,
    pendingGather,
    pendingEvidenceGather,
    errorCode,
    subElementFailures,
    haltReason,
    retryInfo,
    regenerationInfo,
    start,
    pause,
    resume,
    reset,
    resolvePendingGather,
    skipPendingGather,
    resolvePendingEvidenceGather,
    skipPendingEvidenceGather,
  }
}
