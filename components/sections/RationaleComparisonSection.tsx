// Direct comparison against paid AI decision-support tools (e.g. Rationale).
// Every claim here must stay true of the product as shipped today — no
// promising a live capability that isn't reachable.

const rows: { label: string; them: string; us: string }[] = [
  { label: 'Price', them: '$9.99–$99.99/month', us: 'Free, always' },
  { label: 'Your effort', them: 'Type a question, get a verdict', us: 'Type a question — get an 8-layer architecture' },
  { label: 'Shows its work', them: 'One AI opinion, no inspection', us: 'Every layer visible: perspectives, evidence, assumptions, conclusions' },
  { label: 'Cited evidence', them: 'Not shown', us: 'Research Mode cites real, checkable sources' },
  { label: 'Competing conclusions', them: 'Single answer', us: '2–4 genuinely disagreeing conclusions, scored' },
  { label: 'Quality control', them: 'Not disclosed', us: '47 agents × 9 intellectual standards' },
  { label: 'Built on', them: 'A generic prompt', us: 'A named critical-thinking framework, taught by a real teacher' },
]

export default function RationaleComparisonSection() {
  return (
    <section style={{ background: 'var(--parchment)', borderTop: '1px solid var(--rule)', paddingBlock: 'var(--section-py)' }}>
      <div className="container" data-reveal>
        <div style={{ maxWidth: '62ch' }}>
          <p className="eyebrow">Section 06 &mdash; Why not pay for it?</p>
          <h2 className="h2" style={{ marginTop: 16 }}>
            Same low effort. Radically better output.
          </h2>
          <p className="body-text" style={{ marginTop: 20 }}>
            Tools like Rationale charge a monthly fee for an AI verdict you
            can&rsquo;t inspect. Houses of Thought gives you the same minimal-effort
            experience &mdash; type a question, get structured reasoning &mdash;
            but what comes back is an entire architecture: cited sources, multiple
            perspectives, competing conclusions scored on nine standards, and a
            stress test that tells you where the reasoning is weakest.
            All free.
          </p>
        </div>

        <div
          style={{
            marginTop: 40,
            border: '1px solid var(--rule)',
            borderRadius: 12,
            overflow: 'hidden',
            background: 'var(--white)',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(120px, 1fr) 1.4fr 1.4fr',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--ink-subtle)',
              borderBottom: '1px solid var(--rule)',
            }}
          >
            <div style={{ padding: '14px 16px' }} />
            <div style={{ padding: '14px 16px', borderLeft: '1px solid var(--rule)' }}>Paid decision tools</div>
            <div style={{ padding: '14px 16px', borderLeft: '1px solid var(--amber)', color: 'var(--ink)', fontWeight: 600 }}>
              Houses of Thought
            </div>
          </div>

          {rows.map((row, i) => (
            <div
              key={row.label}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(120px, 1fr) 1.4fr 1.4fr',
                borderTop: i === 0 ? 'none' : '1px solid var(--rule)',
              }}
            >
              <div
                style={{
                  padding: '14px 16px',
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
                  padding: '14px 16px',
                  borderLeft: '1px solid var(--rule)',
                  fontFamily: 'var(--font-body)',
                  fontSize: 14.5,
                  lineHeight: 1.5,
                  color: 'var(--ink-mid)',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {row.them}
              </div>
              <div
                style={{
                  padding: '14px 16px',
                  borderLeft: '1px solid var(--amber)',
                  fontFamily: 'var(--font-body)',
                  fontSize: 14.5,
                  lineHeight: 1.5,
                  fontWeight: 600,
                  color: 'var(--ink)',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {row.us}
              </div>
            </div>
          ))}
        </div>

        <p
          style={{
            marginTop: 16,
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--ink-subtle)',
            lineHeight: 1.5,
          }}
        >
          Pricing for paid decision tools as published by their vendors; verify current pricing directly with them.
        </p>
      </div>
    </section>
  )
}
