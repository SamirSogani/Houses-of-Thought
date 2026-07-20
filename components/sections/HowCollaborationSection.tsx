// How it works — Attribution. Shows who is actually on a house today (you and
// the co-pilot) and how every item is attributed, rendered with the real
// workspace UI (Avatar + people) rather than screenshotted. Human co-builders
// are described in the future tense until collaboration ships.

import { Avatar } from '@/components/build/Avatar'
import { people } from '@/lib/build/people'
import type { PersonKey } from '@/lib/build/types'

const ownership: { key: PersonKey; owns: string }[] = [
  { key: 'you', owns: 'The reasoning: framing, assumptions, conclusion' },
  { key: 'ai', owns: 'Research Mode, suggestions, and stress tests' },
]

const cardStyle: React.CSSProperties = {
  flex: '1 1 320px',
  background: 'var(--white)',
  border: '1px solid var(--rule)',
  borderRadius: 12,
  padding: 30,
}

const panelLabel: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  color: 'var(--ink-subtle)',
  marginBottom: 18,
}

export default function HowCollaborationSection() {
  return (
    <section
      style={{ background: 'var(--parchment)', borderTop: '1px solid var(--rule)', paddingBlock: 'var(--section-py)' }}
    >
      <div className="container" data-reveal>
        <p className="eyebrow">Attribution</p>
        <h2 className="h2" style={{ marginTop: 16, maxWidth: '20ch' }}>
          Your work and the AI&rsquo;s, never blurred.
        </h2>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 17,
            color: 'var(--ink-mid)',
            lineHeight: 1.55,
            marginTop: 16,
            maxWidth: '58ch',
          }}
        >
          The AI sits on the rail as a teammate, not a ghostwriter. Every perspective, source, and
          assumption is attributed to whoever added it, so anything the co-pilot found stays marked
          as the co-pilot&rsquo;s. Human co-builders, each owning a perspective, are on the roadmap.
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, marginTop: 44 }}>
          {/* Who is on the house */}
          <div style={cardStyle}>
            <p style={panelLabel}>Who&rsquo;s on the house</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {ownership.map(({ key, owns }) => {
                const p = people[key]
                return (
                  <div key={key} style={{ display: 'flex', gap: 11, alignItems: 'center', border: '1px solid var(--rule)', borderRadius: 11, padding: '11px 13px' }}>
                    <Avatar who={key} size={32} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>{p.name}</span>
                        <span className="mono" style={{ fontSize: 8, color: 'var(--ink-subtle)', border: '1px solid var(--rule)', borderRadius: 4, padding: '2px 6px' }}>
                          {p.role}
                        </span>
                      </div>
                      <div className="mono" style={{ fontSize: 9, color: 'var(--ink-subtle)', marginTop: 5 }}>Owns {owns}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Attributed to who added it */}
          <div style={cardStyle}>
            <p style={panelLabel}>Attributed to who added it</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* A perspective you wrote */}
              <div style={{ border: '1px solid var(--rule)', borderRadius: 11, padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 16, color: 'var(--ink)' }}>Teachers</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <Avatar who="you" size={22} />
                    <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--ink)' }}>You</span>
                  </span>
                </div>
                <p style={{ fontSize: 13, color: 'var(--ink-mid)', lineHeight: 1.5, marginTop: 8 }}>
                  Gain prep leverage but face new oversight duties.
                </p>
              </div>

              {/* Evidence the co-pilot found */}
              <div style={{ border: '1px solid var(--rule)', borderRadius: 11, padding: 14, display: 'flex', gap: 11, alignItems: 'flex-start' }}>
                <Avatar who="ai" size={24} title="Co-pilot" />
                <div>
                  <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.5 }}>
                    Fewer than 10% of schools and universities surveyed worldwide have formal guidance on using generative AI.
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 7, flexWrap: 'wrap' }}>
                    <span className="mono" style={{ fontSize: 9, color: 'var(--blueprint)', background: 'rgba(62,92,138,0.09)', borderRadius: 4, padding: '3px 7px' }}>
                      UNESCO global survey (2023)
                    </span>
                    <span className="mono" style={{ fontSize: 9, color: 'var(--amber-hover)' }}>via Research Mode</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
