// Home: a short nod to the origin story and its credibility (a real classroom
// model, not proprietary house style) — the full narrative lives at /story.

import Link from 'next/link'
import { ArrowIcon } from '@/components/icons'

export default function OriginTeaser() {
  return (
    <section style={{ paddingBlock: 'var(--section-py)', borderTop: '1px solid var(--dusk-rule)' }}>
      <div className="container">
        <div className="dusk-card" style={{ padding: 'clamp(28px, 5vw, 52px)', display: 'flex', flexWrap: 'wrap', gap: 28, alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ maxWidth: '58ch' }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--amber)' }}>
              Not invented for an app
            </p>
            <p style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 500, fontSize: 'clamp(20px, 2.6vw, 28px)', lineHeight: 1.35, color: 'var(--dusk-ink)', marginTop: 12 }}>
              &ldquo;It was never a lack of intelligence, and it was never a lack of
              information. What was missing was structure.&rdquo;
            </p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 15, lineHeight: 1.6, color: 'var(--dusk-ink-mid)', marginTop: 14 }}>
              Houses of Thought is built on John Trapasso&rsquo;s classroom model,
              taught for years before it was ever software, and derived from the
              Paul&ndash;Elder framework for critical thinking.
            </p>
          </div>
          <Link href="/story" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 15, color: 'var(--amber)', whiteSpace: 'nowrap' }}>
            Read our story <ArrowIcon />
          </Link>
        </div>
      </div>
    </section>
  )
}
