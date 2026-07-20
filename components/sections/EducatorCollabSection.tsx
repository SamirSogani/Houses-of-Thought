export default function EducatorCollabSection() {
  return (
    <section
      style={{ background: 'var(--parchment)', borderTop: '1px solid var(--rule)', paddingBlock: 'var(--section-py)' }}
    >
      <div
        className="container"
        style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 'clamp(32px, 5vw, 64px)' }}
        data-reveal
      >
        <div style={{ flex: '1 1 320px' }}>
          <p className="eyebrow">Collaboration</p>
          <h2 className="h2" style={{ marginTop: 16, fontSize: 'clamp(26px, 3vw, 36px)', maxWidth: '18ch' }}>
            Real people reasoning together.
          </h2>
        </div>

        <div style={{ flex: '1 1 380px' }}>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 17, lineHeight: 1.6, color: 'var(--ink-mid)', maxWidth: '56ch' }}>
            Inside classrooms, collaboration means real people: teachers review
            submitted houses and leave graded feedback students see in their own
            workspace. That&rsquo;s distinct from the individual builder, where
            the &ldquo;collaborator&rdquo; is the AI. We only claim what exists
            today — student peer review is on the roadmap.
          </p>
          <span
            style={{
              display: 'inline-block',
              marginTop: 16,
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              border: '1px dashed var(--warning)',
              borderRadius: 5,
              padding: '5px 10px',
              color: 'var(--warning)',
            }}
          >
            Group peer-review workflows · Roadmap
          </span>
        </div>
      </div>
    </section>
  )
}
