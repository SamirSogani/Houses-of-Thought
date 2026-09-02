// Right rail — Overview tab (builder-workspace-redesign plan §3, phase 1).
// The at-a-glance panel of the document view: House Strength with its three
// REAL axes (Evidence / Logic / Coverage, weighted 40/35/25 — invariant 6, the
// score is never altered by presentation), labelled provisional while
// AI-drafted layers await their claim (decision 016 §2). Phase 2 adds the
// next-steps checklist and the co-pilot suggestion cards beneath this.
//
// This replaces the ContextBar strength pill as the score's home; ReviewLayer
// keeps the long-form breakdown ("driving this score", how to strengthen).

import type { State } from '@/lib/build/types'
import type { Strength } from '@/lib/build/strength'
import { strengthColor } from '@/lib/build/strength'
import { draftGateLocked, unclaimedDraftStages } from '@/lib/ai/draft'
import { deriveStatus } from '@/lib/build/persistence'

const mono: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: '0.11em',
}

export function OverviewPanel({ state, strength }: { state: State; strength: Strength }) {
  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <ScoreCard state={state} strength={strength} />
    </div>
  )
}

export function ScoreCard({ state, strength }: { state: State; strength: Strength }) {
  // Untouched house: no number yet, so the first thing a person sees isn't a
  // failing grade on an empty page (ux M6, same rule ContextBar applied).
  const scored = deriveStatus(state) !== 'empty'
  const provisional = draftGateLocked(state.draft)
  const unclaimed = unclaimedDraftStages(state.draft).length
  const col = scored ? strengthColor(strength.overall) : 'var(--ink-subtle)'

  const axes: { name: string; score: number }[] = [
    { name: 'Evidence', score: strength.evidence },
    { name: 'Logic', score: strength.logic },
    { name: 'Coverage', score: strength.coverage },
  ]

  return (
    <div
      style={{
        background: 'var(--white)',
        border: provisional ? '1px dashed var(--amber)' : '1px solid var(--rule)',
        borderRadius: 12,
        padding: '16px 16px 14px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
        <span style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 34, lineHeight: 1, color: col }}>
            {scored ? strength.overall : '—'}
          </span>
          <span style={{ ...mono, color: 'var(--ink-subtle)' }}>{scored ? '/ 100' : 'not scored yet'}</span>
        </span>
        {scored && provisional && (
          <span
            style={{ ...mono, fontSize: 9, color: 'var(--amber-text)', border: '1px solid var(--amber)', borderRadius: 5, padding: '3px 7px' }}
            title="Claim the AI-drafted layers to make this score yours."
          >
            Provisional
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 14 }}>
        {axes.map((a) => {
          const c = scored ? strengthColor(a.score) : 'var(--rule)'
          return (
            <div key={a.name}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 12, color: 'var(--ink-mid)' }}>{a.name}</span>
                <span className="mono" style={{ fontSize: 10, color: scored ? c : 'var(--ink-subtle)' }}>
                  {scored ? `${a.score}%` : '—'}
                </span>
              </div>
              <div style={{ height: 5, background: 'var(--rule-soft)', borderRadius: 3, overflow: 'hidden', marginTop: 5 }}>
                <div
                  className="build-bar-fill"
                  style={{ height: '100%', width: scored ? `${a.score}%` : '0%', background: c, borderRadius: 3, transition: 'width 0.4s cubic-bezier(0.2,0.7,0.2,1)' }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {scored && provisional && (
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--ink-mid)', lineHeight: 1.45 }}>
          <strong style={{ color: 'var(--ink)' }}>Score is provisional.</strong>{' '}
          Claim {unclaimed === 1 ? 'the remaining drafted layer' : `the ${unclaimed} remaining drafted layers`} to make it yours.
        </div>
      )}
      {!scored && (
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--ink-subtle)', lineHeight: 1.45 }}>
          Add content to any layer and the score starts working.
        </div>
      )}
    </div>
  )
}
