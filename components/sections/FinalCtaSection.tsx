import Link from 'next/link'
import { ArrowIcon } from '@/components/icons'

export default function FinalCtaSection() {
  return (
    <section style={{ background: 'var(--ink)', paddingBlock: 'clamp(56px, 9vw, 104px)' }}>
      <div
        className="container"
        style={{ maxWidth: '62ch', margin: '0 auto', textAlign: 'center' }}
      >
        <p className="eyebrow-amber">Section 09 — Start</p>

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
          Pick a question you can&rsquo;t crack.
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
          <Link href="/try" className="btn-primary">
            Try it free <ArrowIcon />
          </Link>
          <Link href="/signup" className="btn-ghost">
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
          No sign-up to try — your work is saved locally until you create an
          account.
        </p>
      </div>
    </section>
  )
}
