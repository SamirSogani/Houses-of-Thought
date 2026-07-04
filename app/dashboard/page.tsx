'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import { HouseCard, CreateHouseCard } from '@/components/dashboard/HouseCard'
import Footer from '@/components/sections/Footer'
import { houses } from '@/lib/dashboard/houses'

export default function DashboardPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    let active = true
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return
      if (!data.user) {
        router.replace('/login')
        return
      }
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
        Loading your houses…
      </main>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--parchment)' }}>
      <DashboardHeader onSignOut={handleSignOut} />

      <main style={{ flex: '1 1 auto' }}>
        <div className="container" style={{ paddingBlock: 'clamp(32px, 5vw, 56px)' }}>
          {/* Heading */}
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 'clamp(30px, 4vw, 40px)', letterSpacing: '-0.015em', color: 'var(--ink)' }}>
            Your Houses
          </h1>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 16, color: 'var(--ink-mid)', marginTop: 8 }}>
            Build and explore your Houses of Thought.
          </p>

          {/* Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 20,
              marginTop: 'clamp(24px, 3vw, 36px)',
            }}
          >
            {houses.map((h) => (
              <HouseCard key={h.id} house={h} href="/build" />
            ))}
            <CreateHouseCard href="/build" />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
