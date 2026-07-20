import Link from 'next/link'
import { ArrowIcon } from '@/components/icons'

const roster: { name: string; topic: string; score: number | null; color: string }[] = [
  { name: 'A. Rivera', topic: 'Should AI be used in schools?', score: 82, color: 'var(--green-strong)' },
  { name: 'J. Okafor', topic: 'Should AI be used in schools?', score: 61, color: 'var(--green-mid)' },
  { name: 'M. Chen', topic: 'In progress · 4 / 7 layers', score: null, color: 'var(--ink-subtle)' },
  { name: 'S. Patel', topic: 'Is a hot dog a sandwich?', score: 77, color: 'var(--green-strong)' },
]

export default function EducatorHeroSection() {
  return (
    <section style={{ background: 'var(--parchment)', paddingBlock: 'var(--hero-py)' }}>
      <div
        className="container"
        style={{ display: 'flex', flexWrap: 'wrap', gap: 'clamp(40px, 5vw, 72px)', alignItems: 'center' }}
      >
        <div style={{ flex: '1 1 380px', minWidth: 'min(300px, 100%)' }} data-reveal>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ display: 'block', width: 24, height: 1, background: 'var(--amber)' }} />
            <span className="eyebrow">Sheet 03 / For educators</span>
          </div>

          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 500,
              fontSize: 'clamp(40px, 6vw, 66px)',
              lineHeight: 1.05,
              letterSpacing: '-0.015em',
              maxWidth: '14ch',
              marginTop: 20,
              color: 'var(--ink)',
            }}
          >
            Make critical thinking visible.
          </h1>

          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 'clamp(17px, 1.6vw, 19px)',
              lineHeight: 1.6,
              color: 'var(--ink-mid)',
              maxWidth: '44ch',
              marginTop: 20,
            }}
          >
            Houses of Thought gives your students a structure for reasoning. It
            also gives you a window into how they think, beyond the answer they
            land on.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 32 }}>
            <Link href="/login?mode=signup&role=educator" className="btn-primary">
              Create a classroom <ArrowIcon />
            </Link>
            <Link href="/try" className="btn-secondary">
              Try it yourself
            </Link>
          </div>
        </div>

        <div style={{ flex: '1 1 380px', minWidth: 'min(300px, 100%)', maxWidth: 480 }} data-reveal>
          <div style={{ background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 12, padding: 22 }}>
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
              <span>Class · AP Seminar · Period 3</span>
              <span>24 houses</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {roster.map((s) => (
                <div
                  key={s.name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    background: 'var(--parchment)',
                    border: '1px solid var(--rule)',
                    borderRadius: 8,
                    padding: '12px 14px',
                  }}
                >
                  <span style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, color: 'var(--ink)', minWidth: 72 }}>
                    {s.name}
                  </span>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--ink-subtle)', flex: 1 }}>
                    {s.topic}
                  </span>
                  {s.score !== null ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-mono)', fontSize: 11, color: s.color }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color }} />
                      {s.score}
                    </span>
                  ) : (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: s.color }}>···</span>
                  )}
                </div>
              ))}
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: 'var(--ink-subtle)',
                marginTop: 16,
              }}
            >
              <span>Teacher view</span>
              <span>Sorted by strength</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
