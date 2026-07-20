const bars = [
  { label: 'Evidence', value: 85, color: 'var(--green-text)' },
  { label: 'Logic', value: 80, color: 'var(--green-text)' },
  { label: 'Coverage', value: 72, color: 'var(--green-mid)' },
]

export default function HowOutcomeSection() {
  return (
    <section
      style={{ background: 'var(--white)', borderTop: '1px solid var(--rule)', paddingBlock: 'var(--section-py)' }}
    >
      <div
        className="container"
        style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'clamp(32px, 5vw, 64px)' }}
        data-reveal
      >
        <div style={{ flex: '1 1 360px' }}>
          <p className="eyebrow">What you end up with</p>
          <h2 className="h2" style={{ marginTop: 16, maxWidth: '20ch' }}>
            A conclusion you can defend, and a score that tells you how well.
          </h2>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 17, lineHeight: 1.6, color: 'var(--ink-mid)', maxWidth: '48ch', marginTop: 16 }}>
            Every house ends with a House Strength read across evidence, logic,
            and coverage. It autosaves to your dashboard as you build, and
            classwork can be turned in to your teacher.
          </p>
        </div>

        <div style={{ flex: '1 1 360px' }}>
          <div style={{ background: 'var(--parchment)', border: '1px solid var(--rule)', borderRadius: 12, padding: 26 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: 'var(--ink-subtle)',
                }}
              >
                House Strength
              </span>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 40, color: 'var(--ink)' }}>
                82
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 22 }}>
              {bars.map((b) => (
                <div key={b.label}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 12,
                      color: 'var(--ink-mid)',
                      marginBottom: 6,
                    }}
                  >
                    <span>{b.label}</span>
                    <span>{b.value}</span>
                  </div>
                  <div style={{ height: 8, background: 'var(--rule)', borderRadius: 4 }}>
                    <div style={{ height: 8, width: `${b.value}%`, background: b.color, borderRadius: 4 }} />
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 22 }}>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  textTransform: 'uppercase',
                  border: '1px solid var(--ink)',
                  borderRadius: 5,
                  padding: '5px 10px',
                  color: 'var(--ink)',
                }}
              >
                Autosaved
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  textTransform: 'uppercase',
                  border: '1px solid var(--rule)',
                  borderRadius: 5,
                  padding: '5px 10px',
                  color: 'var(--ink-subtle)',
                }}
              >
                Stress-tested
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  textTransform: 'uppercase',
                  border: '1px solid var(--rule)',
                  borderRadius: 5,
                  padding: '5px 10px',
                  color: 'var(--ink-subtle)',
                }}
              >
                Turn in
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
