'use client'

// The claim pass (decision 016 §2), rendered in the canvas above the active
// layer. On a drafted-but-unclaimed layer it carries the deferred accept: the
// person reads the AI's items on this very step, edits freely, then claims the
// layer with the button here. On the Conclusion step it instead marks the one
// layer Draft Mode never touches.

import type { Action, State } from '@/lib/build/types'
import { draftGateLocked, stageForStep } from '@/lib/ai/draft'
import { SparkIcon } from './buildIcons'

export function DraftClaimBanner({
  state,
  dispatch,
}: {
  state: State
  dispatch: React.Dispatch<Action>
}) {
  const draft = state.draft
  if (!draft) return null

  const stage = stageForStep(state.step)

  // Drafted layer awaiting its claim.
  if (stage && draft.drafted[stage] && !draft.claimed[stage]) {
    return (
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
    )
  }

  // Conclusion step: the layer the AI never drafts (016 §1).
  if (state.step === 5) {
    const locked = draftGateLocked(draft)
    return (
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
        {locked
          ? 'Claim the drafted layers first — this layer is where the house becomes yours'
          : 'The co-pilot never drafts this layer · the conclusion is yours to write'}
      </div>
    )
  }

  return null
}
