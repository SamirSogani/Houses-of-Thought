import Link from 'next/link'

const steps = [
  {
    num: '01',
    tag: 'You',
    title: 'Type your question.',
    body: 'A decision, a topic, a debate. The harder it is to answer in one line, the better it fits. Add context if you want — or don’t.',
  },
  {
    num: '02',
    tag: 'Pipeline',
    title: '47 agents reason through it.',
    body: 'Eight layers are constructed automatically: concepts, perspectives, cited evidence, assumptions, competing conclusions. Each layer is reviewed by a panel of nine specialized agents.',
  },
  {
    num: '03',
    tag: 'Result',
    title: 'Get reasoning you can defend.',
    body: 'See competing conclusions scored on evidence, logic, and coverage. Every claim links to its source. The stress test tells you where your house is weakest.',
  },
]

export default function HowItWorksSection() {
  return (
    <section style={{ background: 'var(--white)', paddingBlock: 'var(--section-py)' }}>
      <div className="container">
        <p className="eyebrow">Section 04 &mdash; How it works</p>
        <h2 className="h2" style={{ marginTop: 16 }}>
          You do one thing. We do everything else.
        </h2>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 24,
            marginTop: 44,
          }}
        >
          {steps.map((s) => (
            <div
              key={s.num}
              style={{
                flex: '1 1 280px',
                minWidth: 260,
                borderTop: '2px solid var(--ink)',
                paddingTop: 22,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 13,
                    letterSpacing: '0.08em',
                    color: 'var(--amber-text)',
                  }}
                >
                  {s.num}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    color: s.tag === 'You' ? 'var(--ink)' : 'var(--ink-subtle)',
                    background: s.tag === 'You' ? 'var(--amber-tint)' : 'transparent',
                    border: `1px solid ${s.tag === 'You' ? 'var(--amber)' : 'var(--rule)'}`,
                    borderRadius: 4,
                    padding: '2px 7px',
                  }}
                >
                  {s.tag}
                </span>
              </div>
              <h3
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 500,
                  fontSize: 23,
                  marginTop: 14,
                  color: 'var(--ink)',
                }}
              >
                {s.title}
              </h3>
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 16,
                  lineHeight: 1.6,
                  color: 'var(--ink-mid)',
                  marginTop: 10,
                }}
              >
                {s.body}
              </p>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 36 }}>
          <Link href="/how-it-works" className="text-link">
            Read the full walkthrough &rarr;
          </Link>
        </div>
      </div>
    </section>
  )
}
