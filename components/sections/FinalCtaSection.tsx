import Link from 'next/link'
import { ArrowIcon } from '@/components/icons'

export default function FinalCtaSection() {
  return (
    <section className="ink-surface" style={{ background: 'var(--ink)', paddingBlock: 'clamp(56px, 9vw, 104px)' }}>
      <div
        className="container"
        style={{ maxWidth: '62ch', margin: '0 auto', textAlign: 'center' }}
      >
        <p className="eyebrow-amber eyebrow-amber-on-ink">Section 10 &mdash; Start</p>

        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 500,
            fontSize: 'clamp(34px, 5vw, 60px)',
            lineHeight: 1.1,
            letterSpacing: '-0.01em',
            color: 'var(--parchment)',
            marginTop: 16,
          }}
        >
          One question. That&rsquo;s all it takes.
        </h2>

        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 17,
            lineHeight: 1.6,
            color: 'var(--rule)',
            maxWidth: '44ch',
            margin: '20px auto 0',
          }}
        >
          Type your hardest question. 47&nbsp;agents build the reasoning.
          Nine standards grade it. You get a defensible answer with every
          layer visible.
        </p>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: 14,
            marginTop: 32,
          }}
        >
          <Link href="/try" className="btn-primary">
            Try it free <ArrowIcon />
          </Link>
          <Link href="/login?mode=signup" className="btn-ghost">
            Create free account
          </Link>
        </div>

        <p
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            color: 'var(--rule)',
            marginTop: 22,
          }}
        >
          No sign-up to try. Free &mdash; no $10&ndash;$100/month tiers, ever.
        </p>
      </div>
    </section>
  )
}
