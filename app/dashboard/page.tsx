'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import { HouseCard, CreateHouseCard } from '@/components/dashboard/HouseCard'
import Footer from '@/components/sections/Footer'
import { rowToSummary, type HouseRow, type HouseSummary } from '@/lib/dashboard/houses'
import { capabilitiesFor } from '@/lib/auth/capabilities'
import type { AccountType } from '@/lib/profile/data'
import { StudentAssignments } from '@/components/classroom/StudentAssignments'

// Columns selected for the grid — keep in sync with HouseRow.
const HOUSE_COLUMNS = 'id, title, question, status, layers_complete, updated_at, assignment_id, turned_in'

// Full-height via the dvh-safe .acct-vh-min class (account-responsive.css).
const centerNotice: React.CSSProperties = {
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
  const [accountType, setAccountType] = useState<AccountType>('standard')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Route protection is handled by middleware.ts, so by the time this renders
  // the user is authenticated; here we only load their houses.
  const loadHouses = useCallback(async () => {
    const supabase = createClient()

    // Teachers get a Classroom entry point in the header; students get their own
    // /classes panel (capabilities.ts drives the teacher gate).
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('account_type').eq('id', user.id).single()
      setAccountType((profile?.account_type as AccountType) ?? 'standard')
    }

    const { data, error } = await supabase
      .from('houses')
      .select(HOUSE_COLUMNS)
      // Strawman houses are attack targets, not the student's own work — keep
      // them out of the "Your Houses" grid.
      .eq('is_strawman', false)
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('Failed to load houses:', error)
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

  // draft=true routes into Draft Mode (decision 016): same blank house, but the
  // workspace opens with the AI-draft flow (?draft=1).
  async function handleCreate(draft = false) {
    if (creating) return
    setCreating(true)
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setCreating(false)
      router.replace('/login')
      return
    }
    const { data, error } = await supabase
      .from('houses')
      .insert({ owner_id: user.id })
      .select('id')
      .single()
    if (error || !data) {
      // Log the fields as a flat string — the dev overlay collapses raw error
      // objects to `{}`, hiding the message/code/hint that actually matter.
      const e = error as { message?: string; code?: string; details?: string; hint?: string; status?: number } | null
      console.error(
        `Failed to create house — status=${e?.status ?? ''} code=${e?.code ?? ''} message=${e?.message ?? ''} details=${e?.details ?? ''} hint=${e?.hint ?? ''}`
      )
      setError('Could not create a new house. Please try again.')
      setCreating(false)
      return
    }
    router.push(`/build/${data.id}${draft ? '?draft=1' : ''}`)
  }

  async function handleRename(id: string, title: string) {
    const next = title.trim()
    const supabase = createClient()
    const { error } = await supabase.from('houses').update({ title: next || null }).eq('id', id)
    if (!error) {
      setHouses((hs) => (hs ?? []).map((h) => (h.id === id ? { ...h, title: next || null } : h)))
    }
  }

  async function handleDelete(id: string) {
    const supabase = createClient()
    const { error } = await supabase.from('houses').delete().eq('id', id)
    if (!error) {
      setHouses((hs) => (hs ?? []).filter((h) => h.id !== id))
    } else {
      setError('Could not delete that house. Please try again.')
    }
  }

  async function handleTurnIn(id: string, turnedIn: boolean) {
    const supabase = createClient()
    const { error } = await supabase.from('houses').update({ turned_in: turnedIn }).eq('id', id)
    if (!error) {
      setHouses((hs) => (hs ?? []).map((h) => (h.id === id ? { ...h, turnedIn } : h)))
    }
  }

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  if (houses === null) {
    return <main className="acct-vh-min" style={centerNotice}>Loading your houses…</main>
  }

  const isTeacher = capabilitiesFor(accountType).canCreateClasses
  const isStudent = accountType === 'student'
  // Draft Mode entry (decision 016): standard + teacher only — students never
  // see it (and the route re-checks server-side).
  const canDraft = capabilitiesFor(accountType).canAuthorDraft

  return (
    <div className="acct-vh-min" style={{ display: 'flex', flexDirection: 'column', background: 'var(--parchment)' }}>
      <DashboardHeader
        onSignOut={handleSignOut}
        showClassroom={isTeacher || isStudent}
        classroomHref={isTeacher ? '/classroom' : '/classes'}
      />

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

          {/* Assigned work (students only; self-hides when empty) */}
          <div style={{ marginTop: 'clamp(24px, 3vw, 36px)' }}>
            <StudentAssignments />
          </div>

          {/* Grid (single column on very narrow phones via acct-card-grid) */}
          <div
            className="acct-card-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 20,
              marginTop: 'clamp(24px, 3vw, 36px)',
            }}
          >
            {houses.map((h) => (
              <HouseCard
                key={h.id}
                house={h}
                href={`/build/${h.id}`}
                onRename={handleRename}
                onDelete={handleDelete}
                onTurnIn={handleTurnIn}
              />
            ))}
            <CreateHouseCard onClick={() => handleCreate()} disabled={creating} />
            {canDraft && (
              <CreateHouseCard
                onClick={() => handleCreate(true)}
                disabled={creating}
                label="Start with an AI draft"
              />
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
