import type { Metadata } from 'next'
import Link from 'next/link'
import Header from '@/components/Header'
import ScrollRevealInit from '@/components/ScrollReveal'
import Footer from '@/components/sections/Footer'
import { pageMetadata } from '@/lib/site'

export const metadata: Metadata = pageMetadata({
  title: 'Free Rationale Alternative',
  description:
    'Houses of Thought is a free, open alternative to Rationale and other paid AI decision tools. Compare features: transparent reasoning, cited evidence, nine intellectual standards.',
  path: '/vs-rationale',
  ogTitle: 'Houses of Thought vs Rationale — Free Alternative',
})

const features: {
  label: string
  rationale: string
  us: string
  usWins: boolean
}[] = [
  {
    label: 'Price',
    rationale: '$9.99–$99.99/month',
    us: 'Free — no paid tiers, ever',
    usWins: true,
  },
  {
    label: 'Reasoning structure',
    rationale: 'Pros vs. cons list',
    us: '7-layer house: concepts → question → perspectives → evidence → assumptions → conclusion → implications',
    usWins: true,
  },
  {
    label: 'Transparency',
    rationale: 'One AI opinion, reasoning hidden',
    us: 'Every layer visible, every step editable',
    usWins: true,
  },
  {
    label: 'Framework',
    rationale: 'Generic AI prompt',
    us: 'Trapasso House of Reason, derived from the Paul–Elder model for critical thinking',
    usWins: true,
  },
  {
    label: 'Cited evidence',
    rationale: 'Sources not shown',
    us: 'Research Mode cites real, checkable sources',
    usWins: true,
  },
  {
    label: 'Quality grading',
    rationale: 'Not disclosed',
    us: 'Nine universal intellectual standards (clarity, accuracy, precision, relevance, depth, breadth, logic, significance, fairness)',
    usWins: true,
  },
  {
    label: 'Multiple conclusions',
    rationale: 'Single verdict',
    us: 'Conclusion candidates that genuinely disagree — you adopt the one you can defend',
    usWins: true,
  },
  {
    label: 'Your role',
    rationale: 'Receive a verdict',
    us: 'Build the reasoning yourself, guided by AI that questions instead of answering',
    usWins: true,
  },
  {
    label: 'For classrooms',
    rationale: 'Not designed for education',
    us: 'Built for classrooms — teachers see every layer, assign houses, grade reasoning',
    usWins: true,
  },
]

export default function VsRationalePage() {
  return (
    <>
      <ScrollRevealInit />
      <Header />
      <main id="main">
        {/* Hero */}
        <section
          className="ink-surface"
          data-surface="ink"
          style={{
            paddingBlock: 'var(--section-py-lg)',
            position: 'relative',
          }}
        >
          <div className="container" style={{ maxWidth: '64ch' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                marginBottom: 20,
              }}
            >
              <span
                style={{
                  width: 24,
                  height: 1,
                  background: 'var(--amber)',
                }}
              />
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: 'var(--amber)',
                }}
              >
                Alternative
              </span>
            </div>

            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 400,
                fontSize: 'clamp(36px, 6vw, 64px)',
                lineHeight: 1.05,
                letterSpacing: '-0.02em',
                color: 'var(--parchment)',
              }}
            >
              The free alternative to
              <br />
              <span style={{ color: 'var(--amber)', fontStyle: 'italic' }}>
                Rationale
              </span>{' '}
              and paid AI decision tools.
            </h1>

            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 'clamp(16px, 1.5vw, 19px)',
                lineHeight: 1.6,
                color: 'var(--rule)',
                maxWidth: '52ch',
                marginTop: 24,
              }}
            >
              Rationale charges $10–$100/month for an AI to hand you a pros-and-cons
              verdict you can&rsquo;t inspect. Houses of Thought does the same job
              better, for free: you see every perspective, every piece of cited
              evidence, and every assumption the case rests on — built on a real
              teacher&rsquo;s framework for critical thinking, not a generic prompt.
            </p>
          </div>
        </section>

        {/* Comparison table */}
        <section
          style={{
            background: 'var(--parchment)',
            paddingBlock: 'var(--section-py)',
          }}
        >
          <div className="container">
            <div className="table-scroll">
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  border: '1px solid var(--rule)',
                  borderRadius: 12,
                  overflow: 'hidden',
                  background: 'var(--white)',
                }}
              >
                <thead>
                  <tr>
                    <th
                      style={{
                        padding: '16px 20px',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        color: 'var(--ink-subtle)',
                        textAlign: 'left',
                        borderBottom: '1px solid var(--rule)',
                        width: '20%',
                      }}
                    >
                      Feature
                    </th>
                    <th
                      style={{
                        padding: '16px 20px',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        color: 'var(--ink-subtle)',
                        textAlign: 'left',
                        borderBottom: '1px solid var(--rule)',
                        borderLeft: '1px solid var(--rule)',
                        width: '35%',
                      }}
                    >
                      Rationale / paid tools
                    </th>
                    <th
                      style={{
                        padding: '16px 20px',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        color: 'var(--ink)',
                        fontWeight: 600,
                        textAlign: 'left',
                        borderBottom: '1px solid var(--rule)',
                        borderLeft: '2px solid var(--amber)',
                        width: '45%',
                      }}
                    >
                      Houses of Thought
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {features.map((f, i) => (
                    <tr key={f.label}>
                      <td
                        style={{
                          padding: '14px 20px',
                          fontFamily: 'var(--font-mono)',
                          fontSize: 12,
                          color: 'var(--ink-subtle)',
                          borderTop:
                            i > 0 ? '1px solid var(--rule)' : 'none',
                          verticalAlign: 'top',
                        }}
                      >
                        {f.label}
                      </td>
                      <td
                        style={{
                          padding: '14px 20px',
                          fontFamily: 'var(--font-body)',
                          fontSize: 14,
                          lineHeight: 1.5,
                          color: 'var(--ink-subtle)',
                          borderTop:
                            i > 0 ? '1px solid var(--rule)' : 'none',
                          borderLeft: '1px solid var(--rule)',
                          textDecoration: 'line-through',
                          textDecorationColor: 'var(--rule)',
                          verticalAlign: 'top',
                        }}
                      >
                        {f.rationale}
                      </td>
                      <td
                        style={{
                          padding: '14px 20px',
                          fontFamily: 'var(--font-body)',
                          fontSize: 14,
                          lineHeight: 1.5,
                          fontWeight: 600,
                          color: 'var(--ink)',
                          borderTop:
                            i > 0 ? '1px solid var(--rule)' : 'none',
                          borderLeft: '2px solid var(--amber)',
                          verticalAlign: 'top',
                        }}
                      >
                        {f.us}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: 'var(--ink-subtle)',
                marginTop: 16,
                lineHeight: 1.5,
              }}
            >
              Pricing as published by vendors. Verify current rates directly.
            </p>
          </div>
        </section>

        {/* CTA */}
        <section
          className="ink-surface"
          data-surface="ink"
          style={{
            paddingBlock: 'var(--section-py)',
            textAlign: 'center',
          }}
        >
          <div
            className="container"
            style={{ maxWidth: '52ch', margin: '0 auto' }}
          >
            <div
              className="section-nine-mark active"
              style={{ marginBottom: 28 }}
            >
              {Array.from({ length: 9 }).map((_, i) => (
                <span key={i} />
              ))}
            </div>

            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 400,
                fontSize: 'clamp(28px, 4vw, 48px)',
                lineHeight: 1.1,
                letterSpacing: '-0.01em',
                color: 'var(--parchment)',
              }}
            >
              Try it now. No sign-up,
              <br />
              no payment, no catch.
            </h2>

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'center',
                gap: 14,
                marginTop: 32,
              }}
            >
              <Link
                href="/try"
                className="btn-primary"
                style={{ fontSize: 16 }}
              >
                Try it free →
              </Link>
              <Link href="/login?mode=signup" className="btn-ghost">
                Create free account
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
