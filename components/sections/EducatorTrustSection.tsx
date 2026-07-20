import Link from 'next/link'

const cards = [
  {
    label: 'Age floor',
    body: 'Accounts require users to be at least 13. School-managed consent for younger classrooms is on the roadmap.',
  },
  {
    label: 'Privacy posture',
    body: "Student work is private to the classroom. We don't sell student data and don't use it for advertising.",
  },
]

export default function EducatorTrustSection() {
  return (
    <section
      style={{ background: 'var(--white)', borderTop: '1px solid var(--rule)', paddingBlock: 'var(--section-py)' }}
    >
      <div className="container" data-reveal>
        <p className="eyebrow">Trust & safety</p>
        <h2 className="h2" style={{ marginTop: 16, maxWidth: '22ch' }}>
          Built for a classroom&rsquo;s standards.
        </h2>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, marginTop: 44 }}>
          {cards.map((c) => (
            <div
              key={c.label}
              style={{ flex: '1 1 280px', border: '1px solid var(--rule)', borderRadius: 12, padding: 24 }}
            >
              <p
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: 'var(--ink-subtle)',
                  marginBottom: 8,
                }}
              >
                {c.label}
              </p>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 16, lineHeight: 1.6, color: 'var(--ink-mid)' }}>
                {c.body}
              </p>
            </div>
          ))}

          <div style={{ flex: '1 1 280px', border: '1px solid var(--rule)', borderRadius: 12, padding: 24 }}>
            <p
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: 'var(--ink-subtle)',
                marginBottom: 8,
              }}
            >
              Data handling
            </p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 16, lineHeight: 1.6, color: 'var(--ink-mid)' }}>
              Teachers control the roster and can remove students and their
              data. See <Link href="/privacy" className="text-link">Privacy</Link> and{' '}
              <Link href="/terms" className="text-link">Terms</Link>.
            </p>
          </div>
        </div>

        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-subtle)', marginTop: 28 }}>
          A formal COPPA / FERPA compliance review will be completed before
          any school-wide deployment.
        </p>
      </div>
    </section>
  )
}
