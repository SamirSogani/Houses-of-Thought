'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import { HouseCard, CreateHouseCard } from '@/components/dashboard/HouseCard'
import Footer from '@/components/sections/Footer'
import { rowToSummary, type HouseRow, type HouseSummary } from '@/lib/dashboard/houses'

// Columns selected for the grid — keep in sync with HouseRow.
const HOUSE_COLUMNS = 'id, title, question, status, layers_complete, updated_at'

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

export default function DashboardPage() {
  const router = useRouter()
  const [houses, setHouses] = useState<HouseSummary[] | null>(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Route protection is handled by middleware.ts, so by the time this renders
  // the user is authenticated; here we only load their houses.
  const loadHouses = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('houses')
      .select(HOUSE_COLUMNS)
      .order('updated_at', { ascending: false })

    if (error) {
      setError('Could not load your houses. Please refresh.')
      setHouses([])
      return
    }
    setError(null)
    setHouses((data as HouseRow[]).map(rowToSummary))
  }, [])

  useEffect(() => {
    loadHouses()
  }, [loadHouses])

  async function handleCreate() {
    if (creating) return
    setCreating(true)
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.replace('/login')
      return
    }
    const { data, error } = await supabase
      .from('houses')
      .insert({ owner_id: user.id })
      .select('id')
      .single()
    if (error || !data) {
      setError('Could not create a new house. Please try again.')
      setCreating(false)
      return
    }
    router.push(`/build/${data.id}`)
  }

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  if (houses === null) {
    return <main style={centerNotice}>Loading your houses…</main>
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

          {error && (
            <p className="mono" style={{ fontSize: 11, color: 'var(--warning)', marginTop: 16 }}>
              {error}
            </p>
          )}

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
              <HouseCard key={h.id} house={h} href={`/build/${h.id}`} />
            ))}
            <CreateHouseCard onClick={handleCreate} disabled={creating} />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
