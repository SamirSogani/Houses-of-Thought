'use client'

// Right rail — Overview tab (builder-workspace-redesign plan §3). The at-a-
// glance panel of the document view, in three blocks:
//
//   1. House Strength with its three REAL axes (Evidence / Logic / Coverage,
//      weighted 40/35/25 — invariant 6, the score is never altered by
//      presentation), labelled provisional while AI-drafted layers await their
//      claim (decision 016 §2).
//   2. Next steps: a checklist derived from the house — nothing stored. Each
//      row jumps to its layer.
//   3. Co-pilot: the first few open suggestions for the focused layer, with
//      Add / Skip, sharing the Co-pilot tab's fetch and cache (useSuggestions)
//      so switching tabs never refetches.
//
// This replaced the ContextBar strength pill as the score's home; ReviewLayer
// keeps the long-form breakdown ("driving this score", how to strengthen).

import type { Action, State } from '@/lib/build/types'
import type { Strength } from '@/lib/build/strength'
import { layerDone, strengthColor } from '@/lib/build/strength'
import { DRAFT_STAGES, DRAFT_STAGE_STEP, draftGateLocked, unclaimedDraftStages, type DraftStage } from '@/lib/ai/draft'
import { deriveStatus } from '@/lib/build/persistence'
import { RATE_LIMITED_CODE, RATE_LIMITED_COPY } from '@/lib/ai/findings'
import { CheckIcon } from '@/components/icons'
import { ChevronRight } from '../buildIcons'
import { useSuggestions, type SuggestCache } from './useSuggestions'
import { FindingList, SkeletonCards } from './FindingCards'

const mono: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: '0.11em',
}

// How many suggestion cards the Overview shows before pointing at the full tab.
const OVERVIEW_SUGGESTIONS = 3

export function OverviewPanel({
  state,
  strength,
  dispatch,
  suggestCache,
  restrictAuthorship = false,
  onOpenCopilot,
}: {
  state: State
  strength: Strength
  dispatch: React.Dispatch<Action>
  suggestCache?: React.RefObject<SuggestCache>
  // See FindingCards.tsx — gates the Add button, never the text.
  restrictAuthorship?: boolean
  // Switches the rail to the Co-pilot tab ("All suggestions →").
  onOpenCopilot?: () => void
}) {
  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <ScoreCard state={state} strength={strength} onOpenReview={() => dispatch({ type: 'GO_STEP', n: 7 })} />
      <NextSteps state={state} onGo={(n) => dispatch({ type: 'GO_STEP', n })} />
      <OverviewSuggestions state={state} dispatch={dispatch} suggestCache={suggestCache} restrictAuthorship={restrictAuthorship} onOpenCopilot={onOpenCopilot} />
    </div>
  )
}

// ── 1. Score ────────────────────────────────────────────────────────────────

export function ScoreCard({ state, strength, onOpenReview }: { state: State; strength: Strength; onOpenReview?: () => void }) {
  // Untouched house: no number yet, so the first thing a person sees isn't a
  // failing grade on an empty page (ux M6, same rule ContextBar applied).
  const scored = deriveStatus(state) !== 'empty'
  const provisional = draftGateLocked(state.draft)
  const unclaimed = unclaimedDraftStages(state.draft).length
  const col = scored ? strengthColor(strength.overall) : 'var(--ink-subtle)'

  const axes: { name: string; score: number }[] = [
    { name: 'Evidence', score: strength.evidence },
    { name: 'Logic', score: strength.logic },
    { name: 'Coverage', score: strength.coverage },
  ]

  return (
    <div
      style={{
        background: 'var(--white)',
        border: provisional ? '1px dashed var(--amber)' : '1px solid var(--rule)',
        borderRadius: 12,
        padding: '16px 16px 14px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
        <span style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 34, lineHeight: 1, color: col }}>
            {scored ? strength.overall : '—'}
          </span>
          <span style={{ ...mono, color: 'var(--ink-subtle)' }}>{scored ? '/ 100' : 'not scored yet'}</span>
        </span>
        {scored && provisional && (
          <span
            style={{ ...mono, fontSize: 9, color: 'var(--amber-text)', border: '1px solid var(--amber)', borderRadius: 5, padding: '3px 7px' }}
            title="Claim the AI-drafted layers to make this score yours."
          >
            Provisional
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 14 }}>
        {axes.map((a) => {
          const c = scored ? strengthColor(a.score) : 'var(--rule)'
          return (
            <div key={a.name}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 12, color: 'var(--ink-mid)' }}>{a.name}</span>
                <span className="mono" style={{ fontSize: 10, color: scored ? c : 'var(--ink-subtle)' }}>
                  {scored ? `${a.score}%` : '—'}
                </span>
              </div>
              <div style={{ height: 5, background: 'var(--rule-soft)', borderRadius: 3, overflow: 'hidden', marginTop: 5 }}>
                <div
                  className="build-bar-fill"
                  style={{ height: '100%', width: scored ? `${a.score}%` : '0%', background: c, borderRadius: 3, transition: 'width 0.4s cubic-bezier(0.2,0.7,0.2,1)' }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {scored && provisional && (
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--ink-mid)', lineHeight: 1.45 }}>
          <strong style={{ color: 'var(--ink)' }}>Score is provisional.</strong>{' '}
          Claim {unclaimed === 1 ? 'the remaining drafted layer' : `the ${unclaimed} remaining drafted layers`} to make it yours.
        </div>
      )}
      {!scored && (
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--ink-subtle)', lineHeight: 1.45 }}>
          Add content to any layer and the score starts working.
        </div>
      )}
      {scored && onOpenReview && (
        <button
          type="button"
          onClick={onOpenReview}
          className="mono"
          style={{ marginTop: 10, fontSize: 10, letterSpacing: '0.06em', color: 'var(--blueprint)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          Full breakdown in Review →
        </button>
      )}
    </div>
  )
}

// ── 2. Next steps ───────────────────────────────────────────────────────────

export interface NextStep {
  key: string
  label: string
  done: boolean
  // Layer the row jumps to.
  step: number
}

const STAGE_NOUN: Record<DraftStage, string> = {
  concepts: 'concepts',
  perspectives: 'perspectives',
  evidence: 'evidence',
  assumptions: 'assumptions',
  implications: 'implications',
}

function stageItemCount(state: State, stage: DraftStage): number {
  switch (stage) {
    case 'concepts': return state.concepts.length
    case 'perspectives': return state.perspectives.length
    case 'evidence': return state.evidence.length
    case 'assumptions': return state.assumptions.length
    case 'implications': return state.pos.length + state.neg.length + state.unc.length
  }
}

// Pure: the checklist is a view of the house, never stored. Exported for the
// Overview and for anything else that wants "what's next" (e.g. a dashboard
// chip later).
export function nextSteps(state: State): NextStep[] {
  const rows: NextStep[] = []
  rows.push({
    key: 'frame',
    label: 'Set the question and its purpose',
    done: state.question.trim().length > 0 && state.purpose.trim().length > 0,
    step: 1,
  })
  const draft = state.draft
  if (draft) {
    rows.push({ key: 'draft', label: 'Run the AI draft', done: draft.stage === 'done', step: 1 })
    for (const stage of DRAFT_STAGES) {
      if (!draft.drafted[stage]) continue
      const n = stageItemCount(state, stage)
      rows.push({
        key: `claim-${stage}`,
        label: draft.claimed[stage] ? `Claim ${STAGE_NOUN[stage]}` : `Claim ${STAGE_NOUN[stage]} (${n} unclaimed)`,
        done: draft.claimed[stage],
        step: DRAFT_STAGE_STEP[stage],
      })
    }
  }
  rows.push({
    key: 'conclusion',
    label: 'Write your conclusion',
    done: state.conclusion.trim().length > 0 || state.reasoning.trim().length > 0,
    step: 5,
  })
  // "Review and publish" in the prototype — publish doesn't exist yet, so the
  // row is the honest half: reach a strong score in Review.
  rows.push({ key: 'review', label: 'Review house strength', done: layerDone(7, state), step: 7 })
  return rows
}

function NextSteps({ state, onGo }: { state: State; onGo: (step: number) => void }) {
  const rows = nextSteps(state)
  const remaining = rows.filter((r) => !r.done).length
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ ...mono, color: 'var(--ink-subtle)' }}>Next steps</span>
        <span className="mono" style={{ fontSize: 10, color: 'var(--ink-subtle)' }}>
          {remaining === 0 ? 'all done' : `${remaining} left`}
        </span>
      </div>
      <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, display: 'flex', flexDirection: 'column' }}>
        {rows.map((r) => (
          <li key={r.key}>
            <button
              type="button"
              onClick={() => onGo(r.step)}
              aria-label={`${r.label}${r.done ? ' (done)' : ''} — go to layer`}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 4px',
                background: 'none',
                border: 'none',
                borderBottom: '1px solid var(--rule-soft)',
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 16,
                  height: 16,
                  flex: '0 0 auto',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 4,
                  border: r.done ? 'none' : '1px solid var(--rule)',
                  background: r.done ? 'var(--green-strong)' : 'var(--white)',
                  color: '#fff',
                }}
              >
                {r.done && <CheckIcon size={11} />}
              </span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: r.done ? 'var(--ink-subtle)' : 'var(--ink)', textDecoration: r.done ? 'line-through' : 'none', lineHeight: 1.4 }}>
                {r.label}
              </span>
              {!r.done && <ChevronRight size={12} stroke="var(--ink-subtle)" />}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ── 3. Co-pilot suggestions ────────────────────────────────────────────────

function OverviewSuggestions({
  state,
  dispatch,
  suggestCache,
  restrictAuthorship,
  onOpenCopilot,
}: {
  state: State
  dispatch: React.Dispatch<Action>
  suggestCache?: React.RefObject<SuggestCache>
  restrictAuthorship: boolean
  onOpenCopilot?: () => void
}) {
  const { fetchState, visible, stale, refresh, add, skip } = useSuggestions({ state, dispatch, step: state.step, suggestCache })
  const shown = visible.slice(0, OVERVIEW_SUGGESTIONS)
  const more = visible.length - shown.length

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ ...mono, color: 'var(--ink-subtle)' }}>Co-pilot</span>
        {fetchState.status !== 'loading' && (
          <button
            type="button"
            onClick={refresh}
            className="mono"
            style={{ fontSize: 10, color: 'var(--blueprint)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            {stale ? 'House changed — refresh' : 'Refresh'}
          </button>
        )}
      </div>
      <div style={{ marginTop: 10 }}>
        {fetchState.status === 'loading' && <SkeletonCards count={2} />}
        {fetchState.status === 'error' && (
          <div style={{ fontSize: 12, color: 'var(--ink-mid)', lineHeight: 1.5 }}>
            {fetchState.code === RATE_LIMITED_CODE ? RATE_LIMITED_COPY : (
              <>
                Couldn&apos;t reach the co-pilot.{' '}
                <button type="button" onClick={refresh} style={{ color: 'var(--blueprint)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit', textDecoration: 'underline' }}>
                  Retry
                </button>
              </>
            )}
          </div>
        )}
        {fetchState.status === 'success' && (
          <FindingList items={shown} restrictAuthorship={restrictAuthorship} onAdd={add} onSkip={skip} emptyText="No open suggestions for this layer." />
        )}
        {fetchState.status === 'success' && onOpenCopilot && (
          <button
            type="button"
            onClick={onOpenCopilot}
            className="mono"
            style={{ marginTop: 10, fontSize: 10, letterSpacing: '0.06em', color: 'var(--blueprint)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            {more > 0 ? `${more} more in Co-pilot →` : 'Open Co-pilot →'}
          </button>
        )}
      </div>
    </div>
  )
}
