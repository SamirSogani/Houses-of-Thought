import Link from 'next/link'

const perspectives = [
  { label: 'Students', questions: '6 questions', desc: 'Want tools that help them learn — not surveillance.' },
  { label: 'Teachers', questions: '8 questions', desc: 'Worry that shortcuts will replace the thinking.' },
  { label: 'Parents', questions: '5 questions', desc: 'Split between screen-time fears and opportunity.' },
]

const subScores = [
  { label: 'Evidence', value: 82, color: '#3F8F5B' },
  { label: 'Logic', value: 76, color: '#3F8F5B' },
  { label: 'Coverage', value: 68, color: '#8A7A3F' },
]

export default function ExampleTeaserSection() {
  return (
    <section style={{ background: 'var(--parchment)', paddingBlock: 'var(--section-py)' }}>
      <div className="container">
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <p className="eyebrow">Section 07 — Example</p>
            <h2 className="h2" style={{ marginTop: 16 }}>See a completed house.</h2>
          </div>
          <Link href="/examples" className="text-link" style={{ whiteSpace: 'nowrap' }}>
            Browse all examples →
          </Link>
        </div>

        <Link
          href="/examples/should-ai-be-used-in-schools"
          style={{
            display: 'block',
            border: '1px solid var(--ink)',
            borderRadius: 12,
            background: 'var(--white)',
            overflow: 'hidden',
            marginTop: 32,
            transition: 'box-shadow 0.2s',
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap' }}>
            {/* Left panel */}
            <div
              style={{
                flex: '1 1 360px',
                padding: 'clamp(24px, 3vw, 36px)',
                borderRight: '1px solid var(--rule)',
              }}
            >
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {['Education', '7 / 7 layers'].map((tag) => (
                  <span
                    key={tag}
                    style={{
                      border: '1px solid var(--rule)',
                      borderRadius: 4,
                      padding: '3px 8px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      color: 'var(--ink-subtle)',
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <h3
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 500,
                  fontSize: 'clamp(24px, 3vw, 32px)',
                  color: 'var(--ink)',
                }}
              >
                Should AI be used in schools?
              </h3>
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 15,
                  color: 'var(--ink-subtle)',
                  marginTop: 10,
                  lineHeight: 1.5,
                }}
              >
                Three stakeholder perspectives, six cited sources, and a
                conclusion that survived a stress test.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20 }}>
                {perspectives.map((p) => (
                  <div
                    key={p.label}
                    style={{
                      border: '1px solid var(--rule)',
                      borderRadius: 8,
                      padding: '12px 14px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>
                        {p.label}
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-subtle)' }}>
                        {p.questions}
                      </span>
                    </div>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--ink-mid)', marginTop: 6, lineHeight: 1.5 }}>
                      {p.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Right panel */}
            <div
              style={{
                flex: '1 1 260px',
                padding: 'clamp(24px, 3vw, 36px)',
                background: 'var(--parchment)',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: 'var(--ink-subtle)',
                }}
              >
                House Strength
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 8 }}>
                <span
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 600,
                    fontSize: 56,
                    color: 'var(--ink)',
                    lineHeight: 1,
                  }}
                >
                  75
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    color: '#3F8F5B',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}
                >
                  Defensible
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 28 }}>
                {subScores.map((s) => (
                  <div key={s.label}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        color: 'var(--ink-subtle)',
                        marginBottom: 6,
                      }}
                    >
                      <span>{s.label}</span>
                      <span style={{ color: s.color }}>{s.value}</span>
                    </div>
                    <div
                      style={{
                        height: 6,
                        borderRadius: 3,
                        background: 'var(--rule)',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${s.value}%`,
                          height: '100%',
                          borderRadius: 3,
                          background: s.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <span
                style={{
                  marginTop: 'auto',
                  paddingTop: 24,
                  fontFamily: 'var(--font-body)',
                  fontWeight: 600,
                  fontSize: 15,
                  color: 'var(--ink)',
                }}
              >
                Open this house →
              </span>
            </div>
          </div>
        </Link>
      </div>
    </section>
  )
}
