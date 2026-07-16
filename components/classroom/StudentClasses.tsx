'use client'

// The student side of the classroom (decision 010): join a class with the code a
// teacher shares, then see every class you're in with a live progress count. The
// assignments themselves are listed/opened by <StudentAssignments/> below this on
// the panel. Joining redeems the code via the join_class() RPC (SECURITY DEFINER;
// the RPC uppercases the code) and refreshes the list in place.

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ASSIGNMENT_COLUMNS, rowToAssignment, type AssignmentRow } from '@/lib/classroom/assignments'
import type { HouseStatus } from '@/lib/dashboard/houses'

interface ClassProgress {
  id: string
  name: string
  total: number
  complete: number
}

const cardBase: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  background: 'var(--white)',
  border: '1px solid var(--rule)',
  borderRadius: 'var(--radius-card)',
  padding: 20,
  minHeight: 130,
}

export function StudentClasses() {
  const [classes, setClasses] = useState<ClassProgress[] | null>(null)
  const [code, setCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setClasses([])
      return
    }

    const { data: memberships } = await supabase.from('class_members').select('class_id').eq('user_id', user.id)
    const classIds = ((memberships as { class_id: string }[]) ?? []).map((m) => m.class_id)
    if (classIds.length === 0) {
      setClasses([])
      return
    }

    const [{ data: classRows }, { data: a }, { data: houses }] = await Promise.all([
      supabase.from('classes').select('id, name').in('id', classIds),
      supabase.from('assignments').select(ASSIGNMENT_COLUMNS).in('class_id', classIds),
      supabase.from('houses').select('assignment_id, status').eq('owner_id', user.id).eq('is_strawman', false).not('assignment_id', 'is', null),
    ])

    // Which assignments this student has completed (their linked house is complete).
    const doneByAssignment = new Set<string>()
    for (const h of (houses as { assignment_id: string; status: HouseStatus }[]) ?? []) {
      if (h.status === 'complete') doneByAssignment.add(h.assignment_id)
    }

    // Tally assignments (and completions) per class.
    const totals: Record<string, number> = {}
    const dones: Record<string, number> = {}
    for (const row of (a as AssignmentRow[]) ?? []) {
      const asg = rowToAssignment(row)
      totals[asg.classId] = (totals[asg.classId] ?? 0) + 1
      if (doneByAssignment.has(asg.id)) dones[asg.classId] = (dones[asg.classId] ?? 0) + 1
    }

    const list = ((classRows as { id: string; name: string }[]) ?? [])
      .map((c) => ({ id: c.id, name: c.name, total: totals[c.id] ?? 0, complete: dones[c.id] ?? 0 }))
      .sort((x, y) => x.name.localeCompare(y.name))
    setClasses(list)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleJoin() {
    const trimmed = code.trim()
    if (!trimmed || joining) return
    setJoining(true)
    setJoinError(null)
    const supabase = createClient()
    const { error } = await supabase.rpc('join_class', { code: trimmed })
    setJoining(false)
    if (error) {
      setJoinError('That join code is not valid. Check it with your teacher and try again.')
      return
    }
    setCode('')
    load()
  }

  return (
    <section>
      {/* Join a class */}
      <div style={{ ...cardBase, minHeight: 0, gap: 12 }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 18, color: 'var(--ink)' }}>Join a class</h2>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--ink-mid)', marginTop: 4 }}>
            Enter the code your teacher gave you.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input
            className="acct-input"
            aria-label="Class join code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleJoin()
            }}
            placeholder="e.g. 4KP2ZQ"
            autoCapitalize="characters"
            style={{
              flex: '1 1 200px',
              height: 42,
              padding: '0 12px',
              fontFamily: 'var(--font-mono)',
              fontSize: 15,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--ink)',
              background: 'var(--white)',
              border: '1px solid var(--rule)',
              borderRadius: 8,
              outline: 'none',
            }}
          />
          <button
            type="button"
            onClick={handleJoin}
            disabled={joining || code.trim().length === 0}
            className="btn-primary"
            style={{
              justifyContent: 'center',
              opacity: joining || code.trim().length === 0 ? 0.55 : 1,
              cursor: joining || code.trim().length === 0 ? 'default' : 'pointer',
            }}
          >
            {joining ? 'Joining…' : 'Join class'}
          </button>
        </div>
        {joinError && (
          <p className="mono" style={{ fontSize: 11, color: 'var(--warning)' }}>{joinError}</p>
        )}
      </div>

      {/* Classes you're in */}
      <div style={{ marginTop: 'clamp(24px, 3vw, 32px)' }}>
        {classes === null ? (
          <p className="mono" style={{ fontSize: 11, letterSpacing: '0.11em', textTransform: 'uppercase', color: 'var(--ink-subtle)' }}>
            Loading your classes…
          </p>
        ) : classes.length === 0 ? (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 15, color: 'var(--ink-subtle)' }}>
            You haven&apos;t joined any classes yet. Enter a join code above to get started.
          </p>
        ) : (
          <div className="acct-card-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
            {classes.map((c) => (
              <div key={c.id} style={cardBase}>
                <h3
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 500,
                    fontSize: 20,
                    letterSpacing: '-0.01em',
                    color: 'var(--ink)',
                    lineHeight: 1.2,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {c.name}
                </h3>
                <div className="mono" style={{ fontSize: 10, color: 'var(--ink-subtle)', marginTop: 10 }}>
                  {c.total === 0
                    ? 'No assignments yet'
                    : `${c.complete}/${c.total} assignment${c.total === 1 ? '' : 's'} complete`}
                </div>
                {c.total > 0 && (
                  <div style={{ marginTop: 'auto', paddingTop: 18 }}>
                    <div style={{ height: 6, borderRadius: 3, background: 'var(--rule)', overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${Math.round((c.complete / c.total) * 100)}%`,
                          background: 'var(--amber)',
                          transition: 'width 0.2s',
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
