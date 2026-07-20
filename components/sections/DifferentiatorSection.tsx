const columns = [
  {
    title: 'Guided, not given',
    body: 'You reason with the AI, not through it. The co-pilot asks the next question instead of handing you the answer.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
        <circle cx="14" cy="14" r="10" stroke="#F2B021" strokeWidth="1.4" fill="none" />
        <path d="M10 14h8M14 10v8" stroke="#FFFFFF" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: 'Grounded in evidence',
    body: 'Research Mode cites real sources, so the reasoning rests on facts you can check instead of on hallucination.',
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
    title: 'Stress-tested',
    body: 'Challenge your conclusion before reality does. The AI attacks your weakest layer until the house holds.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
        <path d="M14 4 L24 22 H4 Z" stroke="#F2B021" strokeWidth="1.4" fill="none" strokeLinejoin="round" />
        <line x1="14" y1="11" x2="14" y2="16" stroke="#FFFFFF" strokeWidth="1.4" strokeLinecap="round" />
        <circle cx="14" cy="19" r="0.8" fill="#FFFFFF" />
      </svg>
    ),
  },
]

export default function DifferentiatorSection() {
  return (
    <section style={{ background: 'var(--ink)', paddingBlock: 'var(--section-py)' }}>
      <div className="container">
        <p className="eyebrow-amber eyebrow-amber-on-ink">Section 05 — The difference</p>
        <h2
          className="h2"
          style={{ color: 'var(--parchment)', marginTop: 16 }}
        >
          AI that guides, not decides.
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
              <h3
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 500,
                  fontSize: 21,
                  color: 'var(--parchment)',
                  marginTop: 16,
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
