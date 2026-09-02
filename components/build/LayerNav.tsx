'use client'

// Horizontal layer navigator for the document-view builder (builder-workspace-
// redesign plan §2): the seven layers as dot + label, Frame → Review, with the
// focused layer in amber, finished layers in green, and a drafted-but-
// unclaimed layer as a hollow amber ring so the claim gate is visible from the
// nav itself. One component serves desktop and mobile; it replaces both
// BlueprintRail (the roof-to-foundation column) and MobileStepStrip.
//
// Clicking dispatches GO_STEP; Canvas owns scrolling the section into view and
// the scroll-spy that dispatches GO_STEP back as the reader scrolls, so this
// component only ever reads state.step.

import { useEffect, useRef } from 'react'
import type { State } from '@/lib/build/types'
import { layers } from '@/lib/build/content'
import { layerDone } from '@/lib/build/strength'
import { stageForStep } from '@/lib/ai/draft'

export function LayerNav({ state, onGo }: { state: State; onGo: (step: number) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<HTMLButtonElement>(null)

  // Keep the focused layer in view when the strip itself overflows (narrow
  // viewports) — same behaviour MobileStepStrip had.
  useEffect(() => {
    const strip = scrollRef.current
    const btn = activeRef.current
    if (!strip || !btn || strip.scrollWidth <= strip.clientWidth) return
    strip.scrollTo({ left: btn.offsetLeft - (strip.clientWidth - btn.clientWidth) / 2, behavior: 'smooth' })
  }, [state.step])

  return (
    <nav aria-label="House layers" className="bhp-layer-nav-wrap" style={{ minWidth: 0, flex: '1 1 auto' }}>
      <div
        ref={scrollRef}
        className="bhp-step-strip bhp-layer-nav"
        style={{ display: 'flex', alignItems: 'center', gap: 4, overflowX: 'auto' }}
      >
        {layers.map((l, i) => {
          const step = l.step
          const active = state.step === step
          const done = layerDone(step, state)
          const stage = stageForStep(step)
          const awaitingClaim =
            stage !== null && state.draft !== null && state.draft.drafted[stage] && !state.draft.claimed[stage]
          return (
            <span key={step} style={{ display: 'inline-flex', alignItems: 'center', flex: '0 0 auto' }}>
              {i > 0 && <span aria-hidden="true" style={{ width: 14, height: 1, background: 'var(--rule-soft)', margin: '0 2px' }} />}
              <button
                type="button"
                ref={active ? activeRef : undefined}
                onClick={() => onGo(step)}
                aria-current={active ? 'step' : undefined}
                title={awaitingClaim ? `${l.key} · AI-drafted, awaiting your claim` : l.key}
                className="bhp-layer-nav-item"
                style={{
                  // Positioning context for the .sr-only spans below: they are
                  // position:absolute, and without this they resolve against
                  // the page — so a button scrolled past the viewport edge
                  // inside the strip would extend the document's scroll width.
                  position: 'relative',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  minHeight: 36,
                  padding: '6px 8px',
                  borderRadius: 8,
                  background: active ? 'var(--amber-tint)' : 'transparent',
                  border: 'none',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  transition: 'background 0.18s',
                }}
              >
                <Dot active={active} done={done} awaitingClaim={awaitingClaim} />
                <span
                  style={{
                    fontWeight: active ? 600 : 500,
                    fontSize: 13,
                    color: active ? 'var(--ink)' : done ? 'var(--ink-mid)' : 'var(--ink-subtle)',
                  }}
                >
                  {l.key}
                </span>
                {awaitingClaim && <span className="sr-only"> (AI-drafted, awaiting your claim)</span>}
                {done && !active && <span className="sr-only"> (done)</span>}
              </button>
            </span>
          )
        })}
      </div>
    </nav>
  )
}

function Dot({ active, done, awaitingClaim }: { active: boolean; done: boolean; awaitingClaim: boolean }) {
  const base: React.CSSProperties = { width: 9, height: 9, borderRadius: 999, flex: '0 0 auto', boxSizing: 'border-box' }
  if (active) return <span aria-hidden="true" style={{ ...base, background: 'var(--amber)' }} />
  if (awaitingClaim) return <span aria-hidden="true" style={{ ...base, border: '2px solid var(--amber)', background: 'transparent' }} />
  if (done) return <span aria-hidden="true" style={{ ...base, background: 'var(--green-strong)' }} />
  return <span aria-hidden="true" style={{ ...base, background: 'var(--rule)' }} />
}
