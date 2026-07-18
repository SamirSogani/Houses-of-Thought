'use client'

// No-login builder (/house) — currently ORPHANED: nothing links here (the /try
// funnel uses the Mini House instead). Reuses the real Build workspace
// (BuildHousePage) in local mode: work persists to localStorage with the
// standard chrome (the swap to a Save → Create account CTA was reverted —
// decision 005 §1). No Supabase, no auth, no RLS. Product call pending
// (frontend plan D4): promote as the "try the full builder" surface or delete.
// See plans/active/pre-login-ux/page-try-and-auth.md.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BuildHousePage } from '@/components/build/BuildHousePage'
import { blankState, loadLocalHouse, saveLocalHouse } from '@/lib/build/persistence'
import type { State } from '@/lib/build/types'

const centerNotice: React.CSSProperties = {
  minHeight: '100dvh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--parchment)',
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  letterSpacing: '0.11em',
  textTransform: 'uppercase',
  color: 'var(--ink-subtle)',
}

export default function HousePage() {
  const router = useRouter()
  const [initial, setInitial] = useState<State | null>(null)

  // localStorage is client-only, so load after mount to avoid a hydration
  // mismatch. Returning visitors resume their draft; first-run gets a blank
  // house (empty title → ContextBar shows its placeholder prompt).
  useEffect(() => {
    setInitial(loadLocalHouse() ?? blankState())
  }, [])

  if (initial === null) {
    return <main style={centerNotice}>Loading your house…</main>
  }

  return (
    <BuildHousePage
      initialState={initial}
      userEmail={null}
      onSignOut={() => router.push('/')}
      onSave={saveLocalHouse}
    />
  )
}
