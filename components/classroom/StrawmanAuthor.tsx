'use client'

// Teacher-side strawman authoring for one assignment (plan phase 5). The teacher
// enables the strawman, sets the audience/topics/criteria, generates the flawed
// argument, then reviews/revises it in the builder before students attack it.
// Rendered on the assignment detail page.

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { saveHouse } from '@/lib/build/persistence'
import { strawmanToState, type StrawmanContent } from '@/lib/classroom/strawman'

interface Data {
  question: string
  enabled: boolean
  houseId: string | null
  released: boolean
  gradeLevel: string
  age: string
  topics: string
  criteria: string
}

export function StrawmanAuthor({ assignmentId }: { assignmentId: string }) {
  const [d, setD] = useState<Data | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('assignments')
      .select('question, ai_strawman_enabled, strawman_house_id, strawman_released, strawman_grade_level, strawman_age, strawman_topics, strawman_criteria')
      .eq('id', assignmentId)
      .single()
    if (!data) return
    setD({
      question: data.question as string,
      enabled: data.ai_strawman_enabled as boolean,
      houseId: (data.strawman_house_id as string | null) ?? null,
      released: (data.strawman_released as boolean) ?? false,
      gradeLevel: (data.strawman_grade_level as string) ?? '',
      age: (data.strawman_age as string) ?? '',
      topics: (data.strawman_topics as string) ?? '',
      criteria: (data.strawman_criteria as string) ?? '',
    })
  }, [assignmentId])

  useEffect(() => {
    load()
  }, [load])

  function set<K extends keyof Data>(key: K, value: Data[K]) {
    setD((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  // The release gate (bl-H1 / migration 0024): students see nothing until the
  // teacher has reviewed the generated argument and flipped this on.
  async function setReleased(released: boolean) {
    if (!d || busy) return
    const supabase = createClient()
    const { error } = await supabase
      .from('assignments')
      .update({ strawman_released: released })
      .eq('id', assignmentId)
    if (error) {
      setError(released ? 'Could not release the strawman.' : 'Could not unrelease the strawman.')
      return
    }
    setError(null)
    set('released', released)
  }

  async function toggleEnabled(enabled: boolean) {
    if (!d || busy) return
    set('enabled', enabled)
    const supabase = createClient()
    await supabase.from('assignments').update({ ai_strawman_enabled: enabled }).eq('id', assignmentId)
  }

  // Persist the params, ensure the house exists, generate, then fill it.
  async function generate() {
    if (!d || busy) return
    setBusy(true)
    setError(null)
    const supabase = createClient()

    // 1. Save params (the route reads them from the DB, not the request) and
    //    UN-RELEASE: regenerating over a released strawman would swap the house
    //    under students mid-attack (bl-H1) — they lose access until the teacher
    //    reviews the new version and releases again.
    const { error: paramsErr } = await supabase
      .from('assignments')
      .update({
        strawman_grade_level: d.gradeLevel,
        strawman_age: d.age,
        strawman_topics: d.topics,
        strawman_criteria: d.criteria,
        strawman_released: false,
      })
      .eq('id', assignmentId)
    if (paramsErr) {
      setBusy(false)
      setError('Could not save the strawman settings.')
      return
    }
    set('released', false)

    // 2. Ensure the teacher-owned strawman house exists.
    const { data: hid, error: rpcErr } = await supabase.rpc('ensure_strawman_house', { aid: assignmentId })
    if (rpcErr || !hid) {
      setBusy(false)
      setError('Could not prepare the strawman house.')
      return
    }

    // 3. Generate the flawed argument and persist it into the house.
    try {
      const res = await fetch('/api/ai/strawman', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignmentId }),
      })
      if (!res.ok) throw new Error(String(res.status))
      const content = (await res.json()) as StrawmanContent
      await saveHouse(supabase, hid as string, strawmanToState(d.question, content))
    } catch {
      setBusy(false)
      setError('The AI could not generate a strawman. Please try again.')
      load()
      return
    }
    setBusy(false)
    load()
  }

  if (!d) return null

  return (
    <section style={{ background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 'var(--radius-card)', padding: 18, marginTop: 20 }}>
      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
        <input type="checkbox" checked={d.enabled} onChange={(e) => toggleEnabled(e.target.checked)} />
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 18, color: 'var(--ink)' }}>AI Strawman</span>
      </label>
      <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--ink-mid)', marginTop: 4 }}>
        Generate a deliberately flawed argument for students to attack and critique. You review and revise it before they see it.
      </p>

      {d.enabled && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginTop: 16 }}>
            <Field label="Grade level" value={d.gradeLevel} placeholder="e.g. 9th grade" onChange={(v) => set('gradeLevel', v)} />
            <Field label="Age" value={d.age} placeholder="e.g. 14" onChange={(v) => set('age', v)} />
          </div>
          <Field label="Extra topics to cover" value={d.topics} placeholder="Comma-separated topics to weave in" onChange={(v) => set('topics', v)} area />
          <Field label="Criteria for the AI (optional)" value={d.criteria} placeholder="Any extra guidance for the flawed argument" onChange={(v) => set('criteria', v)} area />

          {error && <p className="mono" style={{ fontSize: 11, color: 'var(--warning-text)', marginTop: 10 }}>{error}</p>}

          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 14, flexWrap: 'wrap' }}>
            <button type="button" onClick={generate} disabled={busy} className="btn-primary" style={{ justifyContent: 'center', opacity: busy ? 0.6 : 1, cursor: busy ? 'default' : 'pointer' }}>
              {busy ? 'Generating…' : d.houseId ? 'Regenerate strawman' : 'Generate strawman'}
            </button>
            {d.houseId && (
              <>
                <Link href={`/build/${d.houseId}`} className="mono" style={{ fontSize: 11, color: 'var(--ink)', border: '1px solid var(--ink)', borderRadius: 8, padding: '9px 14px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Review / revise →
                </Link>
                {d.released ? (
                  <span className="mono" style={{ fontSize: 10, color: 'var(--green-text)', display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                    Released — students can attack it
                    <button type="button" onClick={() => setReleased(false)} disabled={busy} style={{ font: 'inherit', color: 'var(--blueprint)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
                      Unrelease
                    </button>
                  </span>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setReleased(true)}
                      disabled={busy}
                      className="mono"
                      style={{ fontSize: 11, color: 'var(--parchment)', background: 'var(--ink)', border: '1px solid var(--ink)', borderRadius: 8, padding: '9px 14px', textTransform: 'uppercase', letterSpacing: '0.06em', cursor: busy ? 'default' : 'pointer' }}
                    >
                      Release to students
                    </button>
                    <span className="mono" style={{ fontSize: 9, color: 'var(--ink-subtle)' }}>Hidden from students until you release it.</span>
                  </>
                )}
              </>
            )}
          </div>
        </>
      )}
    </section>
  )
}

function Field({
  label,
  value,
  placeholder,
  onChange,
  area,
}: {
  label: string
  value: string
  placeholder: string
  onChange: (v: string) => void
  area?: boolean
}) {
  const common: React.CSSProperties = {
    padding: '9px 11px',
    fontFamily: 'var(--font-body)',
    fontSize: 14,
    color: 'var(--ink)',
    background: 'var(--parchment)',
    border: '1px solid var(--rule)',
    borderRadius: 8,
    outline: 'none',
    width: '100%',
  }
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: area ? 12 : 0 }}>
      <span className="mono" style={{ fontSize: 10, color: 'var(--ink-subtle)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</span>
      {area ? (
        <textarea className="acct-input" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={2} style={{ ...common, resize: 'vertical' }} />
      ) : (
        <input className="acct-input" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ ...common, height: 40 }} />
      )}
    </label>
  )
}
