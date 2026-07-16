'use client'

// A student's assigned work (plan phases 3-4), shown on the dashboard above their
// own houses. Assignments are grouped under their course (in order) with a
// completion count; ungrouped assignments follow. "Start" seeds the linked house
// on first open (open_assignment RPC), "Continue" reopens it. Renders nothing
// when the student has no assignments.

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { rowToAssignment, dueLabel, ASSIGNMENT_COLUMNS, type AssignmentRow, type AssignmentSummary } from '@/lib/classroom/assignments'
import { rowToCourse, byPosition, type CourseRow, type CourseSummary } from '@/lib/classroom/courses'
import type { HouseStatus } from '@/lib/dashboard/houses'
import { statusMeta } from '@/lib/dashboard/houses'

export function StudentAssignments() {
  const router = useRouter()
  const [assignments, setAssignments] = useState<AssignmentSummary[] | null>(null)
  const [courses, setCourses] = useState<CourseSummary[]>([])
  const [classNames, setClassNames] = useState<Record<string, string>>({})
  const [statusByAssignment, setStatusByAssignment] = useState<Record<string, HouseStatus>>({})
  const [opening, setOpening] = useState<string | null>(null)

  const load = useCallback(async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setAssignments([])
      return
    }

    const { data: memberships } = await supabase.from('class_members').select('class_id').eq('user_id', user.id)
    const classIds = ((memberships as { class_id: string }[]) ?? []).map((m) => m.class_id)
    if (classIds.length === 0) {
      setAssignments([])
      return
    }

    const [{ data: a }, { data: c }, { data: courseRows }, { data: houses }] = await Promise.all([
      supabase.from('assignments').select(ASSIGNMENT_COLUMNS).in('class_id', classIds),
      supabase.from('classes').select('id, name').in('id', classIds),
      supabase.from('courses').select('id, class_id, title, description, position, created_at').in('class_id', classIds),
      // is_strawman = false: only real submissions count toward status; the
      // strawman house is a separate artifact the student attacks.
      supabase.from('houses').select('assignment_id, status').eq('owner_id', user.id).eq('is_strawman', false).not('assignment_id', 'is', null),
    ])

    const names: Record<string, string> = {}
    for (const cl of (c as { id: string; name: string }[]) ?? []) names[cl.id] = cl.name
    const status: Record<string, HouseStatus> = {}
    for (const h of (houses as { assignment_id: string; status: HouseStatus }[]) ?? []) status[h.assignment_id] = h.status

    setClassNames(names)
    setStatusByAssignment(status)
    setCourses((courseRows as CourseRow[] ?? []).map(rowToCourse).sort(byPosition))
    setAssignments((a as AssignmentRow[] ?? []).map(rowToAssignment))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function openAssignment(aid: string) {
    if (opening) return
    setOpening(aid)
    const supabase = createClient()
    const { data, error } = await supabase.rpc('open_assignment', { aid })
    if (error || !data) {
      setOpening(null)
      return
    }
    router.push(`/build/${data as string}`)
  }

  // The strawman is authored and released by the teacher; the student just opens
  // that shared house (read-only) to attack it.
  function attackStrawman(strawmanHouseId: string) {
    router.push(`/build/${strawmanHouseId}`)
  }

  if (assignments === null || assignments.length === 0) return null

  function group(courseId: string | null): AssignmentSummary[] {
    return assignments!.filter((a) => a.courseId === courseId).sort(byPosition)
  }
  const ungrouped = group(null)

  return (
    <section style={{ marginBottom: 'clamp(28px, 4vw, 44px)' }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 'clamp(22px, 3vw, 28px)', letterSpacing: '-0.01em', color: 'var(--ink)' }}>
        Assigned to you
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 22, marginTop: 16 }}>
        {courses.map((course) => {
          const items = group(course.id)
          if (items.length === 0) return null
          const done = items.filter((a) => statusByAssignment[a.id] === 'complete').length
          return (
            <div key={course.id}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 18, color: 'var(--ink)' }}>{course.title}</h3>
                <span className="mono" style={{ fontSize: 9, color: 'var(--ink-subtle)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {classNames[course.classId] ?? ''} · {done}/{items.length} complete
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
                {items.map((a) => (
                  <Row
                    key={a.id}
                    assignment={a}
                    className={classNames[a.classId] ?? ''}
                    status={statusByAssignment[a.id] ?? null}
                    opening={opening === a.id}
                    onOpen={() => openAssignment(a.id)}
                    onAttack={() => a.strawmanHouseId && attackStrawman(a.strawmanHouseId)}
                    hideClass
                  />
                ))}
              </div>
            </div>
          )
        })}

        {ungrouped.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {ungrouped.map((a) => (
              <Row
                key={a.id}
                assignment={a}
                className={classNames[a.classId] ?? ''}
                status={statusByAssignment[a.id] ?? null}
                opening={opening === a.id}
                onOpen={() => openAssignment(a.id)}
                onAttack={() => a.strawmanHouseId && attackStrawman(a.strawmanHouseId)}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function Row({
  assignment,
  className,
  status,
  opening,
  onOpen,
  onAttack,
  hideClass,
}: {
  assignment: AssignmentSummary
  className: string
  status: HouseStatus | null
  opening: boolean
  onOpen: () => void
  onAttack: () => void
  hideClass?: boolean
}) {
  const meta = status ? statusMeta[status] : null
  const due = dueLabel(assignment.dueAt)
  const context = [hideClass ? '' : className, due ?? ''].filter(Boolean).join(' · ')
  const strawmanReady = assignment.aiStrawman && assignment.strawmanHouseId
  // On phones acct-row-wrap wraps the row and acct-row-main gives the question
  // its own line so the chips/buttons drop below it instead of crushing it.
  return (
    <div className="acct-row-wrap" style={{ display: 'flex', alignItems: 'center', gap: 16, background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 10, padding: '14px 16px' }}>
      <div className="acct-row-main" style={{ flex: 1, minWidth: 0 }}>
        {context && (
          <div className="mono" style={{ fontSize: 9, color: 'var(--ink-subtle)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{context}</div>
        )}
        <div style={{ fontFamily: 'var(--font-body)', fontSize: 15, color: 'var(--ink)', marginTop: context ? 3 : 0 }}>{assignment.question}</div>
      </div>
      {meta && (
        <span className="mono" style={{ fontSize: 9, color: meta.color, background: meta.bg, border: `1px solid ${meta.color}`, borderRadius: 5, padding: '2px 8px', whiteSpace: 'nowrap' }}>
          {meta.label}
        </span>
      )}
      {strawmanReady ? (
        <button
          type="button"
          onClick={onAttack}
          className="mono"
          title="Attack an AI-written flawed argument and find its weak links."
          style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink)', border: '1px solid var(--ink)', borderRadius: 8, padding: '9px 12px', background: 'var(--white)', whiteSpace: 'nowrap', cursor: 'pointer' }}
        >
          Attack strawman
        </button>
      ) : assignment.aiStrawman ? (
        <span className="mono" style={{ fontSize: 9, color: 'var(--ink-subtle)', whiteSpace: 'nowrap' }}>Strawman coming</span>
      ) : null}
      <button type="button" onClick={onOpen} disabled={opening} className="btn-primary" style={{ justifyContent: 'center', whiteSpace: 'nowrap', opacity: opening ? 0.6 : 1 }}>
        {opening ? 'Opening…' : status ? 'Continue' : 'Start'}
      </button>
    </div>
  )
}
