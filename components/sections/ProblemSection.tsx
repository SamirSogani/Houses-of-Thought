export default function ProblemSection() {
  return (
    <section style={{ background: 'var(--white)', paddingBlock: 'var(--section-py)' }}>
      <div className="container">
        <div style={{ textAlign: 'center', maxWidth: '62ch', margin: '0 auto' }}>
          <p className="eyebrow">Section 02 — The problem</p>
          <h2 className="h2" style={{ marginTop: 16 }}>
            A chatbot hands you an answer.
            <br />A house shows the reasoning.
          </h2>
          <p className="body-text" style={{ maxWidth: '54ch', margin: '20px auto 0' }}>
            AI can sound certain and still be wrong. You can&rsquo;t see the
            assumptions, the evidence, or the perspectives it skipped, so you
            can&rsquo;t defend it, and you don&rsquo;t learn anything.
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 24,
            marginTop: 48,
          }}
        >
          {/* Left — "The chatbot" */}
          <div
            data-reveal
            style={{
              flex: '1 1 320px',
              minWidth: 280,
              borderRadius: 12,
              background: 'var(--parchment)',
              padding: 28,
              border: '1px solid var(--rule)',
            }}
          >
            <p
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: 'var(--ink-subtle)',
                marginBottom: 16,
              }}
            >
              The chatbot
            </p>
            <div
              style={{
                background: 'var(--white)',
                border: '1px solid var(--rule)',
                borderRadius: 10,
                padding: 18,
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  textTransform: 'uppercase',
                  color: 'var(--rule)',
                }}
              >
                ASSISTANT
              </span>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 16, color: 'var(--ink-mid)', marginTop: 8, lineHeight: 1.6 }}>
                &ldquo;Yes, you should definitely do it. It&rsquo;s the best option.&rdquo;
              </p>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginTop: 14,
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--warning)',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
                <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.2" fill="none" />
                <line x1="8" y1="5" x2="8" y2="9" stroke="currentColor" strokeWidth="1.4" />
                <circle cx="8" cy="11.5" r="0.8" fill="currentColor" />
              </svg>
              No assumptions · No sources · No way to check
            </div>
          </div>

          {/* Right — "The house" */}
          <div
            data-reveal
            style={{
              flex: '1 1 320px',
              minWidth: 280,
              borderRadius: 12,
              background: 'var(--parchment)',
              padding: 28,
              border: '1px solid var(--ink)',
            }}
          >
            <p
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: 'var(--ink-subtle)',
                marginBottom: 16,
              }}
            >
              The house
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { num: '06', name: 'Conclusion', right: 'Strength 75', rightColor: '#D9990C', borderColor: 'var(--amber)' },
                { num: '05', name: 'Assumptions', right: '', rightColor: '', borderColor: 'var(--rule)' },
                { num: '04', name: 'Evidence', right: '4 cited', rightColor: '#3F8F5B', borderColor: 'var(--rule)' },
                { num: '03', name: 'Perspectives', right: 'Self · Group · Ideas', rightColor: '#5A6B85', borderColor: 'var(--rule)' },
              ].map((layer) => (
                <div
                  key={layer.num}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    borderRadius: 6,
                    padding: '9px 12px',
                    border: `1px solid ${layer.borderColor}`,
                    background: 'var(--white)',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      color: 'var(--ink-subtle)',
                    }}
                  >
                    {layer.num}
                  </span>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
                    {layer.name}
                  </span>
                  {layer.right && (
                    <span
                      style={{
                        marginLeft: 'auto',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 10,
                        color: layer.rightColor,
                      }}
                    >
                      {layer.right}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
