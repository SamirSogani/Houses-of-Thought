'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BuildHousePage } from '@/components/build/BuildHousePage'

export default function BuildPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    let active = true
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return
      if (!data.user) {
        router.replace('/login')
        return
      }
      setUserEmail(data.user.email ?? null)
      setReady(true)
    })
    return () => {
      active = false
    }
  }, [router])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  if (!ready) {
    return (
      <main
        style={{
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
        }}
      >
        Loading your house…
      </main>
    )
  }

  return <BuildHousePage userEmail={userEmail} onSignOut={handleSignOut} />
}
