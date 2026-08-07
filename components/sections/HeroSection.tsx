'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { ArrowIcon } from '@/components/icons'

/* Animated counter that ticks up from 0 to `end` */
function AnimCounter({ end, suffix = '' }: { end: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let frame = 0
    const total = 36
    const tick = () => {
      frame++
      const t = Math.min(frame / total, 1)
      const eased = 1 - Math.pow(1 - t, 3) // ease-out cubic
      el.textContent = `${Math.round(end * eased)}${suffix}`
      if (t < 1) requestAnimationFrame(tick)
    }
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { tick(); observer.disconnect() } },
      { threshold: 0.3 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [end, suffix])

  return <span ref={ref}>0{suffix}</span>
}

const stats: { value: number; suffix?: string; label: string }[] = [
  { value: 47, label: 'AI review agents' },
  { value: 9, label: 'Intellectual standards' },
  { value: 8, label: 'Reasoning layers' },
]

export default function HeroSection() {
  return (
    <section
      className="ink-surface"
      style={{ background: 'var(--ink)', paddingBlock: 'var(--hero-py)', position: 'relative', overflow: 'hidden' }}
    >
      {/* Blueprint dot grid overlay */}
      <svg
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', opacity: 0.35 }}
        aria-hidden="true"
      >
        <defs>
          <pattern id="hero-dots" width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.8" fill="#3E5C8A" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hero-dots)" />
      </svg>

      <div className="container" style={{ position: 'relative', zIndex: 1 }}>
        {/* Eyebrow */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <span style={{ display: 'block', width: 28, height: 1, background: 'var(--amber)' }} />
          <span className="eyebrow" style={{ color: 'var(--rule)' }}>Sheet 01 / Home</span>
        </div>

        {/* Headline */}
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 500,
            fontSize: 'clamp(38px, 6vw, 76px)',
            lineHeight: 1.04,
            letterSpacing: '-0.02em',
            color: 'var(--parchment)',
            maxWidth: '18ch',
          }}
        >
          One question in.
          <br />
          <span style={{ color: 'var(--amber)' }}>Defensible reasoning</span> out.
        </h1>

        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'clamp(17px, 1.6vw, 20px)',
            lineHeight: 1.6,
            color: 'var(--rule)',
            maxWidth: '48ch',
            marginTop: 24,
          }}
        >
          Type a question. Add context if you want. Our pipeline deploys{' '}
          <strong style={{ color: 'var(--parchment)' }}>47&nbsp;AI review agents</strong> across{' '}
          <strong style={{ color: 'var(--parchment)' }}>8&nbsp;reasoning layers</strong>,
          grading every claim against{' '}
          <strong style={{ color: 'var(--parchment)' }}>9&nbsp;intellectual standards</strong>.
          You get structured, cited, stress-tested reasoning you can actually defend.
        </p>

        {/* Fake input field — visual centerpiece */}
        <div
          style={{
            marginTop: 40,
            maxWidth: 560,
            border: '1px solid var(--ink-mid)',
            borderRadius: 10,
            background: 'rgba(247,246,242,0.04)',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 17,
              color: 'var(--ink-subtle)',
              flex: 1,
            }}
          >
            Should I take the job offer or stay?
          </span>
          <Link
            href="/try"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              height: 42,
              padding: '0 20px',
              background: 'var(--amber)',
              color: 'var(--ink)',
              fontWeight: 600,
              fontSize: 15,
              borderRadius: 7,
              whiteSpace: 'nowrap',
              transition: 'background 0.2s',
            }}
          >
            Build <ArrowIcon size={14} />
          </Link>
        </div>

        <p
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--ink-subtle)',
            marginTop: 12,
            letterSpacing: '0.04em',
          }}
        >
          Free, always &mdash; no sign-up required to try.
        </p>

        {/* Stats bar */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 0,
            marginTop: 52,
            borderTop: '1px solid var(--ink-mid)',
          }}
        >
          {stats.map((s, i) => (
            <div
              key={s.label}
              style={{
                flex: '1 1 160px',
                padding: '28px 0',
                borderRight: i < stats.length - 1 ? '1px solid var(--ink-mid)' : 'none',
                paddingRight: i < stats.length - 1 ? 32 : 0,
                paddingLeft: i > 0 ? 32 : 0,
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 600,
                  fontSize: 'clamp(36px, 4vw, 52px)',
                  color: 'var(--amber)',
                  lineHeight: 1,
                }}
              >
                <AnimCounter end={s.value} suffix={s.suffix} />
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: 'var(--rule)',
                  marginTop: 8,
                }}
              >
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
