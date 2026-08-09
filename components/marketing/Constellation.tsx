'use client'

// The seven-node "constellation" diagram: the centerpiece of the pre-login
// redesign's visual system. Three variants share one geometry + one CSS
// animation grammar (app/styles/dusk-theme.css) so "pass" and "loop-back"
// read the same way everywhere a visitor sees them:
//   - 'compressed'  — Home teaser. Plays once on mount, then rests lit. No
//                     interaction; links out to /how-it-works.
//   - 'interactive' — How It Works. Plays once on mount, then every node is
//                     clickable (keyboard-operable, same toggle-button
//                     pattern as InteractiveHouseSection) and opens a detail
//                     panel below.
//   - 'sweep'       — /try's pre-confirmation beat. Plays once, faster, then
//                     calls onSweepComplete. No labels, no interaction.
//
// Animation approach mirrors HeroSection.tsx's HeroHouseSvg exactly: CSS
// keyframes with a per-element animationDelay computed in JS, frozen to a
// static end state after the sequence finishes (a `setTimeout` matching the
// total duration) rather than a persistent JS timer loop.

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { CONSTELLATION_LAYERS, CONSTELLATION_STANDARDS, type LayerId } from '@/lib/marketing/constellation'
import type { StandardId } from '@/lib/ai/reasoning/contracts'
import { ArrowIcon } from '@/components/icons'

// Node centers along a gentle arc — a sequence, not a scattered cloud (design
// brief). viewBox is fixed; the SVG scales to its container at any width.
const VIEW_W = 1040
const VIEW_H = 300
const NODE_Y = [176, 108, 190, 96, 190, 108, 168]
const NODE_X = CONSTELLATION_LAYERS.map((_, i) => 70 + i * ((VIEW_W - 140) / (CONSTELLATION_LAYERS.length - 1)))

const PANEL_R = 22
const BREADTH_R = 12
const RING_R = 35
const MARK_R = 2.6

function nodePath(): string {
  let d = `M ${NODE_X[0]} ${NODE_Y[0]}`
  for (let i = 1; i < NODE_X.length; i++) {
    const prevX = NODE_X[i - 1]
    const prevY = NODE_Y[i - 1]
    const x = NODE_X[i]
    const y = NODE_Y[i]
    const midX = (prevX + x) / 2
    d += ` C ${midX} ${prevY}, ${midX} ${y}, ${x} ${y}`
  }
  return d
}

// Nine mark positions evenly spaced on the ring, starting at the top.
function markPositions(cx: number, cy: number) {
  return Array.from({ length: 9 }, (_, i) => {
    const angle = -Math.PI / 2 + (i / 9) * Math.PI * 2
    return { x: cx + RING_R * Math.cos(angle), y: cy + RING_R * Math.sin(angle) }
  })
}

// Deterministic (not random per render) — one mark per paneled node is shown
// mid-retry rather than already resolved, so the diagram always demonstrates
// the real loop-and-retry mechanic instead of only ever showing clean passes.
function retryMarkIndex(layerIndex: number): number {
  return (layerIndex * 3 + 2) % 9
}

const SWEEP_STAGGER_MS = 110
const NORMAL_STAGGER_MS = 220
const MARK_STAGGER_MS = 55

interface ConstellationProps {
  variant: 'compressed' | 'interactive' | 'sweep'
  onSweepComplete?: () => void
}

export default function Constellation({ variant, onSweepComplete }: ConstellationProps) {
  const [settled, setSettled] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [selected, setSelected] = useState<LayerId>('frame')

  const stagger = variant === 'sweep' ? SWEEP_STAGGER_MS : NORMAL_STAGGER_MS
  const totalMs = useMemo(() => {
    const lastNode = (CONSTELLATION_LAYERS.length - 1) * stagger
    const marksAfter = 9 * MARK_STAGGER_MS + 700
    return lastNode + marksAfter + 300
  }, [stagger])

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const savedToggle = window.localStorage.getItem('hot-reduced-motion') === '1'
    setReducedMotion(prefersReduced || savedToggle)

    const delay = prefersReduced || savedToggle ? 0 : totalMs
    const t = setTimeout(() => {
      setSettled(true)
      if (variant === 'sweep') onSweepComplete?.()
    }, delay)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function toggleReducedMotion() {
    setReducedMotion((prev) => {
      const next = !prev
      window.localStorage.setItem('hot-reduced-motion', next ? '1' : '0')
      return next
    })
  }

  const activeLayer = CONSTELLATION_LAYERS.find((l) => l.id === selected) ?? CONSTELLATION_LAYERS[0]
  const interactive = variant === 'interactive'

  return (
    <div data-motion={reducedMotion ? 'reduced' : undefined}>
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        style={{ width: '100%', height: 'auto', overflow: 'visible' }}
        role={interactive ? 'group' : 'img'}
        aria-label={
          interactive
            ? 'The seven layers of a reasoning run — select one to read what it does'
            : 'The seven layers of a Houses of Thought reasoning run: Frame, Breadth Scoping, Perspectives, Global Assumptions, Global Evidence, Conclusions, Implications'
        }
      >
        <path
          d={nodePath()}
          fill="none"
          stroke="var(--amber)"
          strokeWidth={1.6}
          strokeLinecap="round"
          pathLength={1}
          className={settled || reducedMotion ? undefined : 'constellation-path'}
          style={{
            strokeDasharray: 1,
            strokeDashoffset: settled || reducedMotion ? 0 : 1,
            opacity: 0.55,
          }}
        />

        {CONSTELLATION_LAYERS.map((layer, i) => {
          const cx = NODE_X[i]
          const cy = NODE_Y[i]
          const r = layer.hasPanel ? PANEL_R : BREADTH_R
          const nodeDelay = i * stagger
          const isSelected = interactive && selected === layer.id
          const nodeProps = interactive
            ? {
                role: 'button' as const,
                tabIndex: 0,
                'aria-pressed': isSelected,
                'aria-label': `${layer.name}, layer ${i + 1} of 7${layer.hasPanel ? ', reviewed by the nine-standard panel' : ', no review panel'}`,
                style: { cursor: 'pointer' as const },
                onClick: () => setSelected(layer.id),
                onKeyDown: (e: React.KeyboardEvent) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setSelected(layer.id)
                  }
                },
              }
            : {}

          return (
            <g key={layer.id} {...nodeProps}>
              {/* Standards ring — nine marks, one per Paul–Elder standard, only
                  for the six panel-gated layers (design brief: Breadth Scoping
                  has none, visually teaching that it skips the panel). */}
              {layer.hasPanel &&
                markPositions(cx, cy).map((m, mi) => {
                  const isRetry = mi === retryMarkIndex(i)
                  const markDelay = nodeDelay + 260 + mi * MARK_STAGGER_MS
                  const resolvedFill = 'var(--standard-cool)'
                  return (
                    <circle
                      key={mi}
                      cx={m.x}
                      cy={m.y}
                      r={MARK_R}
                      fill={settled || reducedMotion ? resolvedFill : 'var(--dusk-rule)'}
                      className={
                        settled || reducedMotion
                          ? undefined
                          : isRetry
                            ? 'constellation-mark-retry'
                            : 'constellation-mark-resolve'
                      }
                      style={{ animationDelay: `${markDelay}ms` }}
                    />
                  )
                })}

              {/* Node body */}
              <circle
                cx={cx}
                cy={cy}
                r={r}
                fill={isSelected ? 'var(--standard-cool-soft)' : 'rgba(242,176,33,0.12)'}
                stroke={isSelected ? 'var(--standard-cool)' : 'var(--amber)'}
                strokeWidth={isSelected ? 2.4 : 1.8}
                className={
                  layer.hasPanel
                    ? settled || reducedMotion
                      ? undefined
                      : 'constellation-node'
                    : settled || reducedMotion
                      ? 'constellation-breadth-pulse'
                      : 'constellation-node'
                }
                style={{ animationDelay: layer.hasPanel ? `${nodeDelay}ms` : undefined, transition: 'fill 0.2s, stroke 0.2s' }}
              />
              <text
                x={cx}
                y={cy + 4}
                textAnchor="middle"
                fontFamily="var(--font-mono)"
                fontSize={layer.hasPanel ? 12 : 10}
                fill="var(--dusk-ink)"
                style={{ pointerEvents: 'none' }}
              >
                {i + 1}
              </text>
            </g>
          )
        })}
      </svg>

      {variant === 'compressed' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginTop: 20 }}>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--dusk-ink-subtle)' }}>
            Seven layers · six reviewed by nine independent standards each · one plain judgment call.
          </p>
          <Link
            href="/how-it-works"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 15, color: 'var(--amber)' }}
          >
            See how it works <ArrowIcon />
          </Link>
        </div>
      )}

      {interactive && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
            <button
              type="button"
              onClick={toggleReducedMotion}
              aria-pressed={reducedMotion}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--dusk-ink-subtle)',
                border: '1px solid var(--dusk-rule)',
                borderRadius: 999,
                padding: '6px 12px',
              }}
            >
              {reducedMotion ? 'Motion: reduced' : 'Reduce motion'}
            </button>
          </div>

          <LayerDetail layer={activeLayer} index={CONSTELLATION_LAYERS.indexOf(activeLayer)} />
        </>
      )}
    </div>
  )
}

function LayerDetail({ layer, index }: { layer: (typeof CONSTELLATION_LAYERS)[number]; index: number }) {
  return (
    <div
      aria-live="polite"
      className="dusk-card"
      style={{ padding: 'clamp(22px, 3vw, 32px)', marginTop: 24 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
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
            fontWeight: 600,
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            padding: '0 6px',
          }}
        >
          {String(index + 1).padStart(2, '0')}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--dusk-ink-subtle)' }}>
          Layer {index + 1} of 7 · {layer.hasPanel ? 'Nine-standard review panel' : 'No review panel'}
        </span>
      </div>

      <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 26, marginTop: 14, color: 'var(--dusk-ink)' }}>
        {layer.name}
      </h3>
      <p style={{ fontFamily: 'var(--font-body)', fontSize: 16, lineHeight: 1.6, color: 'var(--dusk-ink-mid)', marginTop: 10, maxWidth: '68ch' }}>
        {layer.job}
      </p>

      {layer.hasPanel && layer.standardMeanings && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12, marginTop: 24 }}>
          {CONSTELLATION_STANDARDS.map((s) => (
            <div key={s.id} style={{ border: '1px solid var(--dusk-rule)', borderRadius: 10, padding: '13px 15px' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--standard-cool)' }}>
                {s.name}
              </span>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 13.5, lineHeight: 1.5, color: 'var(--dusk-ink-mid)', marginTop: 6 }}>
                {layer.standardMeanings![s.id as StandardId]}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
