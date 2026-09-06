// Layer 6 — Implications as stacked rows (builder-workspace-redesign plan §3,
// phase 3): one group per register (positive / negative / uncertain), each row
// with its glyph, the consequence, and its horizon and bearer as chips. The
// three-column board is gone; every action is unchanged. Watchpoints keep
// their block beneath.

import type { Action, Implication, ImplicationKind, State } from '@/lib/build/types'
import { EyeIcon } from '../buildIcons'
import { InlineText, RemoveButton } from '../Editable'
import { AddRow } from './PerspectiveDetail'

const groups: { kind: ImplicationKind; label: string; accent: string; tint: string; glyph: string }[] = [
  { kind: 'pos', label: 'Positive', accent: 'var(--green-text)', tint: 'rgba(63,143,91,0.08)', glyph: '+' },
  { kind: 'neg', label: 'Negative', accent: 'var(--warning-text)', tint: 'rgba(194,104,43,0.08)', glyph: '−' },
  { kind: 'unc', label: 'Uncertain', accent: 'var(--ink-subtle)', tint: 'var(--parchment)', glyph: '?' },
]

const chip: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 8,
  textTransform: 'uppercase',
  letterSpacing: '0.11em',
  color: 'var(--ink-subtle)',
  border: '1px solid var(--rule)',
  borderRadius: 4,
  padding: '2px 6px',
  background: 'transparent',
}

export function ImplicationsLayer({ state, dispatch }: { state: State; dispatch: React.Dispatch<Action> }) {
  return (
    <div className="fade-in" style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 18 }}>
      {groups.map(({ kind, label, accent, tint, glyph }) => {
        const items = state[kind] as Implication[]
        return (
          <div key={kind}>
            <div className="mono" style={{ fontSize: 10, letterSpacing: '0.11em', textTransform: 'uppercase', color: accent, marginBottom: 8 }}>
              {label} · {items.length}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.map((it) => (
                <div key={it.id} className="pop" style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: tint, border: '1px solid var(--rule-soft)', borderRadius: 10, padding: '10px 12px' }}>
                  <span
                    aria-hidden="true"
                    style={{ width: 20, height: 20, flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 999, background: 'var(--white)', border: `1.5px solid ${accent}`, color: accent, fontWeight: 700, fontSize: 12, lineHeight: 1, marginTop: 1 }}
                  >
                    {glyph}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.45 }}>
                      <InlineText
                        ariaLabel={`${label} implication`}
                        multiline
                        value={it.text}
                        placeholder="What follows if the conclusion holds?"
                        onChange={(value) => dispatch({ type: 'EDIT_IMPLICATION', kind, id: it.id, field: 'text', value })}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                      <button
                        type="button"
                        title="Toggle time horizon"
                        onClick={() => dispatch({ type: 'TOGGLE_IMPLICATION_HORIZON', kind, id: it.id })}
                        style={{ ...chip, cursor: 'pointer' }}
                      >
                        {it.horizon}
                      </button>
                      <span style={{ ...chip, display: 'inline-flex' }}>
                        <input
                          className="bhp-input16" aria-label="Who it lands on"
                          value={it.who}
                          placeholder="Who"
                          size={Math.max(Math.min(it.who.length || 5, 24), 3)}
                          onChange={(e) => dispatch({ type: 'EDIT_IMPLICATION', kind, id: it.id, field: 'who', value: e.target.value })}
                          style={{ background: 'transparent', border: 'none', outline: 'none', font: 'inherit', color: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit', padding: 0, width: 'auto', maxWidth: '100%' }}
                        />
                      </span>
                    </div>
                  </div>
                  <RemoveButton title="Remove implication" onClick={() => dispatch({ type: 'REMOVE_IMPLICATION', kind, id: it.id })} style={{ width: 20, height: 20, fontSize: 13 }} />
                </div>
              ))}
              <AddRow label={`+ Add ${kind === 'unc' ? 'an' : 'a'} ${label.toLowerCase()} implication`} onClick={() => dispatch({ type: 'ADD_IMPLICATION', kind })} />
            </div>
          </div>
        )
      })}

      {/* Watchpoints */}
      <div style={{ background: 'var(--parchment)', border: '1px solid var(--rule)', borderRadius: 12, padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <EyeIcon size={16} />
          <span className="mono" style={{ fontSize: 10, letterSpacing: '0.11em', textTransform: 'uppercase', color: 'var(--ink-mid)' }}>Signals to watch · would change the conclusion</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
          {state.watchpoints.map((w, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: 'var(--ink-mid)', lineHeight: 1.5 }}>
              <span style={{ color: 'var(--warning-text)', flex: '0 0 auto' }}>→</span>
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
          <AddRow label="+ Add a signal" onClick={() => dispatch({ type: 'ADD_WATCHPOINT' })} />
        </div>
      </div>
    </div>
  )
}
