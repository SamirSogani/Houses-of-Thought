// Perspective drill-in detail. See handoff 05 §7 (Detail) / 07 §3.

import type { Perspective } from '@/lib/build/types'
import { perspectiveDetails, genericDetail, emptyEvidenceLine, emptyCountersLine } from '@/lib/build/content'
import { color } from '@/lib/build/strength'
import { people } from '@/lib/build/people'
import { Avatar } from '../Avatar'
import { WarningIcon, ChevronLeft } from '../buildIcons'

const monoLabel = (extra?: React.CSSProperties): React.CSSProperties => ({
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: '0.11em',
  color: 'var(--ink-subtle)',
  ...extra,
})

export function PerspectiveDetail({ perspective, onBack }: { perspective: Perspective; onBack: () => void }) {
  const detail = perspectiveDetails[perspective.id] ?? genericDetail(perspective)
  const owner = people[perspective.owner]
  const strengthCol = color(perspective.strength)

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
        <div>
          <div style={monoLabel({ color: 'var(--amber-hover)' })}>Perspective</div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 30, color: 'var(--ink)', marginTop: 4 }}>
            {perspective.name}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 18 }}>
          <div>
            <div style={monoLabel({ fontSize: 9 })}>Owner</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <Avatar who={perspective.owner} size={24} />
              <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>{owner.name}</span>
            </div>
          </div>
          <div>
            <div style={monoLabel({ fontSize: 9 })}>Strength</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <span style={{ width: 60, height: 6, background: 'var(--rule)', borderRadius: 3, overflow: 'hidden' }}>
                <span className="build-bar-fill" style={{ display: 'block', height: '100%', width: `${perspective.strength}%`, background: strengthCol, transition: 'width 0.4s cubic-bezier(0.2,0.7,0.2,1)' }} />
              </span>
              <span className="mono" style={{ fontSize: 12, color: strengthCol }}>{perspective.strength}</span>
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
        {detail.stance}
      </div>

      {/* Sub-questions */}
      <div style={monoLabel({ margin: '24px 0 12px' })}>Sub-questions · {detail.questions.length}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {detail.questions.map((q, i) => (
          <div key={i} style={{ background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 11, padding: '14px 16px' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 16, color: 'var(--ink)' }}>{q.q}</div>
            <div style={{ marginTop: 8 }}>
              <span className="mono" style={{ fontSize: 9, color: 'var(--amber-hover)', marginRight: 8 }}>Working</span>
              <span style={{ fontSize: 13, color: 'var(--ink-mid)', lineHeight: 1.55 }}>{q.note}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Supporting evidence */}
      <div style={monoLabel({ margin: '24px 0 12px' })}>Supporting evidence</div>
      {detail.evidence.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {detail.evidence.map((e, i) => (
            <div key={i} style={{ background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 11, padding: '14px 16px' }}>
              <div style={{ fontSize: 14, color: 'var(--ink)' }}>{e.text}</div>
              <div style={{ marginTop: 7 }}>
                <span className="mono" style={{ fontSize: 9, color: 'var(--blueprint)', background: 'rgba(62,92,138,0.09)', borderRadius: 4, padding: '3px 7px' }}>
                  {e.source}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 13, color: 'var(--ink-subtle)', border: '1px dashed var(--rule)', borderRadius: 10, padding: '13px 15px' }}>
          {emptyEvidenceLine}
        </div>
      )}

      {/* Counterarguments */}
      <div style={monoLabel({ margin: '24px 0 12px', color: 'var(--warning)' })}>Counterarguments</div>
      {detail.counters.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {detail.counters.map((c, i) => (
            <div
              key={i}
              style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: 'var(--white)', border: '1px solid var(--rule)', borderLeft: '3px solid var(--warning)', borderRadius: 11, padding: '14px 16px' }}
            >
              <WarningIcon size={16} />
              <span style={{ fontSize: 14, color: 'var(--ink-mid)', lineHeight: 1.5 }}>{c}</span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 13, color: 'var(--ink-subtle)', border: '1px dashed var(--rule)', borderRadius: 10, padding: '13px 15px' }}>
          {emptyCountersLine}
        </div>
      )}
    </div>
  )
}
