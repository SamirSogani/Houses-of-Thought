export default function StoryIntroSection() {
  return (
    <section style={{ background: 'var(--parchment)', paddingBlock: 'var(--hero-py)' }}>
      <div className="container" style={{ maxWidth: 720, margin: '0 auto' }} data-reveal>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ display: 'block', width: 24, height: 1, background: 'var(--amber)' }} />
          <span className="eyebrow">Sheet 07 / Our story</span>
        </div>

        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 500,
            fontSize: 'clamp(36px, 5.4vw, 60px)',
            lineHeight: 1.08,
            letterSpacing: '-0.015em',
            maxWidth: '16ch',
            marginTop: 20,
            color: 'var(--ink)',
          }}
        >
          A short story about how this started.
        </h1>

        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'clamp(18px, 1.7vw, 20px)',
            lineHeight: 1.6,
            color: 'var(--ink-mid)',
            maxWidth: '56ch',
            marginTop: 20,
          }}
        >
          Houses of Thought wasn&rsquo;t built by a company. It was built by a
          student, around a framework his teacher chose to share.
        </p>
      </div>
    </section>
  )
}
