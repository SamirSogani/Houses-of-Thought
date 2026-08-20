// Center canvas: step header + active layer body + Back/Next footer.
// See handoff 02 §6 / 05 §5 / 05 §10b.

import { forwardRef } from 'react'
import type { Action, State } from '@/lib/build/types'
import type { Strength } from '@/lib/build/strength'
import { layers, layerKey } from '@/lib/build/content'
import { ChevronLeft, LongArrow } from './buildIcons'
import { DraftClaimBanner } from './DraftClaimBanner'
import { FrameLayer } from './layers/FrameLayer'
import { PerspectivesLayer } from './layers/PerspectivesLayer'
import { PerspectiveDetail } from './layers/PerspectiveDetail'
import { EvidenceLayer } from './layers/EvidenceLayer'
import { AssumptionsLayer } from './layers/AssumptionsLayer'
import { ConclusionLayer } from './layers/ConclusionLayer'
import { ImplicationsLayer } from './layers/ImplicationsLayer'
import { ReviewLayer } from './layers/ReviewLayer'

export const Canvas = forwardRef<HTMLElement, { state: State; strength: Strength; dispatch: React.Dispatch<Action>; houseId?: string }>(
  function Canvas({ state, strength, dispatch, houseId }, ref) {
    const { step } = state
    const layer = layers[step - 1]
    const activePerspective =
      step === 2 && state.activePerspective != null
        ? state.perspectives.find((p) => p.id === state.activePerspective) ?? null
        : null
    const showStepHeader = !activePerspective

    return (
      <main
        ref={ref}
        className="build-scroll"
        style={{ flex: '1 1 auto', overflowY: 'auto', minWidth: 0 }}
      >
        <div className="bhp-canvas-inner" style={{ maxWidth: 760, margin: '0 auto', padding: '30px 36px 120px' }}>
          {showStepHeader && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="mono" style={{ fontSize: 11, color: 'var(--amber-text)' }}>Layer {step} / 7</span>
                <span style={{ width: 16, height: 1, background: 'var(--rule)' }} />
                <span className="mono" style={{ fontSize: 11, color: 'var(--ink-subtle)' }}>{layer.kicker}</span>
              </div>
              <h1 className="bhp-canvas-title" style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 32, letterSpacing: '-0.015em', color: 'var(--ink)', marginTop: 12 }}>
                {layer.title}
              </h1>
              <p style={{ fontSize: 16, color: 'var(--ink-mid)', lineHeight: 1.55, marginTop: 10, maxWidth: '60ch' }}>{layer.blurb}</p>
            </div>
          )}

          {/* Draft Mode claim pass (decision 016 §2) + post-draft Q&A (0039) */}
          {showStepHeader && <DraftClaimBanner state={state} dispatch={dispatch} houseId={houseId} />}

          {/* Body */}
          {step === 1 && <FrameLayer state={state} dispatch={dispatch} />}
          {step === 2 &&
            (activePerspective ? (
              <PerspectiveDetail perspective={activePerspective} dispatch={dispatch} onBack={() => dispatch({ type: 'CLOSE_PERSPECTIVE' })} />
            ) : (
              <PerspectivesLayer state={state} dispatch={dispatch} />
            ))}
          {step === 3 && <EvidenceLayer state={state} dispatch={dispatch} />}
          {step === 4 && <AssumptionsLayer state={state} dispatch={dispatch} />}
          {step === 5 && <ConclusionLayer state={state} dispatch={dispatch} />}
          {step === 6 && <ImplicationsLayer state={state} dispatch={dispatch} />}
          {step === 7 && <ReviewLayer state={state} strength={strength} dispatch={dispatch} />}

          {/* Footer */}
          <Footer step={step} dispatch={dispatch} />
        </div>
      </main>
    )
  }
)

function Footer({
  step,
  dispatch,
}: {
  step: number
  dispatch: React.Dispatch<Action>
}) {
  const backDisabled = step === 1
  const backLabel = backDisabled ? 'Back' : layerKey(step - 1)
  const isLast = step === 7

  return (
    <div className="bhp-canvas-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--rule)', marginTop: 34, paddingTop: 20 }}>
      <button
        type="button"
        disabled={backDisabled}
        onClick={() => { if (!backDisabled) dispatch({ type: 'GO_STEP', n: step - 1 }) }}
        className="bhp-footer-back"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 14, color: backDisabled ? 'var(--rule)' : 'var(--ink)', cursor: backDisabled ? 'default' : 'pointer', background: 'transparent' }}
      >
        <ChevronLeft size={14} stroke={backDisabled ? 'var(--rule)' : 'var(--ink)'} />
        {backLabel}
      </button>
      {/* Review is the terminal layer — its "To strengthen this house" list is
          the next action, so there is no forward button on the last step. */}
      {!isLast && (
        <button
          type="button"
          onClick={() => dispatch({ type: 'GO_STEP', n: step + 1 })}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 44, padding: '0 20px', background: 'var(--ink)', color: 'var(--parchment)', borderRadius: 8, fontWeight: 600, fontSize: 14 }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ink-mid)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--ink)')}
        >
          Next · {layerKey(step + 1)}
          <LongArrow size={16} stroke="var(--parchment)" />
        </button>
      )}
    </div>
  )
}
