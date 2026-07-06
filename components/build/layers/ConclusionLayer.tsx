// Layer 5 — Conclusion. Editable central conclusion + reasoning summary.
// See handoff 05 §9b / 07 §6.2.

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
  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 24 }}>
      {/* Central conclusion */}
      <div>
        <div style={monoLabel}>Central conclusion</div>
        <div style={{ background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 10, padding: '13px 15px', marginTop: 8, fontSize: 14, color: 'var(--ink)', lineHeight: 1.55 }}>
          <InlineText
            ariaLabel="Central conclusion"
            multiline
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
            padding: '15px 18px',
            marginTop: 8,
            fontSize: 15,
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
