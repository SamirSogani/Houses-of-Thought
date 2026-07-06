// Layer 4 — Assumptions. See handoff 05 §9 / 04 §6.

import type { Action, State } from '@/lib/build/types'
import { Avatar } from '../Avatar'
import { InlineText, RemoveButton } from '../Editable'

export function AssumptionsLayer({ state, dispatch }: { state: State; dispatch: React.Dispatch<Action> }) {
  return (
    <div className="fade-in" style={{ marginTop: 24 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 8, flexWrap: 'wrap' }}>
        <span className="mono" style={{ fontSize: 10, color: 'var(--ink-subtle)' }}>{state.assumptions.length} foundational assumptions</span>
        <button
          type="button"
          onClick={() => dispatch({ type: 'ADD_ASSUMPTION' })}
          style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)', border: '1px solid var(--ink)', borderRadius: 7, padding: '7px 12px', background: 'transparent' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--ink)'; e.currentTarget.style.color = 'var(--parchment)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ink)' }}
        >
          + Add assumption
        </button>
      </div>

      {/* List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {state.assumptions.map((a, i) => (
          <div key={a.id} className="pop" style={{ background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 11, padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'center' }}>
            <span className="mono" style={{ width: 22, height: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--rule)', borderRadius: 6, fontSize: 9, color: 'var(--ink-subtle)', flex: '0 0 auto' }}>
              {String(i + 1).padStart(2, '0')}
            </span>
            <span style={{ fontSize: 14, color: 'var(--ink)', flex: 1, minWidth: 0 }}>
              <InlineText
                ariaLabel="Assumption"
                multiline
                value={a.text}
                placeholder="What has to be true for the reasoning to hold?"
                onChange={(value) => dispatch({ type: 'EDIT_ASSUMPTION', id: a.id, value })}
              />
            </span>
            <Avatar who={a.owner} size={22} />
            <RemoveButton title="Remove assumption" onClick={() => dispatch({ type: 'REMOVE_ASSUMPTION', id: a.id })} />
          </div>
        ))}
      </div>
    </div>
  )
}
