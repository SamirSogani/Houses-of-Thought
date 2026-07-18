'use client'

// Draft Mode's client stage loop (decision 016 §4). Lives in BuildHousePage —
// NOT in the rail — so tab switches and the mobile drawer can't kill a draft in
// progress (CopilotPanel unmounts on tab change; this hook doesn't).
//
// The loop is driven by persisted state, not local sequencing: each effect run
// fires ONE request for state.draft.stage; the reducer's APPLY_DRAFT_STAGE
// advances the stage, which re-fires the effect for the next one. Pause simply
// stops firing (and aborts the in-flight call — the stage no-ops and re-runs on
// resume); progress survives reloads because draft is autosaved with the house.

import { useEffect, useRef, useState } from 'react'
import type { Action, State } from '@/lib/build/types'
import type { AiAction } from '@/lib/ai/findings'
import type { DraftStage } from '@/lib/ai/draft'
import { serializeContent } from '@/lib/build/persistence'

export interface DraftRunner {
  running: boolean
  errorCode: string | null
  start: () => void
  pause: () => void
  stop: () => void
}

export function useDraftRunner(
  state: State,
  dispatch: React.Dispatch<Action>,
  enabled: boolean,
  // Sent with every stage call so the route can refuse Draft Mode on assignment
  // submissions server-side (bl-H5) — the client gate alone is cosmetic.
  houseId?: string
): DraftRunner {
  const [running, setRunning] = useState(false)
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const stateRef = useRef(state)
  stateRef.current = state

  const stage = state.draft?.stage ?? null

  useEffect(() => {
    if (!enabled || !running) return
    if (!stage || stage === 'done') {
      setRunning(false)
      return
    }

    let cancelled = false
    const controller = new AbortController()
    abortRef.current = controller

    ;(async () => {
      try {
        const s = stateRef.current
        const res = await fetch('/api/ai/draft', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            house: JSON.parse(serializeContent(s)),
            stage,
            aiContext: s.aiContext,
            houseId: houseId ?? null,
          }),
          signal: controller.signal,
        })
        if (cancelled) return
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string }
          setErrorCode(body.error ?? 'ai-upstream-error')
          setRunning(false)
          return
        }
        const data = (await res.json()) as { stage: DraftStage; actions: AiAction[] }
        if (!cancelled) dispatch({ type: 'APPLY_DRAFT_STAGE', stage: data.stage, actions: data.actions })
      } catch (err) {
        if ((err as Error)?.name === 'AbortError' || cancelled) return
        setErrorCode('ai-network-error')
        setRunning(false)
      }
    })()

    return () => {
      cancelled = true
      controller.abort()
    }
    // stage advancing is what drives the loop from one call to the next.
  }, [enabled, running, stage, dispatch, houseId])

  function start() {
    setErrorCode(null)
    if (!stateRef.current.draft) dispatch({ type: 'START_DRAFT' })
    setRunning(true)
  }

  function pause() {
    setRunning(false)
    abortRef.current?.abort()
  }

  function stop() {
    setRunning(false)
    abortRef.current?.abort()
    dispatch({ type: 'STOP_DRAFT' })
  }

  return { running, errorCode, start, pause, stop }
}
