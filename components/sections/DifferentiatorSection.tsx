import Link from 'next/link'

const steps = [
  {
    num: '01',
    title: 'You ask. The AI questions back.',
    body: 'Bring a decision, a dilemma, or a debate topic. Instead of answering, the co-pilot asks what it needs to build a defensible house.',
    accent: 'var(--amber)',
  },
  {
    num: '02',
    title: 'Perspectives fan out. Evidence grounds them.',
    body: 'Three lenses — Self, Group, Ideas — expand the question past your own viewpoint. Research Mode cites real, checkable sources.',
    accent: 'var(--verdict-pass)',
  },
  {
    num: '03',
    title: 'You conclude. Nine standards grade it.',
    body: 'The house scores your conclusion across evidence, logic, and coverage. Stress-test it before reality does.',
    accent: 'var(--verdict-challenge)',
  },
]

export default function DifferentiatorSection() {
  return (
    <section style={{ background: 'var(--white)', paddingBlock: 'var(--section-py-lg)' }}>
      <div className="container">
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
            How it works
          </span>
          <h2
            className="h2"
            style={{
              marginTop: 14,
              fontSize: 'clamp(28px, 4vw, 48px)',
            }}
          >
            Three steps from question
            <br />
            to defensible answer.
          </h2>
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 0,
            marginTop: 52,
          }}
        >
          {steps.map((s, i) => (
            <div
              key={s.num}
              data-reveal
              style={{
                flex: '1 1 280px',
                minWidth: 260,
                padding: 'clamp(20px, 3vw, 32px)',
                paddingLeft: i === 0 ? 0 : undefined,
                paddingRight: i === steps.length - 1 ? 0 : undefined,
                borderTop: `3px solid ${s.accent}`,
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 32,
                  fontWeight: 500,
                  letterSpacing: '-0.02em',
                  color: s.accent,
                  display: 'block',
                }}
              >
                {s.num}
              </span>
              <h3
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 500,
                  fontSize: 'clamp(20px, 2vw, 24px)',
                  marginTop: 16,
                  color: 'var(--ink)',
                  maxWidth: '22ch',
                }}
              >
                {s.title}
              </h3>
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 15,
                  lineHeight: 1.6,
                  color: 'var(--ink-mid)',
                  marginTop: 12,
                }}
              >
                {s.body}
              </p>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 40 }}>
          <Link href="/how-it-works" className="text-link">
            Read how it works in depth →
          </Link>
        </div>
      </div>
    </section>
  )
}
