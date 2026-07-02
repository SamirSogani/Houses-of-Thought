export default function FaqIntroSection() {
  return (
    <section style={{ background: 'var(--parchment)', paddingBlock: 'var(--hero-py)' }}>
      <div className="container" style={{ maxWidth: 820, margin: '0 auto' }} data-reveal>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ display: 'block', width: 24, height: 1, background: 'var(--amber)' }} />
          <span className="eyebrow">Sheet 08 / FAQ</span>
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
            color: 'var(--ink)',
          }}
        >
          Questions, answered.
        </h1>

        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'clamp(17px, 1.6vw, 19px)',
            lineHeight: 1.6,
            color: 'var(--ink-mid)',
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
