// Home: a compact proof-by-example section (decisions/001 §4: "proof-by-
// example is stronger than documentation"). Reuses the real Examples data
// verbatim — no separate copy to keep in sync, and lib/examples/data.ts /
// lib/build/** stay untouched.

import Link from 'next/link'
import { examples } from '@/lib/examples/data'
import { ArrowIcon } from '@/components/icons'

const FEATURED_SLUGS = ['should-ai-be-used-in-schools', 'should-i-take-the-startup-offer', 'is-it-ethical-to-eat-meat']

export default function ExamplesTeaser() {
  const featured = FEATURED_SLUGS.map((slug) => examples.find((e) => e.slug === slug)).filter((e) => e !== undefined)

  return (
    <section style={{ paddingBlock: 'var(--section-py)', borderTop: '1px solid var(--dusk-rule)' }}>
      <div className="container">
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16 }}>
          <div style={{ maxWidth: '52ch' }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--amber)' }}>
              See it reasoned through
            </p>
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 'clamp(28px, 4vw, 42px)', letterSpacing: '-0.01em', color: 'var(--dusk-ink)', marginTop: 12 }}>
              Real questions, fully worked.
            </h2>
          </div>
          <Link href="/examples" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 15, color: 'var(--amber)' }}>
            Browse all examples <ArrowIcon />
          </Link>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20, marginTop: 32 }}>
          {featured.map((e) => (
            <Link
              key={e.slug}
              href={`/examples/${e.slug}`}
              className="dusk-card"
              style={{ display: 'flex', flexDirection: 'column', padding: 'clamp(22px, 3vw, 26px)' }}
            >
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--dusk-ink-subtle)', border: '1px solid var(--dusk-rule)', borderRadius: 5, padding: '2px 8px', alignSelf: 'flex-start' }}>
                {e.domain}
              </span>
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 19, letterSpacing: '-0.01em', color: 'var(--dusk-ink)', lineHeight: 1.25, marginTop: 14 }}>
                {e.house.title}
              </h3>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.5, color: 'var(--dusk-ink-mid)', marginTop: 10 }}>
                {e.summary}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
