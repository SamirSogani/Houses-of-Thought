'use client'

// Assignment detail for the teacher (plan phase 3): the posed question plus each
// student's submission status. A submission is the student's house linked to this
// assignment (houses.assignment_id); "Not started" until they open it. Read-only
// links open the student's house via the same route the roster uses.

import { use, useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import { StrawmanAuthor } from '@/components/classroom/StrawmanAuthor'
import Footer from '@/components/sections/Footer'
import { dueLabel } from '@/lib/classroom/assignments'
import { rowToRosterMember, type RosterMember, type RosterMemberRow } from '@/lib/classroom/classes'
import { housePercent, statusMeta, rowToSummary, type HouseRow, type HouseSummary } from '@/lib/dashboard/houses'

const HOUSE_COLUMNS = 'id, owner_id, title, question, status, layers_complete, updated_at, turned_in'

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

interface Head {
  question: string
  dueAt: string | null
}

export default function AssignmentDetailPage({ params }: { params: Promise<{ classId: string; assignmentId: string }> }) {
  const { classId, assignmentId } = use(params)
  const router = useRouter()
  const [head, setHead] = useState<Head | null>(null)
  const [roster, setRoster] = useState<RosterMember[] | null>(null)
  const [houseByOwner, setHouseByOwner] = useState<Record<string, HouseSummary>>({})
  const [gradeByHouse, setGradeByHouse] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.replace('/login')
      return
    }

    // Ownership gate: only the class's teacher may manage the assignment.
    const { data: cls } = await supabase.from('classes').select('teacher_id').eq('id', classId).single()
    if (!cls || cls.teacher_id !== user.id) {
      router.replace('/classroom')
      return
    }

    const { data: assignment } = await supabase
      .from('assignments')
      .select('question, due_at, class_id')
      .eq('id', assignmentId)
      .single()
    if (!assignment || assignment.class_id !== classId) {
      router.replace(`/classroom/${classId}`)
      return
    }
    setHead({ question: assignment.question as string, dueAt: (assignment.due_at as string | null) ?? null })

    const { data: members } = await supabase.rpc('get_class_roster', { cid: classId })
    setRoster(((members as RosterMemberRow[]) ?? []).map(rowToRosterMember))

    // Submissions: houses linked to this assignment (teacher-readable via RLS).
    const { data: houses } = await supabase
      .from('houses')
      .select(HOUSE_COLUMNS)
      .eq('assignment_id', assignmentId)
      .eq('is_strawman', false)
    const map: Record<string, HouseSummary> = {}
    for (const row of (houses as (HouseRow & { owner_id: string })[]) ?? []) {
      map[row.owner_id] = rowToSummary(row)
    }
    setHouseByOwner(map)

    // Grades left on those submissions (RLS lets the teacher read them).
    const houseIds = Object.values(map).map((h) => h.id)
    if (houseIds.length > 0) {
      const { data: fb } = await supabase.from('submission_feedback').select('house_id, grade').in('house_id', houseIds)
      const grades: Record<string, string> = {}
      for (const r of (fb as { house_id: string; grade: string }[]) ?? []) {
        if (r.grade) grades[r.house_id] = r.grade
      }
      setGradeByHouse(grades)
    }
  }, [classId, assignmentId, router])

  useEffect(() => {
    load()
  }, [load])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  if (head === null || roster === null) {
    return <main style={centerNotice}>Loading assignment…</main>
  }

  const due = dueLabel(head.dueAt)
  const started = roster.filter((m) => houseByOwner[m.userId]).length

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--parchment)' }}>
      <DashboardHeader onSignOut={handleSignOut} />

      <main style={{ flex: '1 1 auto' }}>
        <div className="container" style={{ paddingBlock: 'clamp(32px, 5vw, 56px)' }}>
          <button
            type="button"
            onClick={() => router.push(`/classroom/${classId}`)}
            className="mono"
            style={{ fontSize: 10, color: 'var(--ink-subtle)', background: 'transparent', border: 'none', cursor: 'pointer', marginBottom: 12 }}
          >
            ← Back to class
          </button>

          <div className="mono" style={{ fontSize: 10, color: 'var(--ink-subtle)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Assignment{due ? ` · ${due}` : ''}
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 'clamp(24px, 3.5vw, 34px)', letterSpacing: '-0.015em', color: 'var(--ink)', marginTop: 6, lineHeight: 1.2 }}>
            {head.question}
          </h1>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 15, color: 'var(--ink-mid)', marginTop: 8 }}>
            {started} of {roster.length} started
          </p>

          <StrawmanAuthor assignmentId={assignmentId} />

          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 20, color: 'var(--ink)', marginTop: 'clamp(24px, 3vw, 36px)' }}>
            Submissions
          </h2>

          {roster.length === 0 ? (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 15, color: 'var(--ink-subtle)', marginTop: 32 }}>
              No students in this class yet.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 'clamp(20px, 3vw, 32px)' }}>
              {roster.map((m) => {
                const house = houseByOwner[m.userId]
                const meta = house ? statusMeta[house.status] : null
                return (
                  <div
                    key={m.userId}
                    style={{ display: 'flex', alignItems: 'center', gap: 16, background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 10, padding: '14px 16px' }}
                  >
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: 15, color: 'var(--ink)', minWidth: 140 }}>{m.label}</span>

                    {house ? (
                      <>
                        <div style={{ flex: 1, minWidth: 80 }}>
                          <div className="mono" style={{ fontSize: 9, color: 'var(--ink-subtle)', marginBottom: 4 }}>
                            {house.layersComplete}/7 layers · {housePercent(house)}%
                          </div>
                          <div style={{ height: 5, background: 'var(--rule)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${housePercent(house)}%`, background: house.status === 'complete' ? 'var(--green-strong)' : 'var(--amber)', borderRadius: 3 }} />
                          </div>
                        </div>
                        {meta && (
                          <span className="mono" style={{ fontSize: 9, color: meta.color, background: meta.bg, border: `1px solid ${meta.color}`, borderRadius: 5, padding: '2px 8px', whiteSpace: 'nowrap' }}>
                            {meta.label}
                          </span>
                        )}
                        {house.turnedIn && (
                          <span className="mono" style={{ fontSize: 9, color: 'var(--green-strong)', border: '1px solid var(--green-strong)', borderRadius: 5, padding: '2px 8px', whiteSpace: 'nowrap' }}>
                            Turned in
                          </span>
                        )}
                        {gradeByHouse[house.id] && (
                          <span className="mono" style={{ fontSize: 9, color: 'var(--green-strong)', border: '1px solid var(--green-strong)', borderRadius: 5, padding: '2px 8px', whiteSpace: 'nowrap' }}>
                            Graded: {gradeByHouse[house.id]}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => router.push(`/build/${house.id}`)}
                          className="mono"
                          style={{ fontSize: 10, color: 'var(--ink)', border: '1px solid var(--ink)', borderRadius: 6, padding: '6px 12px', background: 'var(--white)', cursor: 'pointer', whiteSpace: 'nowrap' }}
                        >
                          Open
                        </button>
                      </>
                    ) : (
                      <span className="mono" style={{ fontSize: 10, color: 'var(--ink-subtle)', marginLeft: 'auto' }}>Not started</span>
                    )}
                  </div>
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
