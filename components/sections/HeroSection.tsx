'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { ArrowIcon } from '@/components/icons'

function HeroHouseSvg() {
  useEffect(() => {
    const timer = setTimeout(() => {
      document.querySelectorAll('.house-layer').forEach((el) => {
        ;(el as SVGElement).style.animation = 'none'
        ;(el as SVGElement).style.strokeDashoffset = '0'
      })
    }, 1700)
    return () => clearTimeout(timer)
  }, [])

  const layers: { d?: string; rect?: [number, number, number, number]; line?: [number, number, number, number]; sw?: number; delay: number }[] = [
    { d: 'M44 414 H316 V432 H44 Z', delay: 0 },
    { rect: [60, 370, 240, 44], delay: 60 },
    { rect: [60, 326, 240, 44], delay: 140 },
    { rect: [60, 282, 240, 44], delay: 220 },
    { line: [140, 282, 140, 326], sw: 1.2, delay: 300 },
    { line: [220, 282, 220, 326], sw: 1.2, delay: 300 },
    { rect: [60, 238, 240, 44], delay: 300 },
    { rect: [60, 194, 240, 44], delay: 380 },
    { rect: [60, 150, 240, 44], delay: 460 },
    { d: 'M44 150 L180 24 L316 150', delay: 540 },
  ]

  return (
    <svg viewBox="0 0 360 452" style={{ width: '100%', height: 'auto' }}>
      <defs>
        <pattern id="bpgrid" width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="1" fill="#AEB8C7" opacity="0.5" />
        </pattern>
      </defs>
      <rect width="360" height="452" fill="url(#bpgrid)" />
      <rect x="60" y="150" width="240" height="44" fill="#F2B021" opacity="0.16" />
      <rect x="174" y="60" width="12" height="12" fill="#F2B021" />
      {layers.map((l, i) => {
        const style = { animationDelay: `${l.delay}ms` }
        if (l.d) {
          return (
            <path
              key={i}
              d={l.d}
              stroke="#14213A"
              strokeWidth="1.6"
              fill="none"
              pathLength={1}
              className="house-layer"
              style={style}
            />
          )
        }
        if (l.rect) {
          const [x, y, w, h] = l.rect
          return (
            <rect
              key={i}
              x={x} y={y} width={w} height={h}
              stroke="#14213A"
              strokeWidth="1.6"
              fill="none"
              pathLength={1}
              className="house-layer"
              style={style}
            />
          )
        }
        if (l.line) {
          const [x1, y1, x2, y2] = l.line
          return (
            <line
              key={i}
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="#14213A"
              strokeWidth={l.sw ?? 1.6}
              pathLength={1}
              className="house-layer"
              style={style}
            />
          )
        }
        return null
      })}
    </svg>
  )
}

export default function HeroSection() {
  return (
    <section style={{ background: 'var(--parchment)', paddingBlock: 'var(--hero-py)' }}>
      <div
        className="container"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'clamp(40px, 5vw, 72px)',
          alignItems: 'center',
        }}
      >
        {/* Left — Copy */}
        <div style={{ flex: '1 1 380px', minWidth: 'min(300px, 100%)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ display: 'block', width: 24, height: 1, background: 'var(--amber)' }} />
            <span className="eyebrow">Sheet 01 / Home</span>
          </div>

          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 500,
              fontSize: 'clamp(40px, 6vw, 72px)',
              lineHeight: 1.04,
              letterSpacing: '-0.015em',
              marginTop: 20,
              color: 'var(--ink)',
            }}
          >
            Build the reasoning,
            <br />
            not just the answer.
          </h1>

          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 'clamp(17px, 1.6vw, 19px)',
              lineHeight: 1.6,
              color: 'var(--ink-mid)',
              maxWidth: '36ch',
              marginTop: 22,
            }}
          >
            For hard decisions and arguments that deserve more than a paid
            verdict. Houses of Thought turns a question into structured,
            defensible reasoning — perspectives, evidence, assumptions — built
            on a real teacher&rsquo;s framework for critical thinking, with AI
            that guides instead of deciding.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 32 }}>
            <Link href="/try" className="btn-primary">
              Try it free <ArrowIcon />
            </Link>
            <Link href="/how-it-works" className="btn-secondary">
              Read how it works
            </Link>
          </div>

          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              letterSpacing: '0.04em',
              color: 'var(--ink-subtle)',
              marginTop: 18,
            }}
          >
            Free, always — no $10&ndash;$100/month tiers.
          </p>
        </div>

        {/* Right — HouseDiagram card */}
        <div style={{ flex: '1 1 380px', minWidth: 'min(300px, 100%)', maxWidth: 440 }}>
          <div
            style={{
              background: 'var(--white)',
              border: '1px solid var(--rule)',
              borderRadius: 12,
              padding: 24,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: 'var(--ink-subtle)',
                marginBottom: 16,
              }}
            >
              <span>House / Detail</span>
              <span>Foundation → Roof</span>
            </div>

            <HeroHouseSvg />

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: 'var(--ink-subtle)',
                marginTop: 16,
              }}
            >
              <span>7 layers</span>
              <span>Draws in 900ms</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
