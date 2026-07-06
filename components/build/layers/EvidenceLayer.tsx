// Layer 3 — Evidence. See handoff 05 §8 / 04 §5.

import type { Action, State } from '@/lib/build/types'
import { Avatar } from '../Avatar'
import { SearchIcon } from '../buildIcons'
import { people } from '@/lib/build/people'
import { InlineText, RemoveButton } from '../Editable'

export function EvidenceLayer({ state, dispatch }: { state: State; dispatch: React.Dispatch<Action> }) {
  return (
    <div className="fade-in" style={{ marginTop: 24 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 8, flexWrap: 'wrap' }}>
        <span className="mono" style={{ fontSize: 10, color: 'var(--ink-subtle)' }}>{state.evidence.length} sourced facts</span>
        <span style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => dispatch({ type: 'RESEARCH_MODE' })}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 600, fontSize: 12, color: 'var(--ink)', background: 'var(--amber-tint)', border: '1px solid var(--amber)', borderRadius: 6, padding: '5px 11px' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--amber)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--amber-tint)')}
          >
            <SearchIcon size={13} />
            Research Mode
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: 'ADD_EVIDENCE' })}
            style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)', border: '1px solid var(--ink)', borderRadius: 7, padding: '7px 12px', background: 'transparent' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--ink)'; e.currentTarget.style.color = 'var(--parchment)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ink)' }}
          >
            + Manual
          </button>
        </span>
      </div>

      {/* List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {state.evidence.map((e) => (
          <div key={e.id} className="pop" style={{ background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 11, padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <Avatar who={e.owner} size={24} title={people[e.owner].name} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.5 }}>
                <InlineText
                  ariaLabel="Evidence claim"
                  multiline
                  value={e.text}
                  placeholder="A claim to support with a citation."
                  onChange={(value) => dispatch({ type: 'EDIT_EVIDENCE', id: e.id, field: 'text', value })}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 7, flexWrap: 'wrap' }}>
                <span className="mono" style={{ fontSize: 9, color: 'var(--blueprint)', background: 'rgba(62,92,138,0.09)', borderRadius: 4, padding: '3px 7px', display: 'inline-flex' }}>
                  <input
                    aria-label="Evidence source"
                    value={e.source}
                    placeholder="Add source"
                    size={Math.max(e.source.length || 10, 8)}
                    onChange={(ev) => dispatch({ type: 'EDIT_EVIDENCE', id: e.id, field: 'source', value: ev.target.value })}
                    style={{ background: 'transparent', border: 'none', outline: 'none', font: 'inherit', color: 'inherit', padding: 0, width: 'auto' }}
                  />
                </span>
                {e.byAI && <span className="mono" style={{ fontSize: 9, color: 'var(--amber-hover)' }}>via Research Mode</span>}
              </div>
            </div>
            <RemoveButton title="Remove evidence" onClick={() => dispatch({ type: 'REMOVE_EVIDENCE', id: e.id })} />
          </div>
        ))}
      </div>
    </div>
  )
}
