'use client'

// First-run tooltip tour for the builder (September 2026 UX audit, item 1).
// A lightweight positioned tooltip that points to each target element in turn,
// with Next / Skip controls. No third-party library — just a portal div
// positioned against the target's bounding rect.
//
// The tour shows once per user. The parent reads `has_seen_builder_tour` from
// the profile and only mounts this component when false. On completion or skip,
// this component calls `onDismiss` which writes the flag server-side.

import { useCallback, useEffect, useRef, useState } from 'react'

interface TourStep {
  /** CSS selector for the target element. */
  selector: string
  /** Preferred tooltip placement. */
  placement: 'bottom' | 'right' | 'left'
  /** Bold heading for the tooltip. */
  title: string
  /** Body copy. */
  body: string
}

const STEPS: TourStep[] = [
  {
    selector: '.bhp-layer-nav',
    placement: 'bottom',
    title: 'The seven layers',
    body: 'These are the 7 layers of your house. Start at the top.',
  },
  {
    selector: '.bhp-doc-h1',
    placement: 'bottom',
    title: 'Your question',
    body: 'Write your reasoning here. The AI co-pilot can help.',
  },
  {
    selector: '.bhp-right-rail, .bhp-mobile-copilot',
    placement: 'left',
    title: 'The co-pilot',
    body: 'Ask the co-pilot for suggestions, evidence, or feedback.',
  },
  {
    selector: '.bhp-status-meta',
    placement: 'bottom',
    title: 'House strength',
    body: 'This tracks how complete and rigorous your house is.',
  },
]

const TOOLTIP_GAP = 10
const TOOLTIP_WIDTH = 280

export function OnboardingTour({ onDismiss }: { onDismiss: () => void }) {
  const [current, setCurrent] = useState(0)
  const [pos, setPos] = useState<{ top: number; left: number; caretSide: 'top' | 'right' | 'left' } | null>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const reduceMotion = useRef(false)

  useEffect(() => {
    reduceMotion.current = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  }, [])

  const positionTooltip = useCallback(() => {
    const step = STEPS[current]
    if (!step) return
    const target = document.querySelector<HTMLElement>(step.selector)
    if (!target) {
      // Target not found (e.g. mobile layout hides the right rail) — skip step.
      if (current < STEPS.length - 1) setCurrent((c) => c + 1)
      else onDismiss()
      return
    }

    const rect = target.getBoundingClientRect()
    const tooltip = tooltipRef.current
    const tooltipHeight = tooltip?.offsetHeight ?? 120

    let top: number
    let left: number
    let caretSide: 'top' | 'right' | 'left'

    if (step.placement === 'bottom') {
      top = rect.bottom + TOOLTIP_GAP
      left = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2
      caretSide = 'top'
    } else if (step.placement === 'left') {
      top = rect.top + rect.height / 2 - tooltipHeight / 2
      left = rect.left - TOOLTIP_WIDTH - TOOLTIP_GAP
      caretSide = 'right'
    } else {
      // right
      top = rect.top + rect.height / 2 - tooltipHeight / 2
      left = rect.right + TOOLTIP_GAP
      caretSide = 'left'
    }

    // Clamp to viewport edges.
    const vw = window.innerWidth
    const vh = window.innerHeight
    if (left < 12) left = 12
    if (left + TOOLTIP_WIDTH > vw - 12) left = vw - TOOLTIP_WIDTH - 12
    if (top < 12) top = 12
    if (top + tooltipHeight > vh - 12) top = vh - tooltipHeight - 12

    setPos({ top, left, caretSide })
  }, [current, onDismiss])

  // Position on mount, step change, and window resize.
  useEffect(() => {
    positionTooltip()
    window.addEventListener('resize', positionTooltip)
    return () => window.removeEventListener('resize', positionTooltip)
  }, [positionTooltip])

  // Re-position once the tooltip ref mounts (first render has no height).
  useEffect(() => {
    const frame = requestAnimationFrame(positionTooltip)
    return () => cancelAnimationFrame(frame)
  }, [positionTooltip])

  function next() {
    if (current < STEPS.length - 1) setCurrent((c) => c + 1)
    else onDismiss()
  }

  function skip() {
    onDismiss()
  }

  const step = STEPS[current]
  if (!step || !pos) return null

  const isLast = current === STEPS.length - 1

  return (
    <>
      {/* Semi-transparent scrim so the tooltip stands out. */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(20,33,58,0.18)',
          zIndex: 999,
        }}
        onClick={skip}
        aria-hidden="true"
      />

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        role="dialog"
        aria-label={`Tour step ${current + 1} of ${STEPS.length}: ${step.title}`}
        className={reduceMotion.current ? undefined : 'fade-in'}
        style={{
          position: 'fixed',
          top: pos.top,
          left: pos.left,
          zIndex: 1000,
          width: TOOLTIP_WIDTH,
          background: 'var(--ink)',
          color: 'var(--parchment)',
          borderRadius: 12,
          padding: '16px 18px 14px',
          boxShadow: '0 12px 40px rgba(20,33,58,0.35)',
        }}
      >
        {/* Caret arrow */}
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            width: 0,
            height: 0,
            ...(pos.caretSide === 'top' && {
              top: -7,
              left: TOOLTIP_WIDTH / 2 - 7,
              borderLeft: '7px solid transparent',
              borderRight: '7px solid transparent',
              borderBottom: '7px solid var(--ink)',
            }),
            ...(pos.caretSide === 'right' && {
              top: '50%',
              right: -7,
              marginTop: -7,
              borderTop: '7px solid transparent',
              borderBottom: '7px solid transparent',
              borderLeft: '7px solid var(--ink)',
            }),
            ...(pos.caretSide === 'left' && {
              top: '50%',
              left: -7,
              marginTop: -7,
              borderTop: '7px solid transparent',
              borderBottom: '7px solid transparent',
              borderRight: '7px solid var(--ink)',
            }),
          }}
        />

        {/* Progress indicator */}
        <div className="mono" style={{ fontSize: 9, letterSpacing: '0.1em', color: 'var(--amber)', marginBottom: 8 }}>
          {current + 1} / {STEPS.length}
        </div>

        <div style={{ fontWeight: 600, fontSize: 15, lineHeight: 1.3 }}>
          {step.title}
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--rule)', marginTop: 6 }}>
          {step.body}
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
          <button
            type="button"
            onClick={skip}
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--rule)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px 0',
            }}
          >
            Skip tour
          </button>
          <button
            type="button"
            onClick={next}
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--ink)',
              background: 'var(--amber)',
              border: 'none',
              borderRadius: 8,
              padding: '7px 16px',
              cursor: 'pointer',
            }}
          >
            {isLast ? 'Done' : 'Next'}
          </button>
        </div>
      </div>
    </>
  )
}
