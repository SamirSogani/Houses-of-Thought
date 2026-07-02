import Link from 'next/link'
import { ArrowIcon } from '@/components/icons'

type CTASectionProps = {
  eyebrow: string
  heading: string
  primaryLabel: string
  primaryHref: string
  secondaryLabel: string
  secondaryHref: string
  note: string
}

export default function CTASection({
  eyebrow,
  heading,
  primaryLabel,
  primaryHref,
  secondaryLabel,
  secondaryHref,
  note,
}: CTASectionProps) {
  return (
    <section style={{ background: 'var(--ink)', paddingBlock: 'clamp(56px, 9vw, 104px)' }}>
      <div
        className="container"
        style={{ maxWidth: '62ch', margin: '0 auto', textAlign: 'center' }}
      >
        <p className="eyebrow-amber">{eyebrow}</p>

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
          {heading}
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
          <Link href={primaryHref} className="btn-primary">
            {primaryLabel} <ArrowIcon />
          </Link>
          <Link href={secondaryHref} className="btn-ghost">
            {secondaryLabel}
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
          {note}
        </p>
      </div>
    </section>
  )
}
