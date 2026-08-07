import Link from 'next/link'

export default function OriginQuoteSection() {
  return (
    <section
      style={{
        background: 'var(--parchment)',
        paddingBlock: 'var(--section-py-lg)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Architectural grid background, faint */}
      <svg
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          opacity: 0.04,
          pointerEvents: 'none',
        }}
        aria-hidden="true"
      >
        <defs>
          <pattern
            id="lineage-grid"
            width="40"
            height="40"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="1" cy="1" r="0.8" fill="var(--ink)" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#lineage-grid)" />
      </svg>

      <div
        className="container"
        style={{
          maxWidth: '64ch',
          margin: '0 auto',
          textAlign: 'center',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Nine mark divider */}
        <div className="section-nine-mark active" style={{ marginBottom: 32 }}>
          {Array.from({ length: 9 }).map((_, i) => (
            <span key={i} />
          ))}
        </div>

        <blockquote
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 400,
            fontSize: 'clamp(26px, 3.5vw, 44px)',
            lineHeight: 1.2,
            letterSpacing: '-0.015em',
            color: 'var(--ink)',
            fontStyle: 'italic',
          }}
        >
          Built by a student, around a framework his teacher chose to share.
        </blockquote>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            marginTop: 32,
            alignItems: 'center',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--ink-subtle)',
            }}
          >
            <span style={{ width: 20, height: 1, background: 'var(--amber)' }} />
            Lineage
            <span style={{ width: 20, height: 1, background: 'var(--amber)' }} />
          </div>

          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 17,
              lineHeight: 1.6,
              color: 'var(--ink-mid)',
              maxWidth: '48ch',
              marginTop: 12,
            }}
          >
            John Trapasso&rsquo;s{' '}
            <strong style={{ color: 'var(--ink)' }}>House of Reason</strong>{' '}
            — a 12-layer reasoning model built for classrooms — adapted from
            the{' '}
            <strong style={{ color: 'var(--ink)' }}>
              Paul–Elder model for critical thinking
            </strong>
            . Not another AI wrapper. A real method, mapped to seven builder
            layers, with every claim graded against the nine universal
            intellectual standards.
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 24,
            marginTop: 28,
            flexWrap: 'wrap',
          }}
        >
          <Link href="/story" className="text-link">
            Our story →
          </Link>
          <Link href="/framework" className="text-link">
            The framework →
          </Link>
        </div>
      </div>
    </section>
  )
}
