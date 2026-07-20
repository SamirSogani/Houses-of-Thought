'use client'

// Class roster (plan phase 2): a teacher sees each student in the class and the
// houses they've built, with read-only links into the workspace. Teacher-only —
// a non-owner is bounced back to /classroom (RLS returns no class row for them).

import { use, useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import { HouseCard } from '@/components/dashboard/HouseCard'
import { AssignmentPanel } from '@/components/classroom/AssignmentPanel'
import Footer from '@/components/sections/Footer'
import { inviteUrl, rowToRosterMember, type RosterMember, type RosterMemberRow } from '@/lib/classroom/classes'
import { rowToSummary, type HouseRow, type HouseSummary } from '@/lib/dashboard/houses'

const HOUSE_COLUMNS = 'id, owner_id, title, question, status, layers_complete, updated_at'

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

interface ClassHead {
  name: string
  joinCode: string
}

export default function ClassRosterPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = use(params)
  const router = useRouter()
  const [head, setHead] = useState<ClassHead | null>(null)
  const [roster, setRoster] = useState<RosterMember[] | null>(null)
  const [housesByOwner, setHousesByOwner] = useState<Record<string, HouseSummary[]>>({})
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.replace('/login')
      return
    }

    // Ownership gate: only the class's teacher gets a row back here.
    const { data: cls } = await supabase
      .from('classes')
      .select('name, join_code, teacher_id')
      .eq('id', classId)
      .single()
    if (!cls || cls.teacher_id !== user.id) {
      router.replace('/classroom')
      return
    }
    setHead({ name: cls.name as string, joinCode: cls.join_code as string })

    const { data: members } = await supabase.rpc('get_class_roster', { cid: classId })
    const list = ((members as RosterMemberRow[]) ?? []).map(rowToRosterMember)
    setRoster(list)

    if (list.length > 0) {
      // Teacher can read these via can_view_student_house RLS (migration 0014).
      const { data: houses } = await supabase
        .from('houses')
        .select(HOUSE_COLUMNS)
        .in('owner_id', list.map((m) => m.userId))
        .eq('is_strawman', false)
        .order('updated_at', { ascending: false })
      const grouped: Record<string, HouseSummary[]> = {}
      for (const row of (houses as (HouseRow & { owner_id: string })[]) ?? []) {
        ;(grouped[row.owner_id] ??= []).push(rowToSummary(row))
      }
      setHousesByOwner(grouped)
    }
  }, [classId, router])

  useEffect(() => {
    load()
  }, [load])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  async function copyInvite() {
    if (!head) return
    try {
      await navigator.clipboard.writeText(inviteUrl(head.joinCode))
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      /* clipboard blocked — code stays visible */
    }
  }

  if (head === null || roster === null) {
    return <main id="main" style={centerNotice}>Loading roster…</main>
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--parchment)' }}>
      <DashboardHeader onSignOut={handleSignOut} />

      <main style={{ flex: '1 1 auto' }}>
        <div className="container" style={{ paddingBlock: 'clamp(32px, 5vw, 56px)' }}>
          <button
            type="button"
            onClick={() => router.push('/classroom')}
            className="mono"
            style={{ fontSize: 10, color: 'var(--ink-subtle)', background: 'transparent', border: 'none', cursor: 'pointer', marginBottom: 12 }}
          >
            ← All classes
          </button>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}>
            <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 'clamp(28px, 4vw, 38px)', letterSpacing: '-0.015em', color: 'var(--ink)' }}>
              {head.name}
            </h1>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span className="mono" style={{ fontSize: 9, color: 'var(--ink-subtle)' }}>JOIN CODE</span>
              <span className="mono" style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.15em', color: 'var(--ink)', background: 'var(--amber-tint)', borderRadius: 5, padding: '3px 8px' }}>
                {head.joinCode}
              </span>
              <button type="button" onClick={copyInvite} className="mono" style={{ fontSize: 9, color: copied ? 'var(--green-strong)' : 'var(--ink-subtle)', border: '1px solid var(--rule)', borderRadius: 5, padding: '4px 8px', background: 'var(--white)', cursor: 'pointer' }}>
                {copied ? 'Copied' : 'Copy invite link'}
              </button>
            </span>
          </div>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 15, color: 'var(--ink-mid)', marginTop: 8 }}>
            {roster.length} {roster.length === 1 ? 'student' : 'students'}
          </p>

          <AssignmentPanel classId={classId} />

          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 22, color: 'var(--ink)', marginTop: 'clamp(28px, 4vw, 40px)', marginBottom: 4 }}>
            Roster
          </h2>

          {roster.length === 0 ? (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 15, color: 'var(--ink-subtle)', marginTop: 32 }}>
              No students yet. Share the join code above to add them.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 32, marginTop: 'clamp(24px, 3vw, 36px)' }}>
              {roster.map((m) => {
                const houses = housesByOwner[m.userId] ?? []
                return (
                  <section key={m.userId}>
                    <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 20, color: 'var(--ink)', marginBottom: 14 }}>
                      {m.label}
                    </h2>
                    {houses.length === 0 ? (
                      <p className="mono" style={{ fontSize: 11, color: 'var(--ink-subtle)' }}>No houses yet</p>
                    ) : (
                      <div className="acct-card-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
                        {houses.map((h) => (
                          <HouseCard key={h.id} house={h} href={`/build/${h.id}`} />
                        ))}
                      </div>
                    )}
                  </section>
                )
              })}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}
