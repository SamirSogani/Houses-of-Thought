import Link from 'next/link'

const rows: { label: string; them: string; us: string; usAccent?: boolean }[] = [
  { label: 'Price', them: '$9.99–$99.99/mo', us: 'Free — forever', usAccent: true },
  { label: 'Transparency', them: 'One AI opinion, no internals', us: 'Every layer visible and editable' },
  { label: 'Framework', them: 'A generic prompt', us: 'Trapasso / Paul–Elder critical-thinking model' },
  { label: 'Sources', them: 'Not shown', us: 'Research Mode cites real, checkable sources' },
  { label: 'Rigor', them: 'Not disclosed', us: 'Graded by nine intellectual standards' },
  { label: 'Your role', them: 'Receive a verdict', us: 'Build the reasoning yourself' },
]

export default function RationaleComparisonSection() {
  return (
    <section
      className="ink-surface"
      data-surface="ink"
      style={{ paddingBlock: 'var(--section-py-lg)' }}
    >
      <div className="container">
        <div style={{ maxWidth: '52ch' }}>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--amber)',
            }}
          >
            Looking for an alternative?
          </span>
          <h2
            className="h2"
            style={{
              color: 'var(--parchment)',
              marginTop: 14,
              fontSize: 'clamp(28px, 4vw, 48px)',
            }}
          >
            The free alternative to paid AI decision tools.
          </h2>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 17,
              lineHeight: 1.6,
              color: 'var(--rule)',
              maxWidth: '46ch',
              marginTop: 16,
            }}
          >
            Tools like Rationale charge a monthly fee for an AI to hand you a
            verdict you can&rsquo;t inspect. We do the same job better, for free
            — and you see everything.
          </p>
        </div>

        {/* Comparison */}
        <div
          style={{
            marginTop: 48,
            border: '1px solid var(--ink-mid)',
            borderRadius: 12,
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(100px, 0.8fr) 1.2fr 1.2fr',
              borderBottom: '1px solid var(--ink-mid)',
            }}
          >
            <div style={{ padding: '14px 18px' }} />
            <div
              style={{
                padding: '14px 18px',
                borderLeft: '1px solid var(--ink-mid)',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--ink-subtle)',
              }}
            >
              Paid decision tools
            </div>
            <div
              style={{
                padding: '14px 18px',
                borderLeft: '2px solid var(--amber)',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--amber)',
                fontWeight: 600,
              }}
            >
              Houses of Thought
            </div>
          </div>

          {/* Rows */}
          {rows.map((row, i) => (
            <div
              key={row.label}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(100px, 0.8fr) 1.2fr 1.2fr',
                borderTop: i === 0 ? 'none' : '1px solid var(--ink-mid)',
              }}
            >
              <div
                style={{
                  padding: '14px 18px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  color: 'var(--ink-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {row.label}
              </div>
              <div
                style={{
                  padding: '14px 18px',
                  borderLeft: '1px solid var(--ink-mid)',
                  fontFamily: 'var(--font-body)',
                  fontSize: 14,
                  lineHeight: 1.5,
                  color: 'var(--ink-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  textDecoration: 'line-through',
                  textDecorationColor: 'var(--ink-mid)',
                }}
              >
                {row.them}
              </div>
              <div
                style={{
                  padding: '14px 18px',
                  borderLeft: '2px solid var(--amber)',
                  fontFamily: 'var(--font-body)',
                  fontSize: 14,
                  lineHeight: 1.5,
                  fontWeight: 600,
                  color: row.usAccent
                    ? 'var(--amber)'
                    : 'var(--parchment)',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {row.us}
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            marginTop: 20,
          }}
        >
          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--ink-subtle)',
              lineHeight: 1.5,
            }}
          >
            Pricing as published by vendors. Verify current rates directly.
          </p>
          <Link
            href="/vs-rationale"
            style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 600,
              fontSize: 15,
              color: 'var(--amber)',
              borderBottom: '1px solid var(--amber)',
              paddingBottom: 2,
            }}
          >
            Full comparison →
          </Link>
        </div>
      </div>
    </section>
  )
}
