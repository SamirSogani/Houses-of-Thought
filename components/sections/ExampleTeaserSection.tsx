import Link from 'next/link'

const conclusions = [
  {
    stance: 'Adopt with guardrails',
    verdict: 'pass' as const,
    basis: 'Grounded in 6 cited sources, 3 educator perspectives.',
    reasoning:
      'The evidence supports supervised AI adoption: student engagement rises 23% in controlled studies, and critical-thinking skill development improves when AI guides rather than answers.',
    strength: 78,
  },
  {
    stance: 'Delay until frameworks exist',
    verdict: 'challenge' as const,
    basis: 'Weighted toward institutional risk and equity data.',
    reasoning:
      'Without standardized guidelines, adoption rates vary wildly by district wealth. Premature rollout risks embedding inequality, and no reversal plan exists.',
    strength: 71,
  },
]

const verdictStyle = {
  pass: {
    bg: 'rgba(63,143,91,0.12)',
    color: 'var(--verdict-pass)',
    label: 'Defensible',
  },
  challenge: {
    bg: 'rgba(194,104,43,0.12)',
    color: 'var(--verdict-challenge)',
    label: 'Challenged',
  },
}

export default function ExampleTeaserSection() {
  return (
    <section
      style={{
        background: 'var(--parchment)',
        paddingBlock: 'var(--section-py-lg)',
      }}
    >
      <div className="container">
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          <div style={{ maxWidth: '52ch' }}>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'var(--amber-text)',
              }}
            >
              Conclusion candidates
            </span>
            <h2
              className="h2"
              style={{
                marginTop: 14,
                fontSize: 'clamp(28px, 4vw, 48px)',
              }}
            >
              AI that disagrees with itself.
            </h2>
            <p
              className="body-text"
              style={{ marginTop: 14 }}
            >
              A single question can yield genuinely opposing conclusions.
              You see both — with reasoning, basis, and strength — and
              adopt the one you can defend.
            </p>
          </div>
          <Link
            href="/examples"
            className="text-link"
            style={{ whiteSpace: 'nowrap' }}
          >
            Browse examples →
          </Link>
        </div>

        {/* Question */}
        <div
          style={{
            marginTop: 40,
            padding: '16px 22px',
            border: '1px solid var(--rule)',
            borderRadius: 8,
            background: 'var(--white)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 1,
              background: 'var(--amber)',
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 500,
              fontSize: 'clamp(18px, 2vw, 22px)',
              color: 'var(--ink)',
            }}
          >
            Should AI be used in schools?
          </span>
          <span
            style={{
              marginLeft: 'auto',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--ink-subtle)',
              whiteSpace: 'nowrap',
            }}
          >
            7 / 7 layers
          </span>
        </div>

        {/* Conclusions */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: 20,
            marginTop: 20,
          }}
          className="conclusions-grid"
        >
          {conclusions.map((c) => {
            const v = verdictStyle[c.verdict]
            return (
              <div
                key={c.stance}
                data-reveal
                style={{
                  border: '1px solid var(--rule)',
                  borderRadius: 12,
                  background: 'var(--white)',
                  padding: 'clamp(24px, 3vw, 32px)',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    flexWrap: 'wrap',
                  }}
                >
                  <h3
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontWeight: 500,
                      fontSize: 'clamp(20px, 2vw, 26px)',
                      color: 'var(--ink)',
                    }}
                  >
                    &ldquo;{c.stance}&rdquo;
                  </h3>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '4px 10px',
                      borderRadius: 4,
                      background: v.bg,
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      fontWeight: 500,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: v.color,
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 1,
                        background: v.color,
                      }}
                    />
                    {v.label} · {c.strength}
                  </span>
                </div>

                <p
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 16,
                    lineHeight: 1.6,
                    color: 'var(--ink-mid)',
                    marginTop: 14,
                  }}
                >
                  {c.reasoning}
                </p>

                <p
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    color: 'var(--ink-subtle)',
                    marginTop: 14,
                    letterSpacing: '0.04em',
                  }}
                >
                  Basis: {c.basis}
                </p>
              </div>
            )
          })}
        </div>

        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <Link
            href="/examples/should-ai-be-used-in-schools"
            className="text-link"
          >
            Open this house →
          </Link>
        </div>
      </div>

      <style>{`
        @media (min-width: 768px) {
          .conclusions-grid { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
    </section>
  )
}
