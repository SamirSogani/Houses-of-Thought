'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import { ProfileForm } from '@/components/profile/ProfileForm'
import Footer from '@/components/sections/Footer'

export default function ProfilePage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [seedUsername, setSeedUsername] = useState<string | undefined>(undefined)

  useEffect(() => {
    const supabase = createClient()
    let active = true
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return
      if (!data.user) {
        router.replace('/login')
        return
      }
      // Seed the username field from the email local-part if present.
      const local = data.user.email?.split('@')[0]
      if (local) setSeedUsername(local)
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
        Loading your profile…
      </main>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--parchment)' }}>
      <DashboardHeader onSignOut={handleSignOut} active="profile" />

      <main style={{ flex: '1 1 auto' }}>
        <div className="container" style={{ paddingBlock: 'clamp(28px, 4vw, 48px)', maxWidth: 900 }}>
          <ProfileForm username={seedUsername} />
        </div>
      </main>

      <Footer />
    </div>
  )
}
