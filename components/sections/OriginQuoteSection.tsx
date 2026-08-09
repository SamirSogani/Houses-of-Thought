import Link from 'next/link'

export default function OriginQuoteSection() {
  return (
    <section style={{ background: 'var(--white)', paddingBlock: 'var(--section-py)' }}>
      <div className="container" style={{ maxWidth: '68ch', margin: '0 auto', textAlign: 'center' }}>
        <p className="eyebrow">Section 08 — Where it comes from</p>

        <blockquote
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 400,
            fontSize: 'clamp(24px, 3.2vw, 38px)',
            lineHeight: 1.28,
            letterSpacing: '-0.01em',
            color: 'var(--ink)',
            marginTop: 24,
            fontStyle: 'normal',
          }}
        >
          &ldquo;Built by a student, around a framework his teacher chose to
          share: John Trapasso&rsquo;s classroom model, derived from the
          Paul–Elder model for critical thinking.&rdquo;
        </blockquote>

        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 16,
            lineHeight: 1.6,
            color: 'var(--ink-mid)',
            maxWidth: '52ch',
            margin: '24px auto 0',
          }}
        >
          Not another AI wrapper. A real method, adapted with care into
          something students and thinkers can actually build with.
        </p>

        <div style={{ marginTop: 24 }}>
          <Link href="/story" className="text-link">
            Our story →
          </Link>
        </div>
      </div>
    </section>
  )
}
