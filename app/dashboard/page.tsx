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
const HOUSE_COLUMNS = 'id, title, question, status, layers_complete, updated_at, assignment_id, turned_in, draft, share_token'
// Shared-with-you houses never expose share_token (Mechanism 2 is owner-only)
// or draft-gate state (turn-in doesn't apply to someone else's house).
const SHARED_HOUSE_COLUMNS = 'id, title, question, status, layers_complete, updated_at'

export default function DashboardPage() {
  const router = useRouter()
  // Shared authed scaffold: user + account type + capabilities + signOut.
  const { accountType, caps, signOut } = useAuthedPage()
  const [houses, setHouses] = useState<HouseSummary[] | null>(null)
  // Mechanism 1 ("Invite"): houses owned by someone else where the signed-in
  // user is a house_collaborators row — labeled distinctly, never merged into
  // "Your Houses" (plan doc step 4).
  const [sharedHouses, setSharedHouses] = useState<HouseSummary[] | null>(null)
  // Mechanism 2 ("Share"): a transient, non-error confirmation (e.g. "Link
  // copied") — separate from `error` below, which is reserved for failures.
  const [notice, setNotice] = useState<string | null>(null)
  // Turned-in houses that already carry teacher feedback: undo-turn-in is
  // blocked for these (bl-H2 — un-submitting after grading silently detached
  // the grade from the work the teacher actually saw).
  const [gradedIds, setGradedIds] = useState<Set<string>>(new Set())
  // Standard accounts with a class membership still need the Classroom nav
  // entry (bl-L8 — /classes was reachable only by typed URL for them).
  const [hasMemberships, setHasMemberships] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Route protection is handled by proxy.ts, so by the time this renders
  // the user is authenticated; here we only load their houses.
  const loadHouses = useCallback(async () => {
    const supabase = createClient()
    // Resolved here (not via useAuthedPage's `user`, which waits on a profile
    // fetch) so the grid query fires on mount; the proxy guarantees a user,
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

  // Mechanism 1 step 4: houses shared with the signed-in user as a
  // house_collaborators row, surfaced separately from — never merged into —
  // the owner-only query above. houses_select RLS (0004/0006/0020) already
  // permits reading these rows; this is purely a client-side query change.
  const loadSharedHouses = useCallback(async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    const { data: memberships, error: membershipError } = await supabase
      .from('house_collaborators')
      .select('house_id, role')
      .eq('user_id', user.id)
    if (membershipError || !memberships || memberships.length === 0) {
      setSharedHouses([])
      return
    }
    const roleByHouse = new Map(memberships.map((m) => [m.house_id as string, m.role as 'viewer' | 'editor']))
    const { data, error } = await supabase
      .from('houses')
      .select(SHARED_HOUSE_COLUMNS)
      .in('id', Array.from(roleByHouse.keys()))
      .order('updated_at', { ascending: false })
    if (error) {
      console.error('Failed to load shared houses:', error)
      setSharedHouses([])
      return
    }
    const rows = data as HouseRow[]
    setSharedHouses(
      rows.map((r) => ({ ...rowToSummary(r), sharedRole: roleByHouse.get(r.id) }))
    )
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
    loadSharedHouses()
  }, [loadHouses, loadSharedHouses])

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
      // The id could be an owned house OR (an editor's rename of) a house
      // shared with this user — update whichever list actually holds it.
      setHouses((hs) => (hs ?? []).map((h) => (h.id === id ? { ...h, title: next || null } : h)))
      setSharedHouses((hs) => (hs ?? []).map((h) => (h.id === id ? { ...h, title: next || null } : h)))
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

  // Mechanism 2 ("Share"): the owner's own UPDATE, allowed by the existing
  // owner-gated houses_update RLS (0004/0006/0020) — no new policy (0033
  // added only the column). A fresh crypto.randomUUID() stands in for the
  // plan doc's `gen_random_uuid()`: same effect (a random, DB-unique token),
  // generated client-side so this is a plain `.update()` rather than needing
  // an RPC round trip; share_token's UNIQUE constraint still catches the
  // astronomically unlikely collision and surfaces it as a normal error below.
  async function handleGetShareLink(id: string) {
    const house = (houses ?? []).find((h) => h.id === id)
    const existing = house?.shareToken
    const token = existing ?? crypto.randomUUID()
    if (!existing) {
      const supabase = createClient()
      const { error } = await supabase.from('houses').update({ share_token: token }).eq('id', id)
      if (error) {
        setError('Could not create a share link — please try again.')
        return
      }
      setHouses((hs) => (hs ?? []).map((h) => (h.id === id ? { ...h, shareToken: token } : h)))
    }
    const url = `${window.location.origin}/shared/${token}`
    try {
      await navigator.clipboard.writeText(url)
      setError(null)
      setNotice('Share link copied to clipboard.')
    } catch {
      setNotice(`Share link: ${url}`)
    }
  }

  async function handleRevokeShareLink(id: string) {
    const supabase = createClient()
    const { error } = await supabase.from('houses').update({ share_token: null }).eq('id', id)
    if (!error) {
      setHouses((hs) => (hs ?? []).map((h) => (h.id === id ? { ...h, shareToken: null } : h)))
      setNotice('Share link revoked — it no longer works.')
    } else {
      setError('Could not revoke the share link — please try again.')
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

      <main id="main" style={{ flex: '1 1 auto' }}>
        <div className="container" style={{ paddingBlock: 'clamp(32px, 5vw, 56px)' }}>
          {/* Heading */}
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 'clamp(30px, 4vw, 40px)', letterSpacing: '-0.015em', color: 'var(--ink)' }}>
            Your Houses
          </h1>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 16, color: 'var(--ink-mid)', marginTop: 8 }}>
            Build and explore your Houses of Thought.
          </p>

          {error && (
            <p className="mono" style={{ fontSize: 11, color: 'var(--warning-text)', marginTop: 16 }}>
              {error}
            </p>
          )}
          {notice && !error && (
            <p className="mono" style={{ fontSize: 11, color: 'var(--green-text)', marginTop: 16 }}>
              {notice}
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
                onGetShareLink={handleGetShareLink}
                onRevokeShareLink={handleRevokeShareLink}
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

          {/* Mechanism 1 ("Invite"): houses someone else owns where the
              signed-in user is a house_collaborators row. Deliberately its own
              section, never merged into the grid above — these aren't yours. */}
          {sharedHouses !== null && sharedHouses.length > 0 && (
            <div style={{ marginTop: 'clamp(32px, 4vw, 48px)' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 'clamp(20px, 2.6vw, 26px)', letterSpacing: '-0.01em', color: 'var(--ink)' }}>
                Shared with you
              </h2>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--ink-mid)', marginTop: 6 }}>
                Houses other people invited you to. Rename requires editor access; only the owner can
                delete or share.
              </p>
              <div
                className="acct-card-grid"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: 20,
                  marginTop: 16,
                }}
              >
                {sharedHouses.map((h) => (
                  <HouseCard
                    key={h.id}
                    house={h}
                    href={`/build/${h.id}`}
                    onRename={h.sharedRole === 'editor' ? handleRename : undefined}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}
