import Link from 'next/link'

const students = [
  { name: 'A. Rivera', status: 'Strength 82', color: 'var(--verdict-pass)', layers: '7/7' },
  { name: 'J. Okafor', status: 'Strength 61', color: 'var(--verdict-uncertain)', layers: '7/7' },
  { name: 'M. Chen', status: 'Building…', color: 'var(--rule)', layers: '4/7' },
]

export default function EducatorsSection() {
  return (
    <section
      style={{
        background: 'var(--white)',
        paddingBlock: 'var(--section-py)',
      }}
    >
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
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--amber-text)',
            }}
          >
            For classrooms
          </span>
          <h2
            className="h2"
            style={{
              marginTop: 14,
              fontSize: 'clamp(28px, 4vw, 44px)',
            }}
          >
            Make critical thinking visible, and gradeable.
          </h2>
          <p
            className="body-text"
            style={{ marginTop: 16, maxWidth: '46ch' }}
          >
            Teachers follow how students reason their way to an answer, layer by
            layer. Every layer is visible, scored, and open to feedback — a
            black-box essay becomes a transparent structure you can discuss,
            grade, and improve.
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
            data-reveal
            style={{
              border: '1px solid var(--rule)',
              borderRadius: 12,
              background: 'var(--parchment)',
              padding: 'clamp(18px, 2vw, 24px)',
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
                  <span
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: 14,
                      fontWeight: 500,
                      color: 'var(--ink)',
                      minWidth: 70,
                    }}
                  >
                    {s.name}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      color: 'var(--ink-subtle)',
                      letterSpacing: '0.06em',
                    }}
                  >
                    {s.layers}
                  </span>
                  <span
                    style={{
                      marginLeft: 'auto',
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
                        width: 6,
                        height: 6,
                        borderRadius: 1,
                        background: s.color,
                      }}
                    />
                    {s.status}
                  </span>
                </div>
              ))}
            </div>

            {/* Bottom classroom stat */}
            <div
              style={{
                marginTop: 14,
                padding: '10px 14px',
                background: 'var(--white)',
                border: '1px solid var(--rule)',
                borderRadius: 8,
                display: 'flex',
                justifyContent: 'space-between',
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: 'var(--ink-subtle)',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              <span>Avg. strength: 71</span>
              <span>18 completed · 6 in progress</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
