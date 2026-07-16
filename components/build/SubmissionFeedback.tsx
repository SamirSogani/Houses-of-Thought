'use client'

// Teacher assessment surface (plan phase 6), shown under the header in the
// builder. In 'edit' mode (a teacher viewing a student's submission) it records a
// grade + written feedback and offers a one-click Socratic-critic summary to
// ground the grade. In 'view' mode (the student on their own house) it displays
// the teacher's feedback read-only, and renders nothing until feedback exists.

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Critique {
  headline: string
  weakestLink: { layer: number; why: string; question: string }
}

export function SubmissionFeedback({
  houseId,
  mode,
  house,
}: {
  houseId: string
  mode: 'edit' | 'view'
  // Serialized house content, used only in edit mode for the critic summary.
  house?: unknown
}) {
  const [feedback, setFeedback] = useState('')
  const [grade, setGrade] = useState('')
  const [exists, setExists] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [saveError, setSaveError] = useState(false)
  const [critique, setCritique] = useState<Critique | null>(null)
  const [critiquing, setCritiquing] = useState(false)
  const [open, setOpen] = useState(mode === 'edit')

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('submission_feedback')
      .select('feedback, grade')
      .eq('house_id', houseId)
      .maybeSingle()
    if (data) {
      setFeedback((data.feedback as string) ?? '')
      setGrade((data.grade as string) ?? '')
      setExists(true)
    }
    setLoaded(true)
  }, [houseId])

  useEffect(() => {
    load()
  }, [load])

  async function save() {
    if (saving) return
    setSaving(true)
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setSaving(false)
      return
    }
    const { error } = await supabase.from('submission_feedback').upsert({
      house_id: houseId,
      teacher_id: user.id,
      feedback,
      grade,
      updated_at: new Date().toISOString(),
    })
    setSaving(false)
    if (error) {
      setSaveError(true)
      return
    }
    setSaveError(false)
    setExists(true)
    setSavedAt(new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }))
  }

  async function runCritic() {
    if (critiquing || !house) return
    setCritiquing(true)
    try {
      const res = await fetch('/api/ai/critique', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ house }),
      })
      if (res.ok) setCritique((await res.json()) as Critique)
    } catch {
      /* leave critique null; teacher can retry */
    }
    setCritiquing(false)
  }

  // Student view: nothing to show until the teacher has left feedback.
  if (mode === 'view' && (!loaded || (!exists && !feedback && !grade))) return null

  const strip: React.CSSProperties = {
    flex: '0 0 auto',
    padding: '10px 24px',
    background: 'var(--white)',
    borderBottom: '1px solid var(--rule)',
  }

  if (mode === 'view') {
    return (
      <div style={strip}>
        <div className="mono" style={{ fontSize: 9, color: 'var(--ink-subtle)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
          Teacher feedback{grade ? ` · Grade: ${grade}` : ''}
        </div>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--ink)', margin: 0, whiteSpace: 'pre-wrap' }}>{feedback || '—'}</p>
      </div>
    )
  }

  // Edit mode (teacher).
  return (
    <div style={strip}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="mono"
        style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
      >
        {open ? '▾' : '▸'} Assess this submission{grade ? ` · Grade: ${grade}` : ''}
      </button>

      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <label className="mono" style={{ fontSize: 10, color: 'var(--ink-subtle)', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              GRADE
              <input
                className="bhp-input16"
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                placeholder="e.g. B+ / 8"
                style={{ width: 90, height: 34, padding: '0 10px', fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--ink)', background: 'var(--parchment)', border: '1px solid var(--rule)', borderRadius: 8, outline: 'none' }}
              />
            </label>
            <button type="button" onClick={runCritic} disabled={critiquing || !house} className="mono" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink)', border: '1px solid var(--ink)', borderRadius: 8, padding: '8px 12px', background: 'var(--white)', cursor: critiquing || !house ? 'default' : 'pointer', opacity: critiquing ? 0.6 : 1 }}>
              {critiquing ? 'Running critic…' : 'Critic summary'}
            </button>
            <button type="button" onClick={save} disabled={saving} className="btn-primary" style={{ marginLeft: 'auto', justifyContent: 'center', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Saving…' : 'Save feedback'}
            </button>
            {saveError ? (
              <span className="mono" style={{ fontSize: 9, color: 'var(--warning)' }}>Couldn&apos;t save — try again</span>
            ) : savedAt ? (
              <span className="mono" style={{ fontSize: 9, color: 'var(--green-strong)' }}>Saved {savedAt}</span>
            ) : null}
          </div>

          {critique && (
            <div style={{ background: 'var(--parchment)', border: '1px solid var(--rule)', borderRadius: 8, padding: '10px 12px' }}>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--ink)', margin: 0 }}>{critique.headline}</p>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--ink-mid)', margin: '6px 0 0' }}>
                <strong>Weakest link (layer {critique.weakestLink.layer}):</strong> {critique.weakestLink.why}
              </p>
              <button
                type="button"
                onClick={() =>
                  setFeedback((f) => `${f ? f + '\n\n' : ''}${critique.headline}\n\nWeakest link: ${critique.weakestLink.question}`)
                }
                className="mono"
                style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--blueprint)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px 0 0' }}
              >
                + Insert into feedback
              </button>
            </div>
          )}

          <textarea
            className="bhp-input16"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Written feedback for the student…"
            rows={3}
            style={{ resize: 'vertical', padding: '10px 12px', fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--ink)', background: 'var(--parchment)', border: '1px solid var(--rule)', borderRadius: 8, outline: 'none' }}
          />
        </div>
      )}
    </div>
  )
}
