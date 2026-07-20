// Branded 404 (seo #4/#11): mistyped URLs, expired join codes, and removed
// example slugs used to land on the unbranded framework default with no way
// back into the site.

import Link from 'next/link'
import Header from '@/components/Header'
import Footer from '@/components/sections/Footer'

export default function NotFound() {
  return (
    <>
      <Header />
      <main>
        <section style={{ background: 'var(--parchment)', paddingBlock: 'clamp(72px, 12vw, 140px)' }}>
          <div className="container" style={{ maxWidth: '62ch', textAlign: 'center' }}>
            <p className="mono" style={{ fontSize: 12, letterSpacing: '0.14em', color: 'var(--ink-subtle)', textTransform: 'uppercase' }}>
              404 · No house here
            </p>
            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 500,
                fontSize: 'clamp(34px, 5vw, 56px)',
                letterSpacing: '-0.015em',
                lineHeight: 1.1,
                color: 'var(--ink)',
                marginTop: 16,
              }}
            >
              This page was never built.
            </h1>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 17, lineHeight: 1.6, color: 'var(--ink-mid)', marginTop: 16 }}>
              The address may be mistyped, or the page may have moved. Everything
              that exists is reachable from the front door.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 14, marginTop: 32 }}>
              <Link href="/" className="btn-primary">
                Back to home
              </Link>
              <Link
                href="/try"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: 52,
                  padding: '0 24px',
                  border: '1px solid var(--ink)',
                  borderRadius: 'var(--radius-btn)',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 600,
                  fontSize: 16,
                  color: 'var(--ink)',
                }}
              >
                Try it free
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
