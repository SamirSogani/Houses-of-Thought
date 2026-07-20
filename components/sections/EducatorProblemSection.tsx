const columns = [
  {
    letter: 'A',
    title: 'Chatbots skip the work',
    body: 'A polished essay can arrive without a single original thought behind it, which leaves you grading the surface instead of the thinking.',
  },
  {
    letter: 'B',
    title: 'Reasoning is invisible',
    body: 'The final paragraph hides the assumptions a student made, the evidence they used, and the perspectives they never considered.',
  },
  {
    letter: 'C',
    title: 'Feedback comes too late',
    body: 'By the time you read the conclusion, the chance to redirect the thinking has already passed.',
  },
]

export default function EducatorProblemSection() {
  return (
    <section
      style={{ background: 'var(--white)', borderTop: '1px solid var(--rule)', paddingBlock: 'var(--section-py)' }}
    >
      <div className="container" data-reveal>
        <p className="eyebrow">The problem you already feel</p>
        <h2 className="h2" style={{ marginTop: 16, maxWidth: '24ch' }}>
          The answer looks fine. The thinking is a black box.
        </h2>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, marginTop: 44 }}>
          {columns.map((c) => (
            <div key={c.letter} style={{ flex: '1 1 260px', borderTop: '2px solid var(--ink)', paddingTop: 20 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--amber-text)' }}>
                {c.letter}
              </span>
              <h3
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 500,
                  fontSize: 21,
                  color: 'var(--ink)',
                  marginTop: 12,
                }}
              >
                {c.title}
              </h3>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 16, lineHeight: 1.6, color: 'var(--ink-mid)', marginTop: 10 }}>
                {c.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
