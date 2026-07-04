// Layer 1 — Frame. See handoff 05 §6 / 07 §6.1.

import type { Action, State } from '@/lib/build/types'
import { framePurpose, frameQuestion } from '@/lib/build/content'

const monoLabel: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: '0.11em',
  color: 'var(--ink-subtle)',
}

export function FrameLayer({ state, dispatch }: { state: State; dispatch: React.Dispatch<Action> }) {
  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 22, marginTop: 26 }}>
      {/* Purpose */}
      <div>
        <div style={monoLabel}>Purpose</div>
        <div
          style={{
            background: 'var(--white)',
            border: '1px solid var(--rule)',
            borderRadius: 10,
            padding: '14px 16px',
            marginTop: 8,
            fontSize: 15,
            color: 'var(--ink-mid)',
            lineHeight: 1.55,
          }}
        >
          {framePurpose}
        </div>
      </div>

      {/* Overarching question */}
      <div>
        <div style={monoLabel}>Overarching question</div>
        <div
          style={{
            background: 'var(--white)',
            border: '1px solid var(--rule)',
            borderRadius: 10,
            padding: '16px 18px',
            marginTop: 8,
            fontFamily: 'var(--font-display)',
            fontWeight: 500,
            fontSize: 22,
            color: 'var(--ink)',
          }}
        >
          {frameQuestion}
        </div>
      </div>

      {/* Key concepts */}
      <div>
        <div style={monoLabel}>Key concepts</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
          {state.concepts.map((c, i) => (
            <span
              key={`${c}-${i}`}
              className="pop"
              style={{
                fontSize: 13,
                color: 'var(--ink)',
                background: 'var(--white)',
                border: '1px solid var(--rule)',
                borderRadius: 20,
                padding: '7px 14px',
              }}
            >
              {c}
            </span>
          ))}
          <button
            type="button"
            onClick={() => dispatch({ type: 'ADD_CONCEPT' })}
            className="mono"
            style={{
              fontSize: 10,
              color: 'var(--ink-subtle)',
              background: 'transparent',
              border: '1px dashed var(--rule)',
              borderRadius: 20,
              padding: '7px 14px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--ink)'
              e.currentTarget.style.borderColor = 'var(--ink)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--ink-subtle)'
              e.currentTarget.style.borderColor = 'var(--rule)'
            }}
          >
            + Concept
          </button>
        </div>
      </div>
    </div>
  )
}
