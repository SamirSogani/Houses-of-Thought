const columns = [
  {
    stat: '47',
    title: 'Review agents',
    body: 'Not one AI voice. A pipeline of specialized agents, each responsible for a different layer and standard. Every claim is cross-examined before it reaches you.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
        <circle cx="10" cy="10" r="5" stroke="#F2B021" strokeWidth="1.4" fill="none" />
        <circle cx="18" cy="10" r="5" stroke="#F2B021" strokeWidth="1.4" fill="none" />
        <circle cx="14" cy="18" r="5" stroke="#F2B021" strokeWidth="1.4" fill="none" />
      </svg>
    ),
  },
  {
    stat: '9',
    title: 'Intellectual standards',
    body: 'Clarity. Accuracy. Precision. Relevance. Depth. Breadth. Logic. Significance. Fairness. Every layer is graded against all nine, from the Paul–Elder model.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
        <rect x="6" y="4" width="16" height="20" rx="2" stroke="#F2B021" strokeWidth="1.4" fill="none" />
        <line x1="10" y1="10" x2="18" y2="10" stroke="#FFFFFF" strokeWidth="1.2" />
        <line x1="10" y1="14" x2="18" y2="14" stroke="#FFFFFF" strokeWidth="1.2" />
        <line x1="10" y1="18" x2="15" y2="18" stroke="#FFFFFF" strokeWidth="1.2" />
      </svg>
    ),
  },
  {
    stat: '8',
    title: 'Reasoning layers',
    body: 'Concepts, question, perspectives, evidence, assumptions, conclusion, implications, stress test. Built bottom-up, each resting on the last. Nothing hidden.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
        <rect x="6" y="20" width="16" height="4" stroke="#F2B021" strokeWidth="1.4" fill="none" />
        <rect x="6" y="14" width="16" height="4" stroke="#F2B021" strokeWidth="1.4" fill="none" />
        <rect x="6" y="8" width="16" height="4" stroke="#F2B021" strokeWidth="1.4" fill="none" />
        <path d="M6 8 L14 2 L22 8" stroke="#F2B021" strokeWidth="1.4" fill="none" />
      </svg>
    ),
  },
]

export default function DifferentiatorSection() {
  return (
    <section className="ink-surface" style={{ background: 'var(--ink)', paddingBlock: 'var(--section-py)' }}>
      <div className="container">
        <p className="eyebrow-amber eyebrow-amber-on-ink">Section 05 &mdash; The difference</p>
        <h2
          className="h2"
          style={{ color: 'var(--parchment)', marginTop: 16, maxWidth: '24ch' }}
        >
          Not a chatbot answer.
          <br />A reasoning architecture.
        </h2>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 0,
            marginTop: 44,
          }}
        >
          {columns.map((col, i) => (
            <div
              key={col.title}
              style={{
                flex: '1 1 280px',
                padding: 28,
                borderTop: '1px solid var(--ink-mid)',
                paddingLeft: i === 0 ? 0 : 28,
                paddingRight: i === columns.length - 1 ? 0 : 28,
              }}
            >
              {col.icon}
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 600,
                  fontSize: 40,
                  color: 'var(--amber)',
                  marginTop: 14,
                  lineHeight: 1,
                }}
              >
                {col.stat}
              </div>
              <h3
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 500,
                  fontSize: 21,
                  color: 'var(--parchment)',
                  marginTop: 8,
                }}
              >
                {col.title}
              </h3>
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 16,
                  lineHeight: 1.6,
                  color: 'var(--rule)',
                  marginTop: 10,
                }}
              >
                {col.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
