export default function FaqIntroSection() {
  return (
    <section style={{ paddingBlock: 'var(--hero-py)' }}>
      <div className="container" style={{ maxWidth: 820, margin: '0 auto' }} data-reveal>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ display: 'block', width: 24, height: 1, background: 'var(--amber)' }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--amber)' }}>FAQ</span>
        </div>

        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 500,
            fontSize: 'clamp(36px, 5.4vw, 60px)',
            lineHeight: 1.08,
            letterSpacing: '-0.015em',
            maxWidth: '14ch',
            marginTop: 20,
            color: 'var(--dusk-ink)',
          }}
        >
          Questions, answered.
        </h1>

        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'clamp(17px, 1.6vw, 19px)',
            lineHeight: 1.6,
            color: 'var(--dusk-ink-mid)',
            maxWidth: '52ch',
            marginTop: 20,
          }}
        >
          The short version of how Houses of Thought works, what the AI does, and
          how classrooms and accounts are handled.
        </p>
      </div>
    </section>
  )
}
