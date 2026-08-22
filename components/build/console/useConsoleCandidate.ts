'use client'

// Candidate state + CRUD for Loop C's sandbox reruns (plan doc
// plans/active/reasoning-pipeline/31-console-sandbox-reruns.md). Mirrors
// useConsoleChats.ts's own shape (fetch on mount, refetch/replace local
// state after each mutation) — a house has at most ONE live candidate
// (0043's partial unique index), so there is no list to keep in sync, just
// one nullable summary.

import { useCallback, useEffect, useRef, useState } from 'react'
import type { CandidateSummary, FinalizeCandidateRequest } from '@/lib/ai/console'

export type CandidateLoadState = 'loading' | 'loaded' | 'error'

export interface MutationResult {
  ok: boolean
  error?: string
}

export interface UseConsoleCandidate {
  candidate: CandidateSummary | null
  loadState: CandidateLoadState
  refresh: () => Promise<void>
  finalize: (body: FinalizeCandidateRequest) => Promise<MutationResult>
  promote: (runId: string) => Promise<MutationResult>
  discard: () => Promise<MutationResult>
}

export function useConsoleCandidate(houseId: string): UseConsoleCandidate {
  const [candidate, setCandidate] = useState<CandidateSummary | null>(null)
  const [loadState, setLoadState] = useState<CandidateLoadState>('loading')

  // Same StrictMode-remount guard as useConsoleChats' own mountedRef — must
  // be re-armed on mount, not just disarmed on unmount.
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const refresh = useCallback(async (): Promise<void> => {
    setLoadState((s) => (s === 'loaded' ? 'loaded' : 'loading'))
    try {
      const res = await fetch(`/api/houses/${houseId}/console/candidate`)
      if (!res.ok) throw new Error('candidate load failed')
      const data = (await res.json()) as { candidate: CandidateSummary | null }
      if (!mountedRef.current) return
      setCandidate(data.candidate)
      setLoadState('loaded')
    } catch {
      if (mountedRef.current) setLoadState('error')
    }
  }, [houseId])

  // Same fetch-on-mount shape as useConsoleChats.ts's own refresh()
  // effect (and the same lint tradeoff it already accepts, unfixed,
  // elsewhere in this codebase) — refresh's setState calls are reached
  // through this effect, which the newer react-hooks/set-state-in-effect
  // rule flags even though they only ever run after the fetch resolves,
  // never synchronously during the effect itself.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh()
  }, [refresh])

  // Called once by ConsolePage right after a sandbox run reaches phase:
  // 'done' — attaches chat/stage/baseContent to the already-persisted run so
  // it becomes an addressable, diffable candidate.
  const finalize = useCallback(
    async (body: FinalizeCandidateRequest): Promise<MutationResult> => {
      try {
        const res = await fetch(`/api/houses/${houseId}/console/candidate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res.ok) {
          const errBody = (await res.json().catch(() => ({}))) as { error?: string }
          return { ok: false, error: errBody.error ?? 'server-error' }
        }
        const data = (await res.json()) as { candidate: CandidateSummary }
        setCandidate(data.candidate)
        return { ok: true }
      } catch {
        return { ok: false, error: 'network-error' }
      }
    },
    [houseId]
  )

  // The caller (ConsolePage) has ALREADY applied the candidate to the live
  // house (dispatch + save) before calling this — this only tells the
  // server to resolve the row and post the completion marker (Trap 5/6, doc
  // 31). Never re-runs anything.
  const promote = useCallback(
    async (runId: string): Promise<MutationResult> => {
      try {
        const res = await fetch(`/api/houses/${houseId}/console/candidate/promote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ runId }),
        })
        if (!res.ok) {
          const errBody = (await res.json().catch(() => ({}))) as { error?: string }
          return { ok: false, error: errBody.error ?? 'server-error' }
        }
        setCandidate(null)
        return { ok: true }
      } catch {
        return { ok: false, error: 'network-error' }
      }
    },
    [houseId]
  )

  const discard = useCallback(async (): Promise<MutationResult> => {
    try {
      const res = await fetch(`/api/houses/${houseId}/console/candidate`, { method: 'DELETE' })
      if (!res.ok) return { ok: false, error: 'server-error' }
      setCandidate(null)
      return { ok: true }
    } catch {
      return { ok: false, error: 'network-error' }
    }
  }, [houseId])

  return { candidate, loadState, refresh, finalize, promote, discard }
}
