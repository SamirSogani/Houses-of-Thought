'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BuildHousePage } from '@/components/build/BuildHousePage'
import { loadHouse, saveHouse } from '@/lib/build/persistence'
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

export default function BuildHouseRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [loaded, setLoaded] = useState<State | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  // Route protection is handled by middleware.ts; here we load the house. A null
  // result means not-found or not-yours (RLS makes both look empty) → dashboard.
  useEffect(() => {
    const supabase = createClient()
    let active = true
    ;(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!active || !user) return

      const state = await loadHouse(supabase, id)
      if (!active) return
      if (!state) {
        router.replace('/dashboard')
        return
      }
      setUserEmail(user.email ?? null)
      setLoaded(state)
    })()
    return () => {
      active = false
    }
  }, [id, router])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  if (loaded === null) {
    return <main style={centerNotice}>Loading your house…</main>
  }

  return (
    <BuildHousePage
      mode="account"
      initialState={loaded}
      userEmail={userEmail}
      onSignOut={handleSignOut}
      onSave={(s) => saveHouse(createClient(), id, s)}
    />
  )
}
