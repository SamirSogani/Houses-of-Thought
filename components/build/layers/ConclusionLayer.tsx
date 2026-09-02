'use client'

// Layer 5 — Conclusion (builder-workspace-redesign plan §3, phase 3). The one
// layer the AI never drafts (decision 016 §1, invariant 1): while both fields
// are empty the section is the prototype's "This is yours to write" empty
// state; "Write your conclusion" reveals the two editable blocks with the
// caret in the first. Once anything is written the blocks show directly.

import { useState } from 'react'
import type { Action, State } from '@/lib/build/types'
import { InlineText } from '../Editable'

const monoLabel: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: '0.11em',
  color: 'var(--ink-subtle)',
}

export function ConclusionLayer({ state, dispatch }: { state: State; dispatch: React.Dispatch<Action> }) {
  const hasAny = state.conclusion.trim().length > 0 || state.reasoning.trim().length > 0
  const [writing, setWriting] = useState(false)

  if (!hasAny && !writing) {
    return (
      <div className="fade-in" style={{ marginTop: 18, border: '1px dashed var(--rule)', borderRadius: 12, padding: '28px 20px', textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 18, color: 'var(--ink)' }}>This is yours to write</div>
        <div style={{ fontSize: 13, color: 'var(--ink-subtle)', lineHeight: 1.55, marginTop: 6, maxWidth: '44ch', marginLeft: 'auto', marginRight: 'auto' }}>
          {state.draft
            ? 'The co-pilot drafted perspectives, evidence, and assumptions. The conclusion is always yours.'
            : 'State where the reasoning lands, and trace how the evidence and perspectives carry into it.'}
        </div>
        <button
          type="button"
          onClick={() => setWriting(true)}
          style={{ marginTop: 16, height: 40, padding: '0 18px', background: 'var(--ink)', color: 'var(--parchment)', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer', border: 'none' }}
        >
          Write your conclusion
        </button>
      </div>
    )
  }

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 18 }}>
      {/* Central conclusion */}
      <div>
        <div style={monoLabel}>Central conclusion</div>
        <div style={{ background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 10, padding: '13px 15px', marginTop: 8, fontFamily: 'var(--font-display)', fontSize: 17, color: 'var(--ink)', lineHeight: 1.5 }}>
          <InlineText
            ariaLabel="Central conclusion"
            multiline
            autoFocus={writing && !hasAny}
            value={state.conclusion}
            placeholder="Where does the reasoning land? State the conclusion the perspectives carry into."
            onChange={(value) => dispatch({ type: 'SET_CONCLUSION', value })}
          />
        </div>
      </div>

      {/* Reasoning summary */}
      <div>
        <div style={monoLabel}>Reasoning summary</div>
        <div
          style={{
            background: 'var(--parchment)',
            border: '1px solid var(--rule)',
            borderLeft: '3px solid var(--amber)',
            borderRadius: 10,
            padding: '14px 16px',
            marginTop: 8,
            fontSize: 14,
            color: 'var(--ink-mid)',
            lineHeight: 1.65,
          }}
        >
          <InlineText
            ariaLabel="Reasoning summary"
            multiline
            value={state.reasoning}
            placeholder="Trace how the evidence and perspectives connect to that conclusion."
            onChange={(value) => dispatch({ type: 'SET_REASONING', value })}
          />
        </div>
      </div>
    </div>
  )
}
