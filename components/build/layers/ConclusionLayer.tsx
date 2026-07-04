// Layer 5 — Conclusion (display-only). See handoff 05 §9b / 07 §6.2.

import { conclusionBullets, reasoningSummary } from '@/lib/build/content'

const monoLabel: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: '0.11em',
  color: 'var(--ink-subtle)',
}

export function ConclusionLayer() {
  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 24 }}>
      {/* Central conclusion */}
      <div>
        <div style={monoLabel}>Central conclusion</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          {conclusionBullets.map((b, i) => (
            <div key={i} style={{ background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 10, padding: '13px 15px', fontSize: 14, color: 'var(--ink)' }}>
              {b}
            </div>
          ))}
        </div>
      </div>

      {/* Reasoning summary */}
      <div>
        <div style={monoLabel}>Reasoning summary</div>
        <div
          style={{
            background: 'var(--parchment)',
            border: '1px solid var(--rule)',
            borderLeft: '3px solid var(--amber)',
            borderRadius: 10,
            padding: '15px 18px',
            marginTop: 8,
            fontSize: 15,
            color: 'var(--ink-mid)',
            lineHeight: 1.65,
          }}
        >
          {reasoningSummary}
        </div>
      </div>
    </div>
  )
}
