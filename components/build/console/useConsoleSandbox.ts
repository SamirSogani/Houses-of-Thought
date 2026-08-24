'use client'

// Sandbox-rerun UI orchestration for the console (Loop C, plan doc
// plans/active/reasoning-pipeline/31-console-sandbox-reruns.md). Mirrors
// useConsoleChats.ts/useConsoleCandidate.ts's own split: ConsolePage stays a
// thin wiring layer, this hook owns the "preview clicked" state, the
// promote/discard busy state, and — the one piece of real logic here —
// Trap 5's "promote reuses the same dispatch+save path a real rerun's
// completion already uses, never a second engine."
//
// Why promote defers save() through an effect instead of calling it right
// after dispatch(): useReasoningPipelineRunner's own real-rerun completion
// works because ConsolePage's `runner.phase === 'done'` effect runs AFTER
// the render that committed the dispatched state (dispatch + setPhase('done')
// are batched into one re-render; stateRef.current = state, assigned during
// render, is therefore already current by the time that effect's `save()`
// call reads it). A plain onClick handler calling dispatch() then save() in
// the SAME synchronous call does NOT have that guarantee — save() would read
// stateRef.current from BEFORE this dispatch. promote() below reproduces the
// same "dispatch, then let a render happen, then save" shape via its own
// pendingPromote effect, rather than risking a stale write.

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Action, State } from '@/lib/build/types'
import { mapReasoningRunToActions } from '@/lib/ai/reasoning/houseMapping'
import { serializeContent } from '@/lib/build/persistence'
import { cascadeStages, type RerunProposal } from '@/lib/ai/console'
import type { RunState } from '@/components/admin/reasoning/ReasoningStagesList'
import type { ReasoningPipelineRunner } from '../useReasoningPipelineRunner'
import type { UseConsoleCandidate } from './useConsoleCandidate'

// The chat that asked for this preview, captured at click time — NOT the
// live ?chat= param, which can change while a sandbox run (started from one
// chat) is still in flight after the person navigates to another (Trap:
// "which chat owns a candidate" must not silently become whichever chat
// happens to be open when the run finishes).
interface ConfirmingSandbox {
  turnId: string
  proposal: RerunProposal
  chatId: string
}

export function useConsoleSandbox({
  runner,
  dispatch,
  save,
  stateRef,
  candidateHook,
}: {
  runner: ReasoningPipelineRunner
  dispatch: React.Dispatch<Action>
  save: () => Promise<void>
  stateRef: React.MutableRefObject<State>
  candidateHook: UseConsoleCandidate
}) {
  const [confirmingSandbox, setConfirmingSandbox] = useState<ConfirmingSandbox | null>(null)
  const [promoting, setPromoting] = useState(false)
  const [discarding, setDiscarding] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [pendingPromoteRunId, setPendingPromoteRunId] = useState<string | null>(null)

  // Captured at the moment the sandbox run STARTS (serializeContent(state)
  // right then), not when it finishes — the diff/staleness baseline doc 31
  // specifies. A ref, not state: nothing needs to re-render off this value.
  const baseContentRef = useRef<Record<string, unknown> | null>(null)

  function previewSandbox(turnId: string, proposal: RerunProposal, chatId: string) {
    setActionError(null)
    setConfirmingSandbox({ turnId, proposal, chatId })
  }

  function startSandbox(persistedRunState: RunState) {
    if (!confirmingSandbox) return
    baseContentRef.current = JSON.parse(serializeContent(stateRef.current)) as Record<string, unknown>
    const { proposal } = confirmingSandbox
    runner.rerunSandbox(persistedRunState, proposal.stage, proposal.reason, proposal.guidance)
  }

  function closeSandboxPreview() {
    setConfirmingSandbox(null)
    runner.reset()
  }

  // Called from ConsolePage's own runner.phase === 'done' effect, once it
  // sees runner.sandboxMode — attaches this chat/stage/baseContent to the
  // run reasoning_runs already persisted (is_candidate: true from its very
  // first step), turning it into an addressable, diffable candidate.
  const finalizeIfSandbox = useCallback(async (): Promise<void> => {
    if (!confirmingSandbox || !baseContentRef.current) return
    const { chatId, proposal } = confirmingSandbox
    const result = await candidateHook.finalize({
      runId: runner.runId,
      chatId,
      stage: proposal.stage,
      baseContent: baseContentRef.current,
    })
    if (!result.ok) setActionError('Could not save this sandbox run — try again.')
    setConfirmingSandbox(null)
    baseContentRef.current = null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmingSandbox, runner.runId])

  // Trap 5: apply the already-computed candidate to the LIVE house via the
  // exact same reducer action a real rerun's completion dispatches — no
  // pipeline step is invoked here. See this file's own header comment for
  // why the actual save() is deferred to the effect below rather than
  // called inline.
  function promote() {
    if (!candidateHook.candidate || promoting) return
    const { candidate } = candidateHook
    const stages = cascadeStages(candidate.stage)
    const actions = mapReasoningRunToActions(candidate.runState as RunState)
    dispatch({ type: 'APPLY_RERUN_RESULT', stages, actions })
    setPromoting(true)
    setActionError(null)
    setPendingPromoteRunId(candidate.runId)
  }

  useEffect(() => {
    if (!pendingPromoteRunId) return
    const runId = pendingPromoteRunId
    // Consumes the trigger so this effect doesn't fire again for the same
    // value — same react-hooks/set-state-in-effect tradeoff
    // useConsoleChats.ts/useConsoleCandidate.ts's own mount effects already
    // accept elsewhere in this file family, not a new one introduced here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPendingPromoteRunId(null)
    ;(async () => {
      await save()
      const result = await candidateHook.promote(runId)
      if (!result.ok) setActionError('Applied to the house, but could not mark the candidate resolved — refresh to check.')
      setPromoting(false)
      // Same reason as discard() below: the finished sandbox run leaves the
      // shared runner at phase 'done', which keeps every rerun/sandbox
      // trigger disabled until the page reloads.
      runner.reset()
    })()
    // Intentionally scoped to pendingPromoteRunId only — same shape as
    // ConsolePage's own runner.phase effect (deliberately not exhaustive:
    // save/candidateHook.promote are stable enough for this one-shot use).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPromoteRunId])

  async function discard() {
    if (discarding) return
    setDiscarding(true)
    setActionError(null)
    const result = await candidateHook.discard()
    if (!result.ok) setActionError('Could not discard — try again.')
    setDiscarding(false)
    // The sandbox run left the shared runner parked at phase 'done'. Nothing
    // else clears it, and ConsolePage derives rerunActive from it — so
    // without this both "Preview this rerun" and "Preview as sandbox" stay
    // disabled for the rest of the page's life, and only a reload frees
    // them. closeSandboxPreview already does this for the cancel path;
    // resolving a candidate has to as well.
    runner.reset()
  }

  return {
    confirmingSandbox,
    promoting,
    discarding,
    actionError,
    previewSandbox,
    startSandbox,
    closeSandboxPreview,
    finalizeIfSandbox,
    promote,
    discard,
  }
}

export type UseConsoleSandbox = ReturnType<typeof useConsoleSandbox>
