'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import { HouseCard, CreateHouseCard } from '@/components/dashboard/HouseCard'
import Footer from '@/components/sections/Footer'
import { rowToSummary, type HouseRow, type HouseSummary } from '@/lib/dashboard/houses'
import { useAuthedPage, CenterNotice } from '@/components/useAuthedPage'
import { StudentAssignments } from '@/components/classroom/StudentAssignments'

// Columns selected for the grid — keep in sync with HouseRow.
const HOUSE_COLUMNS = 'id, title, question, status, layers_complete, updated_at, assignment_id, turned_in, draft'

export default function DashboardPage() {
  const router = useRouter()
  // Shared authed scaffold: user + account type + capabilities + signOut.
  const { accountType, caps, signOut } = useAuthedPage()
  const [houses, setHouses] = useState<HouseSummary[] | null>(null)
  // Turned-in houses that already carry teacher feedback: undo-turn-in is
  // blocked for these (bl-H2 — un-submitting after grading silently detached
  // the grade from the work the teacher actually saw).
  const [gradedIds, setGradedIds] = useState<Set<string>>(new Set())
  // Standard accounts with a class membership still need the Classroom nav
  // entry (bl-L8 — /classes was reachable only by typed URL for them).
  const [hasMemberships, setHasMemberships] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Route protection is handled by middleware.ts, so by the time this renders
  // the user is authenticated; here we only load their houses.
  const loadHouses = useCallback(async () => {
    const supabase = createClient()
    // Resolved here (not via useAuthedPage's `user`, which waits on a profile
    // fetch) so the grid query fires on mount; middleware guarantees a user,
    // so a null session just leaves the loading state in place.
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    const { data, error } = await supabase
      .from('houses')
      .select(HOUSE_COLUMNS)
      // Only houses the user OWNS (db-C1) — teacher RLS (0014) also admits
      // students' houses, which must never appear in the personal grid.
      .eq('owner_id', user.id)
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
    const rows = data as HouseRow[]
    setHouses(rows.map(rowToSummary))

    const turnedInIds = rows.filter((r) => r.turned_in).map((r) => r.id)
    if (turnedInIds.length > 0) {
      const { data: fb } = await supabase
        .from('submission_feedback')
        .select('house_id')
        .in('house_id', turnedInIds)
      setGradedIds(new Set(((fb as { house_id: string }[]) ?? []).map((f) => f.house_id)))
    } else {
      setGradedIds(new Set())
    }
  }, [])

  useEffect(() => {
    if (accountType !== 'standard') return
    ;(async () => {
      const { count } = await createClient()
        .from('class_members')
        .select('class_id', { count: 'exact', head: true })
      setHasMemberships((count ?? 0) > 0)
    })()
  }, [accountType])

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
    // Draft gate (016 §2): turn-in is the one REAL submission action, so it
    // honors the same claim gate the workspace applies to publish/export.
    const house = (houses ?? []).find((h) => h.id === id)
    if (turnedIn && house?.draftLocked) {
      setError('Review and claim the AI-drafted layers before turning this house in.')
      return
    }
    // Graded submissions stay submitted (bl-H2): un-submitting would let the
    // work change under a grade the teacher already recorded.
    if (!turnedIn && gradedIds.has(id)) {
      setError('This submission has been graded — ask your teacher if it needs to be reopened.')
      return
    }
    const supabase = createClient()
    const { error } = await supabase
      .from('houses')
      .update({ turned_in: turnedIn, turned_in_at: turnedIn ? new Date().toISOString() : null })
      .eq('id', id)
    if (!error) {
      setError(null)
      setHouses((hs) => (hs ?? []).map((h) => (h.id === id ? { ...h, turnedIn } : h)))
    } else {
      setError(
        turnedIn
          ? 'Could not turn the house in — please try again.'
          : 'Could not undo the turn-in — please try again.'
      )
    }
  }

  if (houses === null) {
    return <CenterNotice>Loading your houses…</CenterNotice>
  }

  const isTeacher = caps.canCreateClasses
  const isStudent = accountType === 'student'
  // Draft Mode entry (decision 016): standard + teacher only — students never
  // see it (and the route re-checks server-side).
  const canDraft = caps.canAuthorDraft

  return (
    <div className="acct-vh-min" style={{ display: 'flex', flexDirection: 'column', background: 'var(--parchment)' }}>
      <DashboardHeader
        onSignOut={() => void signOut()}
        showClassroom={isTeacher || isStudent || hasMemberships}
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
                graded={gradedIds.has(h.id)}
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
