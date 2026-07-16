'use client'

// Draft Mode's rail card (decision 016), mounted in the co-pilot tab below the
// interviewer. Three lives: offer (blank house, no draft yet) → live build
// checklist (REAL progress — each row flips when its stage's items actually
// land, unlike the mini house's cosmetic timer) → review-and-claim list. The
// loop itself runs in useDraftRunner up in BuildHousePage; this card only
// renders and steers it.

import type { Action, State } from '@/lib/build/types'
import {
  DRAFT_STAGES,
  DRAFT_STAGE_LABELS,
  DRAFT_STAGE_STEP,
  unclaimedDraftStages,
} from '@/lib/ai/draft'
import { RATE_LIMITED_CODE, RATE_LIMITED_COPY } from '@/lib/ai/findings'
import type { DraftRunner } from '../useDraftRunner'
import { CheckIcon } from '@/components/icons'

const cardStyle: React.CSSProperties = {
  background: 'var(--parchment)',
  border: '1px solid var(--rule)',
  borderRadius: 11,
  padding: 13,
  marginBottom: 16,
}

function houseIsBlank(state: State): boolean {
  return (
    state.concepts.length === 0 &&
    state.perspectives.length === 0 &&
    state.evidence.length === 0 &&
    state.assumptions.length === 0 &&
    state.pos.length === 0 &&
    state.neg.length === 0 &&
    state.unc.length === 0 &&
    state.watchpoints.length === 0
  )
}

export function DraftCard({
  state,
  dispatch,
  runner,
}: {
  state: State
  dispatch: React.Dispatch<Action>
  runner: DraftRunner
}) {
  const draft = state.draft

  // ── Offer: no draft yet. Only a blank house can be drafted — never one with
  // existing work in the layers.
  if (!draft) {
    if (!houseIsBlank(state)) return null
    const needsContext = !state.aiContext
    return (
      <div style={cardStyle} className="fade-in">
        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>Start with an AI draft</div>
        <div style={{ fontSize: 12, color: 'var(--ink-subtle)', marginTop: 3, lineHeight: 1.45 }}>
          The co-pilot drafts every layer except your conclusion, live on the canvas. You review,
          edit, and claim each one — the verdict stays yours.
        </div>
        {needsContext && (
          <div style={{ fontSize: 12, color: 'var(--ink)', marginTop: 8, lineHeight: 1.45 }}>
            First, give it context with the interview above.
          </div>
        )}
        <button
          type="button"
          onClick={runner.start}
          disabled={needsContext}
          style={{
            marginTop: 10,
            fontWeight: 600,
            fontSize: 12,
            color: 'var(--ink)',
            background: 'var(--amber-tint)',
            border: '1px solid var(--amber)',
            borderRadius: 7,
            padding: '6px 13px',
            cursor: needsContext ? 'not-allowed' : 'pointer',
            opacity: needsContext ? 0.55 : 1,
          }}
        >
          Draft my house
        </button>
      </div>
    )
  }

  // ── Live build: stages still running (or paused / errored mid-way).
  if (draft.stage !== 'done') {
    const currentIdx = DRAFT_STAGES.indexOf(draft.stage)
    return (
      <div style={cardStyle} className="fade-in">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>
            {runner.running ? 'Drafting your house…' : 'Draft paused'}
          </span>
          <span className="mono" style={{ fontSize: 10, color: 'var(--ink-subtle)' }}>
            {currentIdx}/{DRAFT_STAGES.length}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
          {DRAFT_STAGES.map((s, i) => {
            const done = i < currentIdx
            const current = i === currentIdx
            return (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: i > currentIdx ? 0.5 : 1 }}>
                <span style={{ width: 16, display: 'inline-flex', justifyContent: 'center', flex: '0 0 auto' }}>
                  {done ? (
                    <CheckIcon size={14} />
                  ) : current && runner.running ? (
                    <span className="mini-spinner" aria-hidden="true" />
                  ) : (
                    <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--rule)' }} />
                  )}
                </span>
                <span style={{ fontSize: 12, lineHeight: 1.4, color: done || current ? 'var(--ink)' : 'var(--ink-subtle)' }}>
                  {DRAFT_STAGE_LABELS[s]}
                </span>
              </div>
            )
          })}
        </div>

        {runner.errorCode && (
          <div style={{ fontSize: 12, color: 'var(--ink)', marginTop: 10, lineHeight: 1.45 }}>
            {runner.errorCode === RATE_LIMITED_CODE ? RATE_LIMITED_COPY : 'Could not reach the co-pilot.'}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 11 }}>
          <button type="button" onClick={runner.running ? runner.pause : runner.start} style={smallBtn}>
            {runner.running ? 'Pause' : runner.errorCode ? 'Retry' : 'Resume'}
          </button>
          <button type="button" onClick={runner.stop} style={{ ...smallBtn, borderColor: 'var(--rule)', color: 'var(--ink-subtle)' }}>
            Stop here
          </button>
        </div>
      </div>
    )
  }

  // ── Review & claim: generation done, layers awaiting their claim.
  const unclaimed = unclaimedDraftStages(draft)
  if (unclaimed.length > 0) {
    return (
      <div style={cardStyle} className="fade-in">
        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>
          Review the draft — {unclaimed.length} {unclaimed.length === 1 ? 'layer' : 'layers'} to claim
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-subtle)', marginTop: 3, lineHeight: 1.45 }}>
          Read each drafted layer, edit what is off, then claim it. Publish unlocks when every
          layer is yours.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
          {DRAFT_STAGES.filter((s) => draft.drafted[s]).map((s) => {
            const claimed = draft.claimed[s]
            return (
              <div key={s} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12, color: claimed ? 'var(--ink-subtle)' : 'var(--ink)' }}>
                  {claimed ? <CheckIcon size={13} /> : <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--amber)' }} />}
                  <span style={{ textTransform: 'capitalize' }}>{s}</span>
                </span>
                {!claimed && (
                  <button
                    type="button"
                    onClick={() => dispatch({ type: 'GO_STEP', n: DRAFT_STAGE_STEP[s] })}
                    className="mono"
                    style={{ fontSize: 10, color: 'var(--blueprint)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                  >
                    Review
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Settled: everything claimed. Point at the one layer the AI never drafts.
  return (
    <div style={cardStyle} className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontWeight: 600, fontSize: 12.5, color: 'var(--ink)' }}>Draft claimed ✓</span>
        <button
          type="button"
          onClick={() => dispatch({ type: 'GO_STEP', n: 5 })}
          className="mono"
          style={{ fontSize: 10, color: 'var(--blueprint)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
        >
          Write your conclusion
        </button>
      </div>
    </div>
  )
}

const smallBtn: React.CSSProperties = {
  fontWeight: 600,
  fontSize: 12,
  color: 'var(--ink)',
  background: 'var(--white)',
  border: '1px solid var(--ink)',
  borderRadius: 7,
  padding: '5px 12px',
  cursor: 'pointer',
}
