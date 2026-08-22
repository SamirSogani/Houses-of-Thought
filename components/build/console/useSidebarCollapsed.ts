'use client'

// SSR-safe, persisted "is the console's chat sidebar collapsed?" preference
// (components/build/console/ConsolePage.tsx). Same useSyncExternalStore
// shape as useIsMobile: the server — and the first hydration pass — assume
// expanded, and the client snapshot takes over immediately after, so this
// never causes a hydration mismatch and never needs a setState-in-effect to
// read the stored value.
//
// Persisted rather than per-visit because a collapsed sidebar is a working
// preference, not a momentary choice: someone who wants the transcript wide
// while reading a long answer wants it wide the next time too. A blocked or
// unavailable localStorage degrades to "expanded, doesn't persist" rather
// than throwing.

import { useCallback, useSyncExternalStore } from 'react'

const KEY = 'hot:console:sidebar-collapsed'

const listeners = new Set<() => void>()

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange)
  // A second tab toggling the same preference shouldn't leave this one
  // showing a stale rail.
  window.addEventListener('storage', onChange)
  return () => {
    listeners.delete(onChange)
    window.removeEventListener('storage', onChange)
  }
}

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function useSidebarCollapsed(): [boolean, () => void] {
  const collapsed = useSyncExternalStore(subscribe, readCollapsed, () => false)

  const toggle = useCallback(() => {
    const next = !readCollapsed()
    try {
      window.localStorage.setItem(KEY, next ? '1' : '0')
    } catch {
      // Preference just won't survive the session.
    }
    for (const listener of listeners) listener()
  }, [])

  return [collapsed, toggle]
}
