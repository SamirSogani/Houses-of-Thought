'use client'

import { useState } from 'react'

type LayerKey = 'concepts' | 'question' | 'perspectives' | 'evidence' | 'assumptions' | 'conclusion' | 'implications'

const layerDefs: Record<LayerKey, { num: string; name: string; definition: string }> = {
  concepts: {
    num: '01',
    name: 'Concepts',
    definition: 'The key terms that frame the topic, defined before you reason so everyone shares the same vocabulary.',
  },
  question: {
    num: '02',
    name: 'Overarching Question',
    definition: 'The single central question the whole house is built to answer.',
  },
  perspectives: {
    num: '03',
    name: 'Perspectives',
    definition: 'Three lenses on the question (Self, Group, and Ideas), so you reason past your own point of view.',
  },
  evidence: {
    num: '04',
    name: 'Evidence',
    definition: 'Facts gathered from real, cited sources. Research Mode grounds the house and resists hallucination.',
  },
  assumptions: {
    num: '05',
    name: 'Assumptions',
    definition: 'Beliefs taken as true without direct evidence, including the unknown unknowns you might miss.',
  },
  conclusion: {
    num: '06',
    name: 'Conclusion',
    definition: 'The synthesized answer, scored across Evidence, Logic, and Coverage.',
  },
  implications: {
    num: '07',
    name: 'Implications',
    definition: 'What follows from the conclusion, sorted into positive, negative, and uncertain.',
  },
}

function InteractiveHouseSvg({
  activeLayer,
  onSelect,
}: {
  activeLayer: LayerKey
  onSelect: (k: LayerKey) => void
}) {
  const amberFill = 'rgba(242,176,33,0.18)'
  const noFill = 'transparent'
  const fill = (k: LayerKey) => (activeLayer === k ? amberFill : noFill)

  const layerProps = (k: LayerKey) => ({
    role: 'button' as const,
    tabIndex: 0,
    style: { cursor: 'pointer' as const, outline: 'none' as const },
    onClick: () => onSelect(k),
    onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(k) } },
    onMouseEnter: () => onSelect(k),
  })

  return (
    <svg viewBox="0 0 360 452" style={{ width: '100%', maxWidth: 420 }}>
      <defs>
        <pattern id="bpgrid2" width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="1" fill="#AEB8C7" opacity="0.5" />
        </pattern>
      </defs>
      <rect width="360" height="452" fill="url(#bpgrid2)" />

      {/* Foundation slab (not interactive) */}
      <path d="M44 414 H316 V432 H44 Z" stroke="#14213A" strokeWidth="1.6" fill="none" />

      {/* Concepts */}
      <g {...layerProps('concepts')}>
        <rect x="60" y="370" width="240" height="44" stroke="#14213A" strokeWidth="1.6" fill={fill('concepts')} />
        <text x="180" y="397" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="12" fill="#2C3A57" style={{ textTransform: 'uppercase', letterSpacing: '0.1em', pointerEvents: 'none' }}>CONCEPTS</text>
      </g>

      {/* Question */}
      <g {...layerProps('question')}>
        <rect x="60" y="326" width="240" height="44" stroke="#14213A" strokeWidth="1.6" fill={fill('question')} />
        <text x="180" y="353" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="12" fill="#2C3A57" style={{ textTransform: 'uppercase', letterSpacing: '0.1em', pointerEvents: 'none' }}>QUESTION</text>
      </g>

      {/* Perspectives */}
      <g {...layerProps('perspectives')}>
        <rect x="60" y="282" width="240" height="44" stroke="#14213A" strokeWidth="1.6" fill={fill('perspectives')} />
        <line x1="140" y1="282" x2="140" y2="326" stroke="#14213A" strokeWidth="1.2" />
        <line x1="220" y1="282" x2="220" y2="326" stroke="#14213A" strokeWidth="1.2" />
        <text x="100" y="308" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="9" fill="#5A6B85" style={{ textTransform: 'uppercase', letterSpacing: '0.1em', pointerEvents: 'none' }}>SELF</text>
        <text x="180" y="308" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="9" fill="#5A6B85" style={{ textTransform: 'uppercase', letterSpacing: '0.1em', pointerEvents: 'none' }}>GROUP</text>
        <text x="260" y="308" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="9" fill="#5A6B85" style={{ textTransform: 'uppercase', letterSpacing: '0.1em', pointerEvents: 'none' }}>IDEAS</text>
      </g>

      {/* Evidence */}
      <g {...layerProps('evidence')}>
        <rect x="60" y="238" width="240" height="44" stroke="#14213A" strokeWidth="1.6" fill={fill('evidence')} />
        <text x="180" y="265" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="12" fill="#2C3A57" style={{ textTransform: 'uppercase', letterSpacing: '0.1em', pointerEvents: 'none' }}>EVIDENCE</text>
      </g>

      {/* Assumptions */}
      <g {...layerProps('assumptions')}>
        <rect x="60" y="194" width="240" height="44" stroke="#14213A" strokeWidth="1.6" fill={fill('assumptions')} />
        <text x="180" y="221" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="12" fill="#2C3A57" style={{ textTransform: 'uppercase', letterSpacing: '0.1em', pointerEvents: 'none' }}>ASSUMPTIONS</text>
      </g>

      {/* Conclusion */}
      <g {...layerProps('conclusion')}>
        <rect x="60" y="150" width="240" height="44" stroke="#14213A" strokeWidth="1.6" fill={fill('conclusion')} />
        <text x="180" y="177" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="12" fill="#2C3A57" style={{ textTransform: 'uppercase', letterSpacing: '0.1em', pointerEvents: 'none' }}>CONCLUSION</text>
      </g>

      {/* Roof / Implications */}
      <g {...layerProps('implications')}>
        <path d="M44 150 L180 24 L316 150" stroke="#14213A" strokeWidth="1.6" fill={fill('implications')} />
        <text x="180" y="120" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="11" fill="#2C3A57" style={{ textTransform: 'uppercase', letterSpacing: '0.1em', pointerEvents: 'none' }}>IMPLICATIONS</text>
      </g>
    </svg>
  )
}

export default function InteractiveHouseSection() {
  const [activeLayer, setActiveLayer] = useState<LayerKey>('evidence')
  const def = layerDefs[activeLayer]

  return (
    <section style={{ background: 'var(--parchment)', paddingBlock: 'var(--section-py)' }}>
      <div className="container">
        <div style={{ maxWidth: '60ch' }}>
          <p className="eyebrow">Section 03 — What a house is</p>
          <h2 className="h2" style={{ marginTop: 16 }}>Reasoning, built one layer at a time.</h2>
          <p className="body-text" style={{ marginTop: 16 }}>
            Every house is built from the foundation up, each layer resting on
            the ones below it. Hover or tap a layer to see what it holds.
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 'clamp(32px, 5vw, 64px)',
            marginTop: 44,
          }}
        >
          <div style={{ flex: '1 1 340px', minWidth: 'min(280px, 100%)' }}>
            <InteractiveHouseSvg activeLayer={activeLayer} onSelect={setActiveLayer} />
          </div>

          <div style={{ flex: '1 1 300px', minWidth: 'min(280px, 100%)' }}>
            <div
              style={{
                background: 'var(--white)',
                border: '1px solid var(--rule)',
                borderRadius: 12,
                padding: 28,
                minHeight: 180,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'var(--amber)',
                    color: 'var(--ink)',
                    borderRadius: 4,
                    minWidth: 26,
                    height: 22,
                    fontWeight: 500,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    padding: '0 6px',
                  }}
                >
                  {def.num}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    color: 'var(--ink-subtle)',
                  }}
                >
                  Layer {def.num} of 07
                </span>
              </div>
              <h3
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 500,
                  fontSize: 28,
                  marginTop: 16,
                  color: 'var(--ink)',
                }}
              >
                {def.name}
              </h3>
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 17,
                  lineHeight: 1.6,
                  color: 'var(--ink-mid)',
                  marginTop: 12,
                }}
              >
                {def.definition}
              </p>
            </div>
            <p
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: 'var(--ink-subtle)',
                marginTop: 14,
              }}
            >
              Built bottom-up · each layer rests on the one below
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
