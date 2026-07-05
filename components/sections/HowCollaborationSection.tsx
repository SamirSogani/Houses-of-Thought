// How it works — Collaboration. Shows the team + attribution story with the real
// workspace UI (Avatar + people), rendered rather than screenshotted. No live
// presence dots or activity feed: this is a static, honest render.

import { Avatar } from '@/components/build/Avatar'
import { people } from '@/lib/build/people'
import type { PersonKey } from '@/lib/build/types'

const ownership: { key: PersonKey; owns: string }[] = [
  { key: 'you', owns: 'Framing and final review' },
  { key: 'maya', owns: 'Evidence and sources' },
  { key: 'devan', owns: 'Perspectives' },
  { key: 'ai', owns: 'Research Mode and stress tests' },
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
        <p className="eyebrow">Collaboration</p>
        <h2 className="h2" style={{ marginTop: 16, maxWidth: '20ch' }}>
          Build the house with your team.
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
          Invite co-builders and give each of them a perspective to own, so the reasoning divides
          across the people who actually hold it. The AI sits on the rail as one more teammate.
          Every perspective, source, and assumption is attributed to whoever added it, the co-pilot
          included.
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
              {/* A perspective owned by a teammate */}
              <div style={{ border: '1px solid var(--rule)', borderRadius: 11, padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 16, color: 'var(--ink)' }}>Teachers</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <Avatar who="maya" size={22} />
                    <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--ink)' }}>Maya R.</span>
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
                    76% of OECD countries now have a national AI-in-schools policy or draft framework.
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 7, flexWrap: 'wrap' }}>
                    <span className="mono" style={{ fontSize: 9, color: 'var(--blueprint)', background: 'rgba(62,92,138,0.09)', borderRadius: 4, padding: '3px 7px' }}>
                      OECD Education Digest (2025)
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
