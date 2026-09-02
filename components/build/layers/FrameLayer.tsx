// Layer 1 — Frame. See handoff 05 §6 / 07 §6.1.

import type { Action, State } from '@/lib/build/types'
import { InlineText, RemoveButton } from '../Editable'

const monoLabel: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: '0.11em',
  color: 'var(--ink-subtle)',
}

export function FrameLayer({
  state,
  dispatch,
  conceptsOnly = false,
}: {
  state: State
  dispatch: React.Dispatch<Action>
  // The document view (builder-workspace-redesign plan §2) renders purpose and
  // the question in the document header above every section, so its Frame
  // section holds only the concepts. The wizard-style full layer stays the
  // default for any other caller.
  conceptsOnly?: boolean
}) {
  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 22, marginTop: conceptsOnly ? 14 : 26 }}>
      {/* Purpose */}
      {!conceptsOnly && <div>
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
          <InlineText
            ariaLabel="Purpose"
            multiline
            value={state.purpose}
            placeholder="Why does this question matter, and who does the reasoning have to hold up to?"
            onChange={(value) => dispatch({ type: 'SET_PURPOSE', value })}
          />
        </div>
      </div>}

      {/* Overarching question */}
      {!conceptsOnly && <div>
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
          <InlineText
            ariaLabel="Overarching question"
            multiline
            value={state.question}
            placeholder="What's a question you can't crack?"
            onChange={(value) => dispatch({ type: 'SET_QUESTION', value })}
          />
        </div>
      </div>}

      {/* Concepts / definitions */}
      <div>
        {!conceptsOnly && <div style={monoLabel}>Concepts / definitions</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
          {state.concepts.map((c, i) => (
            <div
              key={i}
              className="pop"
              style={{ background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 11, padding: '12px 14px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ flex: 1, minWidth: 0, fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>
                  <InlineText
                    ariaLabel="Concept"
                    value={c.term}
                    placeholder="Concept"
                    onChange={(value) => dispatch({ type: 'EDIT_CONCEPT', idx: i, field: 'term', value })}
                  />
                </span>
                <RemoveButton
                  title="Remove concept"
                  onClick={() => dispatch({ type: 'REMOVE_CONCEPT', idx: i })}
                  style={{ width: 16, height: 16, fontSize: 13 }}
                />
              </div>
              <div style={{ fontSize: 13, color: 'var(--ink-mid)', lineHeight: 1.5, marginTop: 6 }}>
                <InlineText
                  ariaLabel="Definition"
                  multiline
                  value={c.definition}
                  placeholder="Define this concept…"
                  onChange={(value) => dispatch({ type: 'EDIT_CONCEPT', idx: i, field: 'definition', value })}
                />
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => dispatch({ type: 'ADD_CONCEPT' })}
            className="mono"
            style={{
              alignSelf: 'flex-start',
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
