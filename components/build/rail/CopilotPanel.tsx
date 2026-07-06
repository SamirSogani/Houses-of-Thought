// Right rail — Co-pilot tab. Contextual suggestions for the active layer only.
// See handoff 05 §12 / 04 §10 / 07 §4.

import type { Action, State } from '@/lib/build/types'
import { layers } from '@/lib/build/content'
import { suggestions } from '@/lib/build/suggestions'
import { PlusIcon, SparkIcon } from '../buildIcons'

export function CopilotPanel({ state }: { state: State; dispatch: React.Dispatch<Action> }) {
  const kicker = layers[state.step - 1].kicker
  const accepted = state.accepted[state.step] ?? []
  const bank = suggestions[state.step] ?? []
  const remaining = bank.map((s, idx) => ({ s, idx })).filter(({ idx }) => !accepted.includes(idx))

  return (
    <div className="fade-in">
      {/* Intro tile */}
      <div style={{ background: 'var(--parchment)', border: '1px solid var(--rule)', borderRadius: 11, padding: 13, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <span style={{ width: 26, height: 26, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'var(--ink)', borderRadius: 8, flex: '0 0 auto' }}>
          <SparkIcon size={14} fill="var(--amber)" />
        </span>
        <div>
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>Co-pilot · {kicker}</div>
          <div style={{ fontSize: 12, color: 'var(--ink-subtle)', marginTop: 3, lineHeight: 1.45 }}>
            Suggestions for this layer only. It guides. You decide what enters the house.
          </div>
        </div>
      </div>

      <div className="mono" style={{ fontSize: 10, color: 'var(--ink-subtle)', margin: '18px 0 10px' }}>Suggested for this layer</div>

      {remaining.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {remaining.map(({ s, idx }) => (
            <div key={idx} className="pop" style={{ border: '1px solid var(--rule)', borderRadius: 11, padding: 13 }}>
              <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.45 }}>{s.text}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 11 }}>
                <span className="mono" style={{ fontSize: 9, color: 'var(--ink-subtle)' }}>{s.tag}</span>
                <button
                  type="button"
                  // Placeholder until the co-pilot is wired to the Groq API; the
                  // suggestion bank is illustrative, so Add is a no-op for now.
                  disabled
                  title="Co-pilot suggestions are coming soon"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 600, fontSize: 12, color: 'var(--ink-subtle)', background: 'var(--amber-tint)', border: '1px solid var(--amber)', borderRadius: 6, padding: '5px 11px', cursor: 'not-allowed', opacity: 0.6 }}
                >
                  <PlusIcon size={12} />
                  Add
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--ink-subtle)', padding: '20px 0', lineHeight: 1.5 }}>
          You&apos;ve accepted every suggestion for this layer. Move on when you&apos;re ready.
        </div>
      )}
    </div>
  )
}
