// Perspective drill-in detail — fully editable. Reads and writes the
// perspective's own stance / sub-questions / supporting evidence / counters.
// See handoff 05 §7 (Detail) / 07 §3.

import type { Action, Perspective } from '@/lib/build/types'
import { color } from '@/lib/build/strength'
import { people } from '@/lib/build/people'
import { Avatar } from '../Avatar'
import { WarningIcon, ChevronLeft } from '../buildIcons'
import { InlineText, RemoveButton } from '../Editable'

const monoLabel = (extra?: React.CSSProperties): React.CSSProperties => ({
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: '0.11em',
  color: 'var(--ink-subtle)',
  ...extra,
})

function AddRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mono"
      style={{ alignSelf: 'flex-start', fontSize: 10, color: 'var(--ink-subtle)', background: 'transparent', border: '1px dashed var(--rule)', borderRadius: 8, padding: '6px 11px', marginTop: 2 }}
      onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--ink)'; e.currentTarget.style.borderColor = 'var(--ink)' }}
      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--ink-subtle)'; e.currentTarget.style.borderColor = 'var(--rule)' }}
    >
      {label}
    </button>
  )
}

export function PerspectiveDetail({
  perspective,
  dispatch,
  onBack,
}: {
  perspective: Perspective
  dispatch: React.Dispatch<Action>
  onBack: () => void
}) {
  const p = perspective
  const owner = people[p.owner]
  const strengthCol = color(p.strength)

  return (
    <div className="fade-in" style={{ marginTop: 8 }}>
      {/* Back link */}
      <button
        type="button"
        onClick={onBack}
        className="mono"
        style={{ fontSize: 10, color: 'var(--ink-subtle)', display: 'inline-flex', alignItems: 'center', gap: 5 }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ink)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-subtle)')}
      >
        <ChevronLeft size={12} />
        All perspectives
      </button>

      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 12, gap: 18, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={monoLabel({ color: 'var(--amber-hover)' })}>Perspective</div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 30, color: 'var(--ink)', marginTop: 4 }}>
            <InlineText
              ariaLabel="Perspective name"
              value={p.name}
              placeholder="Stakeholder"
              onChange={(value) => dispatch({ type: 'EDIT_PERSPECTIVE', id: p.id, field: 'name', value })}
            />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 18 }}>
          <div>
            <div style={monoLabel({ fontSize: 9 })}>Owner</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <button type="button" title="Reassign owner" onClick={() => dispatch({ type: 'CYCLE_OWNER', id: p.id })} style={{ padding: 0, lineHeight: 0, borderRadius: '50%' }}>
                <Avatar who={p.owner} size={24} title="Reassign owner" />
              </button>
              <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>{owner.name}</span>
            </div>
          </div>
          <div>
            <div style={monoLabel({ fontSize: 9 })}>Strength</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <span style={{ width: 60, height: 6, background: 'var(--rule)', borderRadius: 3, overflow: 'hidden' }}>
                <span className="build-bar-fill" style={{ display: 'block', height: '100%', width: `${p.strength}%`, background: strengthCol, transition: 'width 0.4s cubic-bezier(0.2,0.7,0.2,1)' }} />
              </span>
              <span className="mono" style={{ fontSize: 12, color: strengthCol }}>{p.strength}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stance */}
      <div
        style={{
          background: 'var(--parchment)',
          border: '1px solid var(--rule)',
          borderLeft: '3px solid var(--amber)',
          borderRadius: 10,
          padding: '14px 16px',
          marginTop: 16,
          fontSize: 16,
          color: 'var(--ink-mid)',
          lineHeight: 1.6,
        }}
      >
        <InlineText
          ariaLabel="Stance"
          multiline
          value={p.stance}
          placeholder="What is this stakeholder's overall position, in a sentence or two?"
          onChange={(value) => dispatch({ type: 'EDIT_PERSPECTIVE', id: p.id, field: 'stance', value })}
        />
      </div>

      {/* Sub-questions */}
      <div style={monoLabel({ margin: '24px 0 12px' })}>Sub-questions · {p.subQuestions.length}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {p.subQuestions.map((q, i) => (
          <div key={i} style={{ background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 11, padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <span style={{ flex: 1, minWidth: 0, fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 16, color: 'var(--ink)' }}>
                <InlineText
                  ariaLabel="Sub-question"
                  multiline
                  value={q.q}
                  placeholder="A question this perspective has to answer"
                  onChange={(value) => dispatch({ type: 'EDIT_SUBQUESTION', pid: p.id, idx: i, field: 'q', value })}
                />
              </span>
              <RemoveButton title="Remove sub-question" onClick={() => dispatch({ type: 'REMOVE_SUBQUESTION', pid: p.id, idx: i })} style={{ width: 16, height: 16, fontSize: 13 }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 8 }}>
              <span className="mono" style={{ fontSize: 9, color: 'var(--amber-hover)', paddingTop: 3 }}>Working</span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--ink-mid)', lineHeight: 1.55 }}>
                <InlineText
                  ariaLabel="Sub-question note"
                  multiline
                  value={q.note}
                  placeholder="Where the thinking currently stands"
                  onChange={(value) => dispatch({ type: 'EDIT_SUBQUESTION', pid: p.id, idx: i, field: 'note', value })}
                />
              </span>
            </div>
          </div>
        ))}
        <AddRow label="+ Add sub-question" onClick={() => dispatch({ type: 'ADD_SUBQUESTION', pid: p.id })} />
      </div>

      {/* Supporting evidence */}
      <div style={monoLabel({ margin: '24px 0 12px' })}>Supporting evidence</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {p.supportingEvidence.map((e, i) => (
          <div key={i} style={{ background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 11, padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: 'var(--ink)', lineHeight: 1.5 }}>
                <InlineText
                  ariaLabel="Supporting evidence"
                  multiline
                  value={e.text}
                  placeholder="A fact that supports this perspective"
                  onChange={(value) => dispatch({ type: 'EDIT_PERSPECTIVE_EVIDENCE', pid: p.id, idx: i, field: 'text', value })}
                />
              </span>
              <RemoveButton title="Remove evidence" onClick={() => dispatch({ type: 'REMOVE_PERSPECTIVE_EVIDENCE', pid: p.id, idx: i })} style={{ width: 16, height: 16, fontSize: 13 }} />
            </div>
            <div style={{ marginTop: 7 }}>
              <span className="mono" style={{ fontSize: 9, color: 'var(--blueprint)', background: 'rgba(62,92,138,0.09)', borderRadius: 4, padding: '3px 7px', display: 'inline-flex' }}>
                <input
                  aria-label="Evidence source"
                  value={e.source}
                  placeholder="Add source"
                  size={Math.max(e.source.length || 10, 8)}
                  onChange={(ev) => dispatch({ type: 'EDIT_PERSPECTIVE_EVIDENCE', pid: p.id, idx: i, field: 'source', value: ev.target.value })}
                  style={{ background: 'transparent', border: 'none', outline: 'none', font: 'inherit', color: 'inherit', padding: 0, width: 'auto' }}
                />
              </span>
            </div>
          </div>
        ))}
        <AddRow label="+ Add evidence" onClick={() => dispatch({ type: 'ADD_PERSPECTIVE_EVIDENCE', pid: p.id })} />
      </div>

      {/* Counterarguments */}
      <div style={monoLabel({ margin: '24px 0 12px', color: 'var(--warning)' })}>Counterarguments</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {p.counters.map((c, i) => (
          <div
            key={i}
            style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: 'var(--white)', border: '1px solid var(--rule)', borderLeft: '3px solid var(--warning)', borderRadius: 11, padding: '14px 16px' }}
          >
            <WarningIcon size={16} />
            <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: 'var(--ink-mid)', lineHeight: 1.5 }}>
              <InlineText
                ariaLabel="Counterargument"
                multiline
                value={c}
                placeholder="The strongest objection this perspective has to answer"
                onChange={(value) => dispatch({ type: 'EDIT_COUNTER', pid: p.id, idx: i, value })}
              />
            </span>
            <RemoveButton title="Remove counterargument" onClick={() => dispatch({ type: 'REMOVE_COUNTER', pid: p.id, idx: i })} style={{ width: 16, height: 16, fontSize: 13 }} />
          </div>
        ))}
        <AddRow label="+ Add counterargument" onClick={() => dispatch({ type: 'ADD_COUNTER', pid: p.id })} />
      </div>
    </div>
  )
}
