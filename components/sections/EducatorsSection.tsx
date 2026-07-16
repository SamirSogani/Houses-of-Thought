import Link from 'next/link'

const students = [
  { name: 'A. Rivera', topic: 'Should AI be used in schools?', score: 82, color: '#3F8F5B' },
  { name: 'J. Okafor', topic: 'Should AI be used in schools?', score: 61, color: '#8A7A3F' },
  { name: 'M. Chen', topic: 'In progress · 4 / 7 layers', score: null, color: '#AEB8C7' },
]

export default function EducatorsSection() {
  return (
    <section style={{ background: 'var(--white)', paddingBlock: 'var(--section-py)' }}>
      <div
        className="container"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 'clamp(40px, 5vw, 64px)',
        }}
      >
        {/* Left — text */}
        <div style={{ flex: '1 1 360px', minWidth: 'min(280px, 100%)' }}>
          <p className="eyebrow">Section 06 — Built for classrooms</p>
          <h2 className="h2" style={{ marginTop: 16 }}>
            Make critical thinking visible, and gradeable.
          </h2>
          <p className="body-text" style={{ marginTop: 16, maxWidth: '48ch' }}>
            Teachers use Houses of Thought to follow how students reason their
            way to an answer, layer by layer. Every layer is visible, scored,
            and open to feedback, so a black-box essay becomes a transparent
            structure you can discuss, grade, and improve.
          </p>
          <div style={{ marginTop: 24 }}>
            <Link href="/educators" className="text-link">
              For educators →
            </Link>
          </div>
        </div>

        {/* Right — classroom mock */}
        <div style={{ flex: '1 1 360px', minWidth: 'min(280px, 100%)' }}>
          <div
            style={{
              border: '1px solid var(--rule)',
              borderRadius: 12,
              background: 'var(--parchment)',
              padding: 22,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: 'var(--ink-subtle)',
                marginBottom: 16,
              }}
            >
              <span>Class · Period 3</span>
              <span>24 houses</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {students.map((s) => (
                <div
                  key={s.name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    background: 'var(--white)',
                    border: '1px solid var(--rule)',
                    borderRadius: 8,
                    padding: '12px 14px',
                  }}
                >
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 500, color: 'var(--ink)', minWidth: 70 }}>
                    {s.name}
                  </span>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--ink-subtle)', flex: 1 }}>
                    {s.topic}
                  </span>
                  {s.score !== null ? (
                    <span
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        color: s.color,
                      }}
                    >
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 2,
                          background: s.color,
                        }}
                      />
                      {s.score}
                    </span>
                  ) : (
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        color: s.color,
                      }}
                    >
                      —
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
