'use client'

// SSR-safe "is this the mobile workspace layout?" hook for the Build area.
// Server (and first hydration pass) assume desktop; the client snapshot takes
// over immediately after, and matchMedia keeps it live across resizes.
// Breakpoint matches app/styles/build-responsive.css (max-width: 1023px).

import { useSyncExternalStore } from 'react'

const QUERY = '(max-width: 1023px)'

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(QUERY)
  mql.addEventListener('change', onChange)
  return () => mql.removeEventListener('change', onChange)
}

export function useIsMobile(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false // server: desktop layout; CSS hides the rails pre-hydration
  )
}
