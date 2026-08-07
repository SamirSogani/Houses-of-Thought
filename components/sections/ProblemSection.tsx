'use client'

export default function ProblemSection() {
  return (
    <section style={{ background: 'var(--parchment)', paddingBlock: 'var(--section-py-lg)' }}>
      <div className="container">
        <div style={{ textAlign: 'center', maxWidth: '56ch', margin: '0 auto' }}>
          <div className="section-nine-mark" style={{ marginBottom: 28 }}>
            {Array.from({ length: 9 }).map((_, i) => (
              <span key={i} />
            ))}
          </div>
          <h2
            className="h2"
            style={{
              fontSize: 'clamp(28px, 4.5vw, 52px)',
              letterSpacing: '-0.02em',
            }}
          >
            A chatbot gives you an answer.
            <br />
            <span style={{ color: 'var(--amber-text)' }}>We make you build one.</span>
          </h2>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: 20,
            marginTop: 56,
            maxWidth: 960,
            margin: '56px auto 0',
          }}
          className="problem-grid"
        >
          {/* The chatbot card */}
          <div
            data-reveal
            style={{
              borderRadius: 12,
              border: '1px solid var(--rule)',
              background: 'var(--white)',
              padding: 'clamp(24px, 3vw, 36px)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Strikethrough overlay */}
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: -20,
                right: -20,
                height: 2,
                background: 'var(--warning)',
                transform: 'rotate(-2deg)',
                opacity: 0.5,
                zIndex: 2,
              }}
              aria-hidden="true"
            />
            <div style={{ opacity: 0.45 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  marginBottom: 20,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: 'var(--warning)',
                  }}
                />
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    color: 'var(--ink-subtle)',
                  }}
                >
                  The chatbot approach
                </span>
              </div>

              <div
                style={{
                  background: 'var(--parchment)',
                  border: '1px solid var(--rule)',
                  borderRadius: 10,
                  padding: '18px 20px',
                }}
              >
                <p
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 16,
                    color: 'var(--ink-mid)',
                    lineHeight: 1.6,
                    fontStyle: 'italic',
                  }}
                >
                  &ldquo;Yes, you should definitely do it. It&rsquo;s the best
                  option based on my analysis.&rdquo;
                </p>
              </div>

              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 8,
                  marginTop: 16,
                }}
              >
                {['No evidence shown', 'No assumptions visible', 'No way to verify', 'Costs $10–$100/mo'].map(
                  (tag) => (
                    <span
                      key={tag}
                      style={{
                        padding: '4px 10px',
                        border: '1px solid var(--rule)',
                        borderRadius: 4,
                        fontFamily: 'var(--font-mono)',
                        fontSize: 10,
                        color: 'var(--ink-subtle)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                      }}
                    >
                      {tag}
                    </span>
                  )
                )}
              </div>
            </div>
          </div>

          {/* The house card */}
          <div
            data-reveal
            style={{
              borderRadius: 12,
              border: '2px solid var(--ink)',
              background: 'var(--white)',
              padding: 'clamp(24px, 3vw, 36px)',
              position: 'relative',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginBottom: 20,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  background: 'var(--amber)',
                }}
              />
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: 'var(--ink-subtle)',
                }}
              >
                The house approach
              </span>
              <span
                className="verdict-badge verdict-pass"
                style={{ marginLeft: 'auto' }}
              >
                Defensible
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              {[
                {
                  num: '07',
                  name: 'Implications',
                  detail: 'Positive · Negative · Uncertain',
                  active: false,
                },
                {
                  num: '06',
                  name: 'Conclusion',
                  detail: 'Strength 78',
                  active: true,
                },
                {
                  num: '05',
                  name: 'Assumptions',
                  detail: '3 surfaced',
                  active: false,
                },
                {
                  num: '04',
                  name: 'Evidence',
                  detail: '6 cited sources',
                  active: false,
                },
                {
                  num: '03',
                  name: 'Perspectives',
                  detail: 'Self · Group · Ideas',
                  active: false,
                },
                {
                  num: '02',
                  name: 'Question',
                  detail: 'Framed',
                  active: false,
                },
                {
                  num: '01',
                  name: 'Concepts',
                  detail: '4 defined',
                  active: false,
                },
              ].map((layer) => (
                <div
                  key={layer.num}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 14px',
                    borderRadius: 6,
                    border: layer.active
                      ? '1px solid var(--amber)'
                      : '1px solid var(--rule-soft)',
                    background: layer.active
                      ? 'var(--amber-tint)'
                      : 'transparent',
                    transition: 'all 0.2s',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      color: layer.active
                        ? 'var(--amber-text)'
                        : 'var(--ink-subtle)',
                      minWidth: 18,
                    }}
                  >
                    {layer.num}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: 14,
                      fontWeight: 600,
                      color: 'var(--ink)',
                    }}
                  >
                    {layer.name}
                  </span>
                  <span
                    style={{
                      marginLeft: 'auto',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      color: 'var(--ink-subtle)',
                    }}
                  >
                    {layer.detail}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom annotation */}
        <p
          style={{
            textAlign: 'center',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--ink-subtle)',
            letterSpacing: '0.06em',
            marginTop: 24,
          }}
        >
          Every layer visible. Every source cited. Every assumption surfaced.
        </p>
      </div>

      <style>{`
        @media (min-width: 768px) {
          .problem-grid { grid-template-columns: 1fr 1.4fr !important; }
        }
      `}</style>
    </section>
  )
}
