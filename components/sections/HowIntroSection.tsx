export default function HowIntroSection() {
  return (
    <section style={{ background: 'var(--parchment)', paddingBlock: 'var(--hero-py)' }}>
      <div className="container" data-reveal>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ display: 'block', width: 24, height: 1, background: 'var(--amber)' }} />
          <span className="eyebrow">Sheet 02 / How it works</span>
        </div>

        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 500,
            fontSize: 'clamp(34px, 5.4vw, 60px)',
            lineHeight: 1.08,
            letterSpacing: '-0.015em',
            maxWidth: '16ch',
            marginTop: 20,
            color: 'var(--ink)',
          }}
        >
          How a House gets built.
        </h1>

        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'clamp(17px, 1.6vw, 19px)',
            lineHeight: 1.6,
            color: 'var(--ink-mid)',
            maxWidth: '58ch',
            marginTop: 20,
          }}
        >
          Reasoning flows two ways: down from a question into the sub-questions
          that make it hard, and back up from evidence to a conclusion you can
          actually defend. Here&rsquo;s the whole build in five moves.
        </p>
      </div>
    </section>
  )
}
