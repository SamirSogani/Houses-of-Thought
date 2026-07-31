'use client'

// Renders one ReviewPanelVerdict (decision 019 §3 — "review panel," not
// "critic") as a 9-standard pass/fail grid with notes, plus a collapsible raw
// JSON viewer of both the reviewed artifact and the verdict — this is what
// satisfies the Phase 1 verification plan's "manually inspect every packet
// and every panel verdict."

import { useState } from 'react'
import { CheckIcon, XIcon, ChevronIcon } from '@/components/icons'
import { STANDARDS } from '@/lib/ai/reasoning/standards'
import type { ReviewPanelVerdict } from '@/lib/ai/reasoning/contracts'

export function ReviewPanelVerdictPanel({
  label,
  verdict,
  artifact,
}: {
  label: string
  verdict: ReviewPanelVerdict
  artifact?: unknown
}) {
  const [open, setOpen] = useState(false)
  const passCount = STANDARDS.filter((s) => verdict.standards[s.id].pass).length

  return (
    <div style={{ marginLeft: 24, marginTop: 2, marginBottom: 2 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 11.5,
          color: 'var(--ink-subtle)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '2px 0',
        }}
      >
        <span style={{ transform: open ? 'rotate(180deg)' : 'none', display: 'inline-flex' }}>
          <ChevronIcon size={11} />
        </span>
        {label}: {passCount}/9 standards passed{verdict.degraded ? ' · degraded' : ''}
      </button>

      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4, marginLeft: 15 }}>
          {STANDARDS.map((s) => {
            const v = verdict.standards[s.id]
            return (
              <div key={s.id} style={{ display: 'flex', gap: 8, fontSize: 11.5, lineHeight: 1.4 }}>
                <span style={{ flex: '0 0 auto', width: 14 }}>{v.pass ? <CheckIcon size={12} /> : <XIcon size={12} />}</span>
                <span style={{ flex: '0 0 auto', width: 84, fontWeight: 600, color: 'var(--ink)' }}>{s.name}</span>
                <span style={{ flex: 1, color: 'var(--ink-subtle)' }}>{v.notes}</span>
              </div>
            )
          })}
          <details style={{ marginTop: 4 }}>
            <summary style={{ fontSize: 11, color: 'var(--ink-subtle)', cursor: 'pointer' }}>Raw JSON (artifact + verdict)</summary>
            <pre
              style={{
                fontSize: 10.5,
                background: 'var(--parchment)',
                padding: 8,
                borderRadius: 6,
                overflowX: 'auto',
                color: 'var(--ink-subtle)',
              }}
            >
              {JSON.stringify({ artifact, verdict }, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  )
}
