// Layer 2 — Perspectives grid (drill-in detail handled by PerspectiveDetail).
// See handoff 05 §7 (Grid) / 04 §4.

import type { Action, State } from '@/lib/build/types'
import { people } from '@/lib/build/people'
import { Avatar } from '../Avatar'
import { ChevronRight } from '../buildIcons'
import { InlineText, RemoveButton } from '../Editable'

// Keep clicks and Enter/Space keystrokes inside an editable field from bubbling
// to the card (which opens the perspective detail on click/keydown).
const stop = (e: React.SyntheticEvent) => e.stopPropagation()

export function PerspectivesLayer({ state, dispatch }: { state: State; dispatch: React.Dispatch<Action> }) {
  return (
    <div className="fade-in" style={{ marginTop: 24 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 12, flexWrap: 'wrap' }}>
        <span className="mono" style={{ fontSize: 10, color: 'var(--ink-subtle)' }}>
          {state.perspectives.length} perspectives · open one, or click a face to reassign
        </span>
        <button
          type="button"
          onClick={() => dispatch({ type: 'ADD_PERSPECTIVE' })}
          style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)', border: '1px solid var(--ink)', borderRadius: 7, padding: '7px 12px', background: 'transparent' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--ink)'; e.currentTarget.style.color = 'var(--parchment)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ink)' }}
        >
          + Add perspective
        </button>
      </div>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
        {state.perspectives.map((p) => {
          return (
            <div
              key={p.id}
              className="pop"
              role="button"
              tabIndex={0}
              onClick={() => dispatch({ type: 'OPEN_PERSPECTIVE', id: p.id })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  dispatch({ type: 'OPEN_PERSPECTIVE', id: p.id })
                }
              }}
              style={{
                background: 'var(--white)',
                border: '1px solid var(--rule)',
                borderRadius: 12,
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                cursor: 'pointer',
                transition: 'border-color 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--ink)')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--rule)')}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <span onClick={stop} onKeyDown={stop} style={{ flex: 1, minWidth: 0, fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 17, color: 'var(--ink)' }}>
                  <InlineText
                    ariaLabel="Perspective name"
                    value={p.name}
                    placeholder="Stakeholder"
                    onChange={(value) => dispatch({ type: 'EDIT_PERSPECTIVE', id: p.id, field: 'name', value })}
                  />
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <RemoveButton title="Remove perspective" onClick={(e) => { stop(e); dispatch({ type: 'REMOVE_PERSPECTIVE', id: p.id }) }} />
                  <Avatar who={p.owner} size={26} title={people[p.owner].name} />
                  <span style={{ color: 'var(--ink-subtle)', display: 'inline-flex' }}>
                    <ChevronRight size={14} stroke="var(--ink-subtle)" />
                  </span>
                </span>
              </div>
              <div onClick={stop} onKeyDown={stop} style={{ fontSize: 13, color: 'var(--ink-mid)', lineHeight: 1.5, minHeight: 38 }}>
                <InlineText
                  ariaLabel="Perspective summary"
                  multiline
                  value={p.summary}
                  placeholder="What does this stakeholder value and fear?"
                  onChange={(value) => dispatch({ type: 'EDIT_PERSPECTIVE', id: p.id, field: 'summary', value })}
                />
              </div>
              {/* Real counts only — the old per-perspective strength bar rendered
                  Perspective.strength, which no code path ever computed (every
                  real perspective showed a permanent 0). */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="mono" style={{ fontSize: 9, color: 'var(--ink-subtle)' }}>{p.subQuestions.length} questions</span>
                <span className="mono" style={{ fontSize: 9, color: 'var(--ink-subtle)' }}>{p.counters.length} counters</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
