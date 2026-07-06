// Layer 6 — Implications. See handoff 05 §10 / 04 §8 / 07 §6.3.

import type { Action, Implication, ImplicationKind, State } from '@/lib/build/types'
import { EyeIcon } from '../buildIcons'
import { InlineText, RemoveButton } from '../Editable'

const columns: { kind: ImplicationKind; label: string; accent: string }[] = [
  { kind: 'pos', label: 'Positive', accent: 'var(--green-strong)' },
  { kind: 'neg', label: 'Negative', accent: 'var(--warning)' },
  { kind: 'unc', label: 'Uncertain', accent: 'var(--green-mid)' },
]

const metaChip: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 8,
  textTransform: 'uppercase',
  letterSpacing: '0.11em',
  color: 'var(--ink-subtle)',
  border: '1px solid var(--rule)',
  borderRadius: 4,
  padding: '2px 6px',
}

export function ImplicationsLayer({ state, dispatch }: { state: State; dispatch: React.Dispatch<Action> }) {
  const total = state.pos.length + state.neg.length + state.unc.length

  return (
    <div className="fade-in" style={{ marginTop: 24 }}>
      {/* Framing row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <span className="mono" style={{ fontSize: 10, color: 'var(--ink-subtle)', background: 'var(--parchment)', border: '1px solid var(--rule)', borderRadius: 20, padding: '5px 11px' }}>
          {total} implications mapped
        </span>
        <span style={{ fontSize: 14, color: 'var(--ink-subtle)' }}>Sorted by register and tagged with time horizon and who it lands on.</span>
      </div>

      {/* Columns */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {columns.map(({ kind, label, accent }) => {
          const items = state[kind] as Implication[]
          return (
            <div key={kind} style={{ background: 'var(--white)', border: '1px solid var(--rule)', borderTop: `3px solid ${accent}`, borderRadius: 11, padding: 15 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="mono" style={{ fontSize: 10, color: accent }}>{label} · {items.length}</span>
                <button
                  type="button"
                  title={`Add ${label.toLowerCase()} implication`}
                  onClick={() => dispatch({ type: 'ADD_IMPLICATION', kind })}
                  style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--ink-subtle)', lineHeight: 1 }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ink)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-subtle)')}
                >
                  +
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                {items.map((it) => (
                  <div key={it.id} className="pop" style={{ border: '1px solid var(--rule-soft)', borderRadius: 9, padding: '11px 12px' }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                      <div style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--ink)', lineHeight: 1.45 }}>
                        <InlineText
                          ariaLabel={`${label} implication`}
                          multiline
                          value={it.text}
                          placeholder="What follows if the conclusion holds?"
                          onChange={(value) => dispatch({ type: 'EDIT_IMPLICATION', kind, id: it.id, field: 'text', value })}
                        />
                      </div>
                      <RemoveButton title="Remove implication" onClick={() => dispatch({ type: 'REMOVE_IMPLICATION', kind, id: it.id })} style={{ width: 16, height: 16, fontSize: 13 }} />
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        title="Toggle time horizon"
                        onClick={() => dispatch({ type: 'TOGGLE_IMPLICATION_HORIZON', kind, id: it.id })}
                        style={{ ...metaChip, cursor: 'pointer', background: 'transparent' }}
                      >
                        {it.horizon}
                      </button>
                      <span style={{ ...metaChip, display: 'inline-flex' }}>
                        <input
                          aria-label="Who it lands on"
                          value={it.who}
                          placeholder="Who"
                          size={Math.max(it.who.length || 5, 3)}
                          onChange={(e) => dispatch({ type: 'EDIT_IMPLICATION', kind, id: it.id, field: 'who', value: e.target.value })}
                          style={{ background: 'transparent', border: 'none', outline: 'none', font: 'inherit', color: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit', padding: 0, width: 'auto' }}
                        />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Watchpoints */}
      <div style={{ marginTop: 22, background: 'var(--parchment)', border: '1px solid var(--rule)', borderRadius: 12, padding: '18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <EyeIcon size={16} />
          <span className="mono" style={{ fontSize: 10, color: 'var(--ink-mid)' }}>Signals to watch · would change the conclusion</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
          {state.watchpoints.map((w, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: 'var(--ink-mid)', lineHeight: 1.5 }}>
              <span style={{ color: 'var(--warning)', flex: '0 0 auto' }}>→</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <InlineText
                  ariaLabel="Signal to watch"
                  multiline
                  value={w}
                  placeholder="A signal that would change the conclusion."
                  onChange={(value) => dispatch({ type: 'EDIT_WATCHPOINT', idx: i, value })}
                />
              </span>
              <RemoveButton title="Remove signal" onClick={() => dispatch({ type: 'REMOVE_WATCHPOINT', idx: i })} style={{ width: 16, height: 16, fontSize: 13 }} />
            </div>
          ))}
          <button
            type="button"
            onClick={() => dispatch({ type: 'ADD_WATCHPOINT' })}
            className="mono"
            style={{ alignSelf: 'flex-start', fontSize: 10, color: 'var(--ink-subtle)', background: 'transparent', border: '1px dashed var(--rule)', borderRadius: 7, padding: '5px 10px', marginTop: 2 }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--ink)'; e.currentTarget.style.borderColor = 'var(--ink)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--ink-subtle)'; e.currentTarget.style.borderColor = 'var(--rule)' }}
          >
            + Add signal
          </button>
        </div>
      </div>
    </div>
  )
}
