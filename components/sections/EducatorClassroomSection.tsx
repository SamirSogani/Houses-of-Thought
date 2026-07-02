const steps = [
  {
    num: '01',
    title: 'Create a class & invite',
    body: 'Spin up a classroom and share a join link or code. Students land straight in, with nothing to set up on their end.',
  },
  {
    num: '02',
    title: 'Assign or let them choose',
    body: 'Hand the whole class one question, or let students bring their own. Either way they build a full house.',
  },
  {
    num: '03',
    title: 'Review their houses',
    body: 'See the evidence, assumptions, perspectives, and strength for every student, one layer at a time.',
  },
]

export default function EducatorClassroomSection() {
  return (
    <section
      style={{ background: 'var(--parchment)', borderTop: '1px solid var(--rule)', paddingBlock: 'var(--section-py)' }}
    >
      <div className="container" data-reveal>
        <p className="eyebrow">How classrooms work</p>
        <h2 className="h2" style={{ marginTop: 16, maxWidth: '22ch' }}>
          Set up in minutes. Grade the reasoning behind the verdict.
        </h2>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, marginTop: 44 }}>
          {steps.map((s) => (
            <div
              key={s.num}
              style={{
                flex: '1 1 280px',
                background: 'var(--white)',
                border: '1px solid var(--rule)',
                borderRadius: 12,
                padding: 28,
              }}
            >
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--amber-hover)' }}>
                {s.num}
              </span>
              <h3
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 500,
                  fontSize: 22,
                  color: 'var(--ink)',
                  marginTop: 14,
                }}
              >
                {s.title}
              </h3>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 16, lineHeight: 1.6, color: 'var(--ink-mid)', marginTop: 10 }}>
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
