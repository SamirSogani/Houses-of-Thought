'use client'

import { useEffect, useRef, useState } from 'react'

const steps = [
  {
    num: '01',
    title: 'Frame it.',
    body: "Start with purpose, the key concepts, and one overarching question worth reasoning about. If it can be answered in a single line, it's not a house yet.",
    tag: 'Layers · Concepts · Question',
    layers: ['b0', 'b1'],
  },
  {
    num: '02',
    title: 'Break it down.',
    body: 'Split the question into sub-questions and look at each from several points of view, including the ones you would rather avoid. Blind spots hide in the perspectives you skip.',
    tag: 'Layer · Perspectives',
    layers: ['b2'],
  },
  {
    num: '03',
    title: 'Ground it.',
    body: 'Bring in evidence and facts. In Research Mode the AI finds and cites real sources, so every claim traces back to something you can check.',
    tag: 'Layer · Evidence',
    layers: ['b3'],
  },
  {
    num: '04',
    title: 'Examine it.',
    body: 'Surface your assumptions, follow the logic through, and draw sub-conclusions. Weak reasoning shows itself here, which is where you get the chance to fix it.',
    tag: 'Layer · Assumptions',
    layers: ['b4'],
  },
  {
    num: '05',
    title: 'Conclude & test it.',
    body: 'Reach an overarching conclusion, read your House Strength across evidence, logic and coverage, then stress-test it and trace the implications.',
    tag: 'Layers · Conclusion · Implications',
    layers: ['b5', 'roof'],
  },
]

const layerRects: { id: string; y: number; label: string }[] = [
  { id: 'b0', y: 370, label: 'Concepts' },
  { id: 'b1', y: 326, label: 'Overarching question' },
  { id: 'b2', y: 282, label: 'Perspectives' },
  { id: 'b3', y: 238, label: 'Evidence' },
  { id: 'b4', y: 194, label: 'Assumptions' },
  { id: 'b5', y: 150, label: 'Conclusion' },
]

function HouseDiagram({ activeLayers, stepLabel }: { activeLayers: string[]; stepLabel: string }) {
  const isActive = (id: string) => activeLayers.includes(id)

  return (
    <div
      style={{
        position: 'sticky',
        top: 96,
        background: 'var(--parchment)',
        border: '1px solid var(--rule)',
        borderRadius: 12,
        padding: 22,
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
        <span>House / Section view</span>
        <span>{stepLabel}</span>
      </div>

      <svg viewBox="0 0 380 452" style={{ width: '100%', height: 'auto' }} role="img" aria-label="A reasoning house built in layers from foundation to roof">
        <defs>
          <pattern id="how-bpgrid" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="#AEB8C7" opacity="0.5" />
          </pattern>
        </defs>
        <rect width="380" height="452" fill="url(#how-bpgrid)" />
        <path d="M44 414 H316 V432 H44 Z" stroke="var(--ink)" strokeWidth="1.6" fill="none" />

        {layerRects.map((l) => {
          const active = isActive(l.id)
          return (
            <g key={l.id} data-layer={l.id} style={{ transition: 'fill 0.3s, stroke 0.3s' }}>
              <rect
                x={70}
                y={l.y}
                width={240}
                height={44}
                fill={active ? 'rgba(242,176,33,0.20)' : '#FFFFFF'}
                stroke={active ? '#D9990C' : 'var(--ink)'}
                strokeWidth={active ? 1.8 : 1.4}
                style={{ transition: 'fill 0.3s, stroke 0.3s' }}
              />
              <text
                x={190}
                y={l.y + 27}
                textAnchor="middle"
                fontFamily="var(--font-mono)"
                fontSize="13"
                fill={active ? 'var(--ink)' : 'var(--ink-subtle)'}
                style={{ transition: 'fill 0.3s' }}
              >
                {l.label}
              </text>
            </g>
          )
        })}

        <path
          d="M44 150 L190 24 L336 150 Z"
          fill={isActive('roof') ? 'rgba(242,176,33,0.20)' : '#FFFFFF'}
          stroke={isActive('roof') ? '#D9990C' : 'var(--ink)'}
          strokeWidth={isActive('roof') ? 1.8 : 1.4}
          style={{ transition: 'fill 0.3s, stroke 0.3s' }}
        />
        <text
          x={190}
          y={105}
          textAnchor="middle"
          fontFamily="var(--font-mono)"
          fontSize="13"
          fill={isActive('roof') ? 'var(--ink)' : 'var(--ink-subtle)'}
          style={{ transition: 'fill 0.3s' }}
        >
          Implications
        </text>
      </svg>

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
        <span>Full model at /framework</span>
      </div>
    </div>
  )
}

export default function HowBuildFlowSection() {
  const [activeStep, setActiveStep] = useState(0)
  const stepRefs = useRef<(HTMLDivElement | null)[]>([])

  // Highlight the step whose card sits nearest the vertical center of the
  // viewport as you scroll. A plain scroll handler is used instead of an
  // IntersectionObserver: the previous observer keyed off a 10%-tall band with
  // thresholds a taller-than-band card can never reach, so it never advanced.
  useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      const line = window.innerHeight / 2
      let nearest = 0
      let nearestDist = Infinity
      stepRefs.current.forEach((el, i) => {
        if (!el) return
        const rect = el.getBoundingClientRect()
        const dist = Math.abs(rect.top + rect.height / 2 - line)
        if (dist < nearestDist) {
          nearestDist = dist
          nearest = i
        }
      })
      setActiveStep(nearest)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <section
      style={{ background: 'var(--white)', borderTop: '1px solid var(--rule)', paddingBlock: 'var(--section-py)' }}
    >
      <div className="container">
        <div data-reveal>
          <p className="eyebrow">The build flow</p>
          <h2 className="h2" style={{ marginTop: 16, fontSize: 'clamp(28px, 3.4vw, 40px)', maxWidth: '22ch' }}>
            Five moves, foundation to roof.
          </h2>
        </div>

        {/* No alignItems override: the columns stretch to equal height so the
            left column is taller than the diagram, giving position: sticky the
            travel room it needs to stay pinned while the steps scroll past. */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'clamp(32px, 5vw, 72px)', marginTop: 44 }}>
          <div style={{ flex: '1 1 320px' }}>
            <HouseDiagram activeLayers={steps[activeStep].layers} stepLabel={`Step 0${activeStep + 1}`} />
          </div>

          <div style={{ flex: '1 1 420px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {steps.map((s, i) => (
              <div
                key={s.num}
                ref={(el) => {
                  stepRefs.current[i] = el
                }}
                style={{
                  background: 'var(--white)',
                  border: '1px solid var(--rule)',
                  borderRadius: 12,
                  padding: '26px 28px',
                  borderLeft: `3px solid ${activeStep === i ? 'var(--amber)' : 'var(--rule)'}`,
                  transition: 'border-left-color 0.3s',
                }}
              >
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--amber-text)' }}>
                  {s.num}
                </span>
                <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 24, color: 'var(--ink)', marginTop: 12 }}>
                  {s.title}
                </h3>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 16, lineHeight: 1.6, color: 'var(--ink-mid)', marginTop: 10 }}>
                  {s.body}
                </p>
                <p
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: 'var(--ink-subtle)',
                    marginTop: 14,
                  }}
                >
                  {s.tag}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
