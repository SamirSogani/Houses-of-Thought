// Left rail: the house itself, drawn roof to foundation, doubling as nav + progress.
// See handoff 02 §1-2 / 05 §4.

import type { State } from '@/lib/build/types'
import type { Strength } from '@/lib/build/strength'
import { layers, layerKey } from '@/lib/build/content'
import { layerDone, doneCount } from '@/lib/build/strength'
import { ChevronRight } from './buildIcons'

function meta(step: number, s: State, strength: Strength): string {
  switch (step) {
    case 1: return `${s.concepts.length} concepts`
    case 2: return `${s.perspectives.length} perspectives`
    case 3: return `${s.evidence.length} sourced`
    case 4: return `${s.assumptions.length} assumptions`
    case 5: return 'summary set'
    case 6: return `${s.pos.length + s.neg.length + s.unc.length} implications`
    case 7: return `score ${strength.overall}`
    default: return ''
  }
}

export function BlueprintRail({
  state,
  strength,
  onGo,
}: {
  state: State
  strength: Strength
  onGo: (step: number) => void
}) {
  const done = doneCount(state)
  const order = [7, 6, 5, 4, 3, 2, 1]

  return (
    <aside
      className="build-scroll"
      style={{
        flex: '0 0 264px',
        background: 'var(--white)',
        borderRight: '1px solid var(--rule)',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
      }}
    >
      {/* Header */}
      <div style={{ padding: '18px 20px 12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="mono" style={{ fontSize: 10, color: 'var(--ink-subtle)' }}>Blueprint</span>
          <span className="mono" style={{ fontSize: 10, color: 'var(--ink-subtle)' }}>{done} / 7 layers</span>
        </div>
        <div style={{ height: 5, background: 'var(--rule)', borderRadius: 3, overflow: 'hidden', marginTop: 8 }}>
          <div
            className="build-bar-fill"
            style={{
              height: '100%',
              width: `${(done / 7) * 100}%`,
              background: 'var(--amber)',
              borderRadius: 3,
              transition: 'width 0.4s cubic-bezier(0.2,0.7,0.2,1)',
            }}
          />
        </div>
      </div>

      {/* Scroll area */}
      <div style={{ flex: '1 1 auto', padding: '6px 16px 20px' }}>
        {/* Roof */}
        <div
          aria-hidden="true"
          style={{
            width: 0,
            height: 0,
            margin: '0 auto -1px',
            borderLeft: '26px solid transparent',
            borderRight: '26px solid transparent',
            borderBottom: '20px solid var(--rule-soft)',
          }}
        />

        {/* Layer list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {order.map((step) => {
            const layer = layers[step - 1]
            const active = state.step === step
            const isDone = layerDone(step, state)
            return (
              <button
                key={step}
                type="button"
                onClick={() => onGo(step)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 13px',
                  borderRadius: 11,
                  background: active ? 'var(--amber-tint)' : 'var(--white)',
                  border: `1px solid ${active ? 'var(--amber)' : 'var(--rule)'}`,
                  transition: 'background 0.18s, border-color 0.18s',
                  textAlign: 'left',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Badge step={step} active={active} done={isDone} />
                  <span>
                    <span style={{ display: 'block', fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>
                      {layerKey(step)}
                    </span>
                    <span className="mono" style={{ display: 'block', fontSize: 9, color: 'var(--ink-subtle)', marginTop: 2 }}>
                      {meta(step, state, strength)}
                    </span>
                  </span>
                </span>
                <span style={{ color: 'var(--ink-subtle)', opacity: active ? 1 : 0.35, display: 'inline-flex' }}>
                  <ChevronRight size={14} />
                </span>
              </button>
            )
          })}
        </div>

        {/* Foundation */}
        <div className="mono" style={{ fontSize: 9, color: 'var(--ink-subtle)', textAlign: 'center', marginTop: 8 }}>
          Foundation
        </div>
      </div>
    </aside>
  )
}

function Badge({ step, active, done }: { step: number; active: boolean; done: boolean }) {
  // Active always wins over done (02 §2).
  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
    height: 24,
    borderRadius: 7,
    fontFamily: 'var(--font-mono)',
    fontSize: 10,
    flex: '0 0 auto',
  }
  if (active) {
    return <span style={{ ...base, background: 'var(--amber)', color: 'var(--ink)' }}>{step}</span>
  }
  if (done) {
    return (
      <span style={{ ...base, background: 'var(--green-strong)', color: '#fff', fontSize: 12 }} aria-label="Done">
        ✓
      </span>
    )
  }
  return (
    <span style={{ ...base, background: 'var(--parchment)', border: '1px solid var(--rule)', color: 'var(--ink-subtle)' }}>
      {step}
    </span>
  )
}
