'use client'

// Same-browser single-writer lock per house, via BroadcastChannel. The second
// tab to open a house becomes a passive reader (banner + no autosave) until the
// user clicks Take over — the cheap guard against two tabs interleaving
// whole-house saves. Cross-device conflicts are the rev token's job
// (lib/build/persistence.ts saveHouse), not this hook's.
//
// Protocol (best-effort, not consensus): on mount broadcast `hello`; any tab
// that currently holds the house answers `active`, which locks the newcomer.
// `takeover` locks everyone except its sender. If two tabs open in the same
// instant neither may lock — acceptable: either can still Take over explicitly.

import { useCallback, useEffect, useRef, useState } from 'react'

interface Msg {
  t: 'hello' | 'active' | 'takeover'
  id: string
}

export function useHouseTabLock(houseId?: string): {
  lockedByOtherTab: boolean
  takeOver: () => void
} {
  const [locked, setLocked] = useState(false)
  const lockedRef = useRef(false)
  lockedRef.current = locked
  const channelRef = useRef<BroadcastChannel | null>(null)
  const tabIdRef = useRef<string>('')

  useEffect(() => {
    if (!houseId || typeof BroadcastChannel === 'undefined') return
    const tabId = crypto.randomUUID()
    tabIdRef.current = tabId
    const ch = new BroadcastChannel(`hot:house-tab:${houseId}`)
    channelRef.current = ch

    ch.onmessage = (e: MessageEvent<Msg>) => {
      const msg = e.data
      if (!msg || msg.id === tabId) return
      if (msg.t === 'hello' && !lockedRef.current) {
        ch.postMessage({ t: 'active', id: tabId } satisfies Msg)
      } else if (msg.t === 'active' || msg.t === 'takeover') {
        setLocked(true)
      }
    }
    ch.postMessage({ t: 'hello', id: tabId } satisfies Msg)

    return () => {
      ch.close()
      channelRef.current = null
    }
  }, [houseId])

  const takeOver = useCallback(() => {
    channelRef.current?.postMessage({ t: 'takeover', id: tabIdRef.current } satisfies Msg)
    setLocked(false)
  }, [])

  return { lockedByOtherTab: locked, takeOver }
}
