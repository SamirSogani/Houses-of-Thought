'use client'

// Teacher coursework manager for one class (plan phases 3-4). Owns the class's
// courses and assignments: create a course, create an assignment (optionally in a
// course), see them grouped by course in order, and reorder assignments within a
// course. Rendered inside the class hub page, above the roster.

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  rowToAssignment,
  dueLabel,
  ASSIGNMENT_COLUMNS,
  type AssignmentRow,
  type AssignmentSummary,
} from '@/lib/classroom/assignments'
import { rowToCourse, byPosition, type CourseRow, type CourseSummary } from '@/lib/classroom/courses'

const COURSE_COLUMNS = 'id, class_id, title, description, position, created_at'

export function AssignmentPanel({ classId }: { classId: string }) {
  const [courses, setCourses] = useState<CourseSummary[] | null>(null)
  const [items, setItems] = useState<AssignmentSummary[] | null>(null)
  const [question, setQuestion] = useState('')
  const [due, setDue] = useState('')
  const [courseId, setCourseId] = useState('') // '' = no course
  const [strawman, setStrawman] = useState(false)
  const [courseTitle, setCourseTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const supabase = createClient()
    const [{ data: c, error: ce }, { data: a, error: ae }] = await Promise.all([
      supabase.from('courses').select(COURSE_COLUMNS).eq('class_id', classId),
      supabase.from('assignments').select(ASSIGNMENT_COLUMNS).eq('class_id', classId),
    ])
    if (ce || ae) {
      setError('Could not load coursework.')
      setCourses([])
      setItems([])
      return
    }
    setError(null)
    setCourses((c as CourseRow[]).map(rowToCourse).sort(byPosition))
    setItems((a as AssignmentRow[]).map(rowToAssignment))
  }, [classId])

  useEffect(() => {
    load()
  }, [load])

  // Assignments in one group (a course id, or null for ungrouped), ordered.
  function groupItems(cid: string | null): AssignmentSummary[] {
    return (items ?? []).filter((a) => a.courseId === cid).sort(byPosition)
  }

  async function handleCreateCourse() {
    const title = courseTitle.trim()
    if (!title || busy) return
    setBusy(true)
    const supabase = createClient()
    const nextPos = (courses ?? []).reduce((m, c) => Math.max(m, c.position + 1), 0)
    const { error } = await supabase.from('courses').insert({ class_id: classId, title, position: nextPos })
    setBusy(false)
    if (error) {
      setError('Could not create the course.')
      return
    }
    setCourseTitle('')
    load()
  }

  async function handleCreateAssignment() {
    const q = question.trim()
    if (!q || busy) return
    setBusy(true)
    const supabase = createClient()
    const cid = courseId || null
    const nextPos = groupItems(cid).reduce((m, a) => Math.max(m, a.position + 1), 0)
    const { error } = await supabase.from('assignments').insert({
      class_id: classId,
      question: q,
      due_at: due ? new Date(due).toISOString() : null,
      course_id: cid,
      position: nextPos,
      ai_strawman_enabled: strawman,
    })
    setBusy(false)
    if (error) {
      setError('Could not create the assignment.')
      return
    }
    setQuestion('')
    setDue('')
    setStrawman(false)
    load()
  }

  // Move an assignment up/down within its group. Rewrites the whole group's
  // positions to 0..n-1 so order is well-defined regardless of prior values.
  async function reorder(a: AssignmentSummary, dir: -1 | 1) {
    if (busy) return
    const group = groupItems(a.courseId)
    const idx = group.findIndex((x) => x.id === a.id)
    const target = idx + dir
    if (target < 0 || target >= group.length) return
    setBusy(true)
    const reordered = [...group]
    ;[reordered[idx], reordered[target]] = [reordered[target], reordered[idx]]
    const supabase = createClient()
    await Promise.all(
      reordered.map((x, i) => supabase.from('assignments').update({ position: i }).eq('id', x.id))
    )
    setBusy(false)
    load()
  }

  const loading = courses === null || items === null

  return (
    <section style={{ marginTop: 'clamp(20px, 3vw, 32px)' }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 22, color: 'var(--ink)', marginBottom: 14 }}>
        Coursework
      </h2>

      {/* Create controls */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 'var(--radius-card)', padding: 16 }}>
        {/* New course */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            className="acct-input" aria-label="Course title"
            value={courseTitle}
            onChange={(e) => setCourseTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreateCourse() }}
            placeholder="New course / unit — e.g. Unit 1: Framing"
            style={inputStyle}
          />
          <button type="button" onClick={handleCreateCourse} disabled={busy || courseTitle.trim().length === 0} className="mono" style={secondaryBtn(busy || courseTitle.trim().length === 0)}>
            Add course
          </button>
        </div>

        <div style={{ height: 1, background: 'var(--rule-soft)', margin: '2px 0' }} />

        {/* New assignment */}
        <textarea
          className="acct-input" aria-label="Assignment question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Pose a question — e.g. Should our school ban phones?"
          rows={2}
          style={{ ...inputStyle, resize: 'vertical', height: 'auto', padding: '10px 12px' }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <select className="acct-input" aria-label="Course" value={courseId} onChange={(e) => setCourseId(e.target.value)} style={{ ...inputStyle, width: 'auto', minWidth: 160 }}>
            <option value="">No course</option>
            {(courses ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
          <label className="mono" style={{ fontSize: 10, color: 'var(--ink-subtle)', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            DUE
            <input type="date" className="acct-input" value={due} onChange={(e) => setDue(e.target.value)} style={{ ...inputStyle, width: 'auto' }} />
          </label>
          <label className="mono" style={{ fontSize: 10, color: 'var(--ink-subtle)', display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }} title="Give students an AI strawman argument to attack and critique.">
            <input type="checkbox" checked={strawman} onChange={(e) => setStrawman(e.target.checked)} />
            AI STRAWMAN
          </label>
          <button type="button" onClick={handleCreateAssignment} disabled={busy || question.trim().length === 0} className="btn-primary" style={{ marginLeft: 'auto', justifyContent: 'center', opacity: busy || question.trim().length === 0 ? 0.55 : 1, cursor: busy || question.trim().length === 0 ? 'default' : 'pointer' }}>
            Create assignment
          </button>
        </div>
      </div>

      {error && <p className="mono" style={{ fontSize: 11, color: 'var(--warning)', marginTop: 12 }}>{error}</p>}

      {/* Grouped list */}
      {loading ? (
        <p className="mono" style={{ fontSize: 11, color: 'var(--ink-subtle)', marginTop: 16 }}>Loading coursework…</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: 20 }}>
          {(courses ?? []).map((c) => (
            <CourseGroup key={c.id} classId={classId} title={c.title} description={c.description} items={groupItems(c.id)} onReorder={reorder} busy={busy} />
          ))}
          {groupItems(null).length > 0 && (
            <CourseGroup classId={classId} title="Ungrouped" description="" items={groupItems(null)} onReorder={reorder} busy={busy} />
          )}
          {(courses ?? []).length === 0 && groupItems(null).length === 0 && (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--ink-subtle)' }}>
              No coursework yet. Add a course or an assignment above.
            </p>
          )}
        </div>
      )}
    </section>
  )
}

function CourseGroup({
  classId,
  title,
  description,
  items,
  onReorder,
  busy,
}: {
  classId: string
  title: string
  description: string
  items: AssignmentSummary[]
  onReorder: (a: AssignmentSummary, dir: -1 | 1) => void
  busy: boolean
}) {
  return (
    <div>
      <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 17, color: 'var(--ink)' }}>{title}</h3>
      {description && <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--ink-mid)', marginTop: 2 }}>{description}</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
        {items.length === 0 ? (
          <p className="mono" style={{ fontSize: 10, color: 'var(--ink-subtle)' }}>No assignments</p>
        ) : (
          items.map((a, i) => {
            const dl = dueLabel(a.dueAt)
            return (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 10, padding: '10px 12px' }}>
                <span className="acct-reorder-stack" style={{ display: 'inline-flex', flexDirection: 'column', gap: 2 }}>
                  <button type="button" className="acct-reorder" aria-label="Move up" disabled={busy || i === 0} onClick={() => onReorder(a, -1)} style={reorderBtn(busy || i === 0)}>▲</button>
                  <button type="button" className="acct-reorder" aria-label="Move down" disabled={busy || i === items.length - 1} onClick={() => onReorder(a, 1)} style={reorderBtn(busy || i === items.length - 1)}>▼</button>
                </span>
                <Link href={`/classroom/${classId}/assignments/${a.id}`} style={{ flex: 1, minWidth: 0, fontFamily: 'var(--font-body)', fontSize: 15, color: 'var(--ink)' }}>
                  {a.question}
                </Link>
                {a.aiStrawman && (
                  <span className="mono" style={{ fontSize: 8, color: 'var(--blueprint)', border: '1px solid var(--blueprint)', borderRadius: 4, padding: '2px 6px', whiteSpace: 'nowrap' }}>
                    Strawman
                  </span>
                )}
                {dl && <span className="mono" style={{ fontSize: 9, color: 'var(--ink-subtle)', whiteSpace: 'nowrap' }}>{dl}</span>}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  height: 42,
  padding: '0 12px',
  fontFamily: 'var(--font-body)',
  fontSize: 15,
  color: 'var(--ink)',
  background: 'var(--parchment)',
  border: '1px solid var(--rule)',
  borderRadius: 8,
  outline: 'none',
  flex: 1,
  minWidth: 180,
}

function secondaryBtn(disabled: boolean): React.CSSProperties {
  return {
    height: 38,
    padding: '0 14px',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: 'var(--ink)',
    background: 'var(--white)',
    border: '1px solid var(--ink)',
    borderRadius: 8,
    opacity: disabled ? 0.5 : 1,
    cursor: disabled ? 'default' : 'pointer',
  }
}

function reorderBtn(disabled: boolean): React.CSSProperties {
  return {
    fontSize: 8,
    lineHeight: 1.1,
    color: disabled ? 'var(--rule)' : 'var(--ink-subtle)',
    background: 'transparent',
    border: 'none',
    cursor: disabled ? 'default' : 'pointer',
    padding: '1px 4px',
  }
}
