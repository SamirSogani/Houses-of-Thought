'use client'

// No-login builder (/house) — the first version of the planned /try surface.
// Reuses the real Build workspace (BuildHousePage) in local mode: work persists
// to localStorage, and the share/publish/sign-out chrome is swapped for a
// Save → Create account CTA. No Supabase, no auth, no RLS.
// See plans/active/pre-login-ux/page-try-and-auth.md.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BuildHousePage } from '@/components/build/BuildHousePage'
import { blankState, loadLocalHouse, saveLocalHouse } from '@/lib/build/persistence'
import type { State } from '@/lib/build/types'

const centerNotice: React.CSSProperties = {
  minHeight: '100vh',
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
      mode="local"
      initialState={initial}
      userEmail={null}
      onSignOut={() => router.push('/')}
      onSave={saveLocalHouse}
    />
  )
}
