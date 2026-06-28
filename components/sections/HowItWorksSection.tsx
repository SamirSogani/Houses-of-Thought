import Link from 'next/link'

const steps = [
  {
    num: '01',
    title: 'Ask a question worth reasoning about.',
    body: 'Bring a decision, a topic, or an essay. The harder it is to answer in one line, the better it fits.',
  },
  {
    num: '02',
    title: 'Explore perspectives and evidence.',
    body: 'AI guides with questions and cites real sources in Research Mode — it won’t write your conclusion for you.',
  },
  {
    num: '03',
    title: 'Reach a conclusion you can defend.',
    body: 'See a House Strength score across evidence, logic, and coverage — then stress-test it.',
  },
]

export default function HowItWorksSection() {
  return (
    <section style={{ background: 'var(--white)', paddingBlock: 'var(--section-py)' }}>
      <div className="container">
        <p className="eyebrow">Section 04 — How it works</p>
        <h2 className="h2" style={{ marginTop: 16 }}>
          Three steps from question to defensible answer.
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
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 13,
                  letterSpacing: '0.08em',
                  color: 'var(--amber-hover)',
                }}
              >
                {s.num}
              </span>
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
            Read how it works →
          </Link>
        </div>
      </div>
    </section>
  )
}
