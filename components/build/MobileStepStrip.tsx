'use client'

// Compact horizontal step navigator for <1024px, replacing the BlueprintRail
// column. Same data + handlers as the rail (layers, layerDone, onGo) and the
// same Badge treatment, laid out as a scrollable strip under the context bar.

import { useEffect, useRef } from 'react'
import type { State } from '@/lib/build/types'
import { layerKey } from '@/lib/build/content'
import { layerDone, doneCount } from '@/lib/build/strength'
import { Badge } from './BlueprintRail'

export function MobileStepStrip({ state, onGo }: { state: State; onGo: (step: number) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<HTMLButtonElement>(null)
  const done = doneCount(state)

  // Keep the active step centered in the strip as the user navigates.
  useEffect(() => {
    const strip = scrollRef.current
    const btn = activeRef.current
    if (!strip || !btn) return
    strip.scrollTo({ left: btn.offsetLeft - (strip.clientWidth - btn.clientWidth) / 2, behavior: 'smooth' })
  }, [state.step])

  return (
    <div style={{ background: 'var(--white)', borderTop: '1px solid var(--rule-soft)', borderBottom: '1px solid var(--rule)' }}>
      <div
        ref={scrollRef}
        className="bhp-step-strip"
        style={{ display: 'flex', gap: 8, alignItems: 'center', overflowX: 'auto', padding: '8px 12px' }}
      >
        <span className="mono" style={{ fontSize: 9, color: 'var(--ink-subtle)', flex: '0 0 auto' }}>
          {done} / 7
        </span>
        {[1, 2, 3, 4, 5, 6, 7].map((step) => {
          const active = state.step === step
          const isDone = layerDone(step, state)
          return (
            <button
              key={step}
              type="button"
              ref={active ? activeRef : undefined}
              onClick={() => onGo(step)}
              aria-current={active ? 'step' : undefined}
              style={{
                flex: '0 0 auto',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                minHeight: 44,
                padding: '8px 12px',
                borderRadius: 10,
                whiteSpace: 'nowrap',
                background: active ? 'var(--amber-tint)' : 'var(--white)',
                border: `1px solid ${active ? 'var(--amber)' : 'var(--rule)'}`,
                transition: 'background 0.18s, border-color 0.18s',
              }}
            >
              <Badge step={step} active={active} done={isDone} />
              <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>{layerKey(step)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
