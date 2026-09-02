// Layer 4 — Assumptions as a grid of cards (builder-workspace-redesign plan
// §3, phase 3). The prototype labels each card with a category (Unstated /
// Foundational / Unknown unknown) that is not in the data model; cards carry
// their number instead.

import type { Action, State } from '@/lib/build/types'
import { Avatar } from '../Avatar'
import { people } from '@/lib/build/people'
import { InlineText, RemoveButton } from '../Editable'
import { AddRow } from './PerspectiveDetail'

export function AssumptionsLayer({ state, dispatch }: { state: State; dispatch: React.Dispatch<Action> }) {
  return (
    <div className="fade-in" style={{ marginTop: 18 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
        {state.assumptions.map((a, i) => (
          <div key={a.id} className="pop" style={{ background: 'var(--amber-tint)', border: '1px solid rgba(242,176,33,0.45)', borderRadius: 11, padding: '11px 12px 10px', display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="mono" style={{ fontSize: 9, letterSpacing: '0.11em', color: 'var(--amber-text)', flex: '1 1 auto' }}>
                Assumption {String(i + 1).padStart(2, '0')}
              </span>
              <Avatar who={a.owner} size={18} title={people[a.owner].name} />
              <RemoveButton title="Remove assumption" onClick={() => dispatch({ type: 'REMOVE_ASSUMPTION', id: a.id })} style={{ width: 20, height: 20, fontSize: 13 }} />
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.5 }}>
              <InlineText
                ariaLabel="Assumption"
                multiline
                value={a.text}
                placeholder="What has to be true for the reasoning to hold?"
                onChange={(value) => dispatch({ type: 'EDIT_ASSUMPTION', id: a.id, value })}
              />
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 10 }}>
        <AddRow label="+ Add an assumption" onClick={() => dispatch({ type: 'ADD_ASSUMPTION' })} />
      </div>
    </div>
  )
}
