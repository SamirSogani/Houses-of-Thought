'use client'

// The claim pass (decision 016 §2), rendered in the canvas above the active
// layer. On a drafted-but-unclaimed layer it carries the deferred accept: the
// person reads the AI's items on this very step, edits freely, then claims the
// layer with the button here. On the Conclusion step it instead marks the one
// layer Draft Mode never touches.
//
// Also mounts LayerFeedbackThread (migration 0039) for any layer the co-pilot
// has drafted, claimed or not — the person's chance to ask about it or flag a
// mistake / missing context after the fact, not just at the moment of claim.

import type { Action, State } from '@/lib/build/types'
import { draftGateLocked, stageForStep } from '@/lib/ai/draft'
import { SparkIcon } from './buildIcons'
import { LayerFeedbackThread } from './LayerFeedbackThread'

export function DraftClaimBanner({
  state,
  dispatch,
  houseId,
  step: stepProp,
}: {
  state: State
  dispatch: React.Dispatch<Action>
  // Scopes the post-draft Q&A/correction thread (migration 0039) to this
  // house. Undefined on the localStorage /house builder, which has no row to
  // scope a thread to — the feedback affordance below simply doesn't render
  // there, same gate CopilotPanel already applies to the reasoning pipeline
  // entry point.
  houseId?: string
  // Which layer this banner belongs to. The stacked document (builder-
  // workspace-redesign plan §1) mounts one banner per section, so the layer
  // can no longer be inferred from state.step (the *focused* layer). Defaults
  // to state.step for any remaining single-layer caller.
  step?: number
}) {
  const draft = state.draft
  if (!draft) return null

  const step = stepProp ?? state.step
  const stage = stageForStep(step)

  // Drafted layer awaiting its claim.
  const claimBanner =
    stage && draft.drafted[stage] && !draft.claimed[stage] ? (
      <div
        className="fade-in"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 14,
          flexWrap: 'wrap',
          marginTop: 18,
          padding: '12px 16px',
          background: 'var(--amber-tint)',
          border: '1px solid var(--amber)',
          borderRadius: 11,
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <SparkIcon size={14} fill="var(--amber-hover)" />
          <span style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.45 }}>
            Drafted by the co-pilot — read it, edit anything that is off, then claim it as yours.
          </span>
        </span>
        <button
          type="button"
          onClick={() => dispatch({ type: 'CLAIM_DRAFT_LAYER', stage })}
          style={{
            flex: '0 0 auto',
            height: 34,
            padding: '0 14px',
            background: 'var(--ink)',
            color: 'var(--parchment)',
            borderRadius: 7,
            fontWeight: 600,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Claim this layer
        </button>
      </div>
    ) : // Mid-run: the draft is still generating (or wedged — the runner's card
    // lives in the rail and can be unavailable, e.g. after losing draft
    // eligibility or a daily cap mid-run). This Stop is the gate's escape
    // hatch: STOP_DRAFT settles the stage machine so claiming — and
    // eventually publish — can proceed.
    draft.stage !== 'done' ? (
      <div
        className="fade-in mono"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          flexWrap: 'wrap',
          marginTop: 18,
          padding: '9px 14px',
          fontSize: 10,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--ink-subtle)',
          border: '1px dashed var(--rule)',
          borderRadius: 9,
        }}
      >
        <span>AI draft in progress · drafted layers arrive on their steps</span>
        <button
          type="button"
          onClick={() => dispatch({ type: 'STOP_DRAFT' })}
          style={{ font: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit', color: 'var(--blueprint)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
        >
          Stop the draft here
        </button>
      </div>
    ) : // Conclusion step: the layer the AI never drafts (016 §1).
    step === 5 ? (
      <div
        className="fade-in mono"
        style={{
          marginTop: 18,
          padding: '9px 14px',
          fontSize: 10,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--ink-subtle)',
          border: '1px dashed var(--rule)',
          borderRadius: 9,
        }}
      >
        {draftGateLocked(draft)
          ? 'Claim the drafted layers first — this layer is where the house becomes yours'
          : 'The co-pilot never drafts this layer · the conclusion is yours to write'}
      </div>
    ) : null

  // Ask/correct affordance: available for any layer the co-pilot has drafted,
  // claimed or not — a mistake or missing context is often only noticed after
  // the fact (see this file's own module comment).
  const feedback =
    stage && draft.drafted[stage] && houseId ? (
      // Keyed on stage: switching layers must not leak one layer's expanded/
      // loaded transcript state into another's (React would otherwise reuse
      // this instance in place since it stays the same component at the same
      // position).
      <LayerFeedbackThread key={stage} state={state} dispatch={dispatch} houseId={houseId} stage={stage} />
    ) : null

  if (!claimBanner && !feedback) return null
  return (
    <>
      {claimBanner}
      {feedback}
    </>
  )
}
