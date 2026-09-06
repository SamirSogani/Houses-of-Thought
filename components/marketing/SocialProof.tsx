// Home: lightweight social-proof section — placeholder testimonials and a
// houses-built stat. Sits between WhySection and DiagramTeaser. Quotes are
// marked as placeholders so they're obviously not fabricated endorsements.

const TESTIMONIALS = [
  {
    quote:
      '[Placeholder — replace with real testimonial] "My students used to hand in opinions. Now they hand in arguments with evidence and assumptions laid out. The difference is night and day."',
    attribution: '[Educator name]',
    role: '[School / district]',
  },
  {
    quote:
      '[Placeholder — replace with real testimonial] "I used it to decide whether to take a job offer. By the time I finished the house, I wasn\'t guessing anymore — I could see exactly where the case was strong and where it was thin."',
    attribution: '[User name]',
    role: '[Role / context]',
  },
]

export default function SocialProof() {
  return (
    <section style={{ paddingBlock: 'var(--section-py)', borderTop: '1px solid var(--dusk-rule)' }}>
      <div className="container">
        <p
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            fontWeight: 500,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--amber)',
          }}
        >
          Early voices
        </p>
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 500,
            fontSize: 'clamp(28px, 4vw, 42px)',
            letterSpacing: '-0.01em',
            color: 'var(--dusk-ink)',
            marginTop: 12,
          }}
        >
          What people are saying.
        </h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 20,
            marginTop: 32,
          }}
        >
          {TESTIMONIALS.map((t) => (
            <blockquote
              key={t.attribution}
              className="dusk-card"
              style={{
                margin: 0,
                padding: 'clamp(22px, 3vw, 28px)',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 15,
                  lineHeight: 1.6,
                  color: 'var(--dusk-ink-mid)',
                  fontStyle: 'italic',
                }}
              >
                {t.quote}
              </p>
              <footer style={{ marginTop: 'auto' }}>
                <p
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontWeight: 600,
                    fontSize: 14,
                    color: 'var(--dusk-ink)',
                  }}
                >
                  {t.attribution}
                </p>
                <p
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    letterSpacing: '0.04em',
                    color: 'var(--dusk-ink-subtle)',
                    marginTop: 2,
                  }}
                >
                  {t.role}
                </p>
              </footer>
            </blockquote>
          ))}
        </div>
      </div>
    </section>
  )
}
