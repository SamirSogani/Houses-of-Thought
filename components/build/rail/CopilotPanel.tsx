'use client'

// Right rail — Co-pilot tab. Live suggestions for the active layer only, powered
// by POST /api/ai/suggest (Groq). The model returns findings; the user clicks Add
// to dispatch APPLY_AI_ACTION — nothing enters the house without that click
// (invariant 2). See plans/active/ai/03-suggest-and-copilot.md.

import Link from 'next/link'
import type { Action, State } from '@/lib/build/types'
import { RATE_LIMITED_CODE, RATE_LIMITED_COPY } from '@/lib/ai/findings'
import { layers } from '@/lib/build/content'
import { InterviewCard, useInterviewSession, type InterviewSession } from './InterviewCard'
import { houseIsBlank } from './DraftCard'
import { ReasoningPipelineCard, ReasoningConclusionSuggestion } from './ReasoningPipelineCard'
import type { ReasoningPipelineRunner } from '../useReasoningPipelineRunner'
import { useSuggestions, type SuggestCache } from './useSuggestions'
import { FindingList, SkeletonCards } from './FindingCards'

// The suggestion fetch/cache/consumed logic and the cards moved to
// useSuggestions.ts and FindingCards.tsx (phase 2) so the Overview tab can
// show the same suggestions. Re-exported so existing importers keep working.
export type { SuggestCache }

export function CopilotPanel({
  state,
  dispatch,
  draftCard,
  suggestCache,
  interview,
  pipelineRunner,
  restrictAuthorship = false,
  houseId,
}: {
  state: State
  dispatch: React.Dispatch<Action>
  // Draft Mode card (decision 016), rendered below the interviewer. Created in
  // BuildHousePage so its stage loop survives this panel unmounting.
  draftCard?: React.ReactNode
  // Hoisted cache (see SuggestCache above). Optional so the panel still works
  // standalone; without it the cache dies with the panel.
  suggestCache?: React.RefObject<SuggestCache>
  // Hoisted interview session — same rationale: the transcript must survive
  // this panel unmounting (mobile drawer close, tab switch).
  interview?: InterviewSession
  // House-scoped reasoning pipeline's runner (plan doc 27), hoisted in
  // BuildHousePage for the same survives-unmounting reason as draftRunner/
  // interview above. Undefined when there's no houseId to scope it to (the
  // localStorage /house builder) — the consolidated entry point below falls
  // back to the old interview+draft offer in that case.
  pipelineRunner?: ReasoningPipelineRunner
  // lib/auth/capabilities.ts: aiPosture 'coach' (students) is documented as
  // "Socratic/withholding only... never get author output" (decision 007).
  // Declutter item 3 made every FindingCard always show its question AND its
  // observation/suggestion (previously mode-gated) — but the Add button must
  // stay gated on this, not on mode, or a coach-posture account gets a
  // one-click way to insert AI-authored content the product decision
  // explicitly withholds from them. Sourced from BuildHousePage's existing
  // `modeLocked` (true for students, and for a standard account's own
  // assignment submission — both cases the codebase already treats as
  // Learn-only elsewhere, so this reuses that signal rather than adding a
  // second, possibly-drifting one).
  restrictAuthorship?: boolean
  // Post-pipeline console entry point (plan doc 28) — scopes the "Continue
  // in full console" link below. Undefined on the localStorage /house
  // builder, same gate as pipelineRunner above (no houseId, no console to
  // link to).
  houseId?: string
}) {
  const kicker = layers[state.step - 1].kicker
  const step = state.step

  // Suggestions for the focused layer: fetch, per-step cache (the ref lives in
  // BuildHousePage when provided), Added/Skipped bookkeeping. Refresh is the
  // explicit refetch path.
  const { fetchState, visible, stale, refresh, add, skip } = useSuggestions({ state, dispatch, step, suggestCache })
  // Hoisted interview session, same fallback pattern as the suggest cache — the
  // panel still works if ever rendered standalone, without BuildHousePage.
  const localInterview = useInterviewSession()
  const interviewSession = interview ?? localInterview

  // Consolidated blank-house entry point (declutter item 1). draftCard mirrors
  // BuildHousePage's canDraft (it's `canDraft ? <DraftCard .../> : null`), so
  // checking it here keeps this in sync with that gate without needing it
  // threaded down separately. Once state.draft exists (the runner has been
  // kicked off — including automatically, see BuildHousePage) this always
  // falls through to the unchanged branch below, where DraftCard's own
  // progress/review UI takes over exactly as it did before this change.
  const showConsolidatedEntry = houseIsBlank(state) && !state.draft && draftCard != null

  return (
    <div className="fade-in">
      {/* Intro caption — was a bordered icon+title+description tile; that
          announced "this is Co-pilot" redundantly under a rail tab already
          labeled Co-pilot, and cost real vertical space on every layer. Now
          a single caption line, styled like "Suggested for this layer"
          below. */}
      <div className="mono" style={{ fontSize: 10, color: 'var(--ink-subtle)', letterSpacing: '0.04em' }}>
        Co-pilot · {kicker}
      </div>

      <div style={{ marginTop: 12 }}>
        {showConsolidatedEntry && pipelineRunner ? (
          // The real thing (plan doc 27): starts an actual pipeline run
          // against POST /api/houses/[id]/reasoning, not the old
          // interview→draft handoff. Falls through to the branch below once
          // final-composition lands and APPLY_REASONING_RESULT flips the
          // house out of "blank" — see ReasoningPipelineCard's own comment.
          <ReasoningPipelineCard state={state} dispatch={dispatch} runner={pipelineRunner} />
        ) : (
          // No pipelineRunner (e.g. the localStorage /house builder, which has
          // no houseId to scope a run to, or a non-blank house) — the
          // pre-pipeline interview+draft path stays available exactly as it
          // was.
          <>
            <InterviewCard state={state} dispatch={dispatch} session={interviewSession} />
            {draftCard}
          </>
        )}
      </div>

      {pipelineRunner && <ReasoningConclusionSuggestion state={state} dispatch={dispatch} runner={pipelineRunner} />}

      {/* Post-pipeline console entry (plan doc 28) — once the pipeline has
          actually finished (state.draft.via is only ever set once
          APPLY_REASONING_RESULT lands, never mid-run). Deliberately a plain
          link, not another card — this rail's own intro tile already went
          from a box to a one-line caption for taking up space it didn't
          need; this shouldn't reintroduce that. */}
      {houseId && state.draft?.via === 'reasoning-pipeline' && (
        <Link
          href={`/build/${houseId}/console`}
          className="mono"
          style={{
            display: 'block',
            marginBottom: 16,
            fontSize: 10,
            letterSpacing: '0.04em',
            color: 'var(--blueprint)',
            textDecoration: 'none',
          }}
        >
          Continue in full console →
        </Link>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '2px 0 10px' }}>
        <span className="mono" style={{ fontSize: 10, color: 'var(--ink-subtle)' }}>Suggested for this layer</span>
        {fetchState.status !== 'loading' && (
          <button
            type="button"
            onClick={refresh}
            className="mono"
            style={{ fontSize: 10, color: 'var(--blueprint)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            Refresh
          </button>
        )}
      </div>

      {stale && (
        <div style={{ fontSize: 12, color: 'var(--ink-subtle)', marginBottom: 10, lineHeight: 1.45 }}>
          House changed —{' '}
          <button
            type="button"
            onClick={refresh}
            style={{ color: 'var(--blueprint)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit', textDecoration: 'underline' }}
          >
            refresh suggestions
          </button>
        </div>
      )}

      {fetchState.status === 'loading' && <SkeletonCards />}

      {fetchState.status === 'error' && (
        <div style={{ textAlign: 'center', padding: '18px 0' }}>
          {fetchState.code === RATE_LIMITED_CODE ? (
            <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.5 }}>{RATE_LIMITED_COPY}</div>
          ) : (
            <>
              <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.5 }}>Couldn&apos;t reach the co-pilot.</div>
              <button
                type="button"
                onClick={refresh}
                style={{ marginTop: 10, fontWeight: 600, fontSize: 12, color: 'var(--ink)', background: 'var(--white)', border: '1px solid var(--ink)', borderRadius: 6, padding: '5px 13px', cursor: 'pointer' }}
              >
                Retry
              </button>
            </>
          )}
        </div>
      )}

      {fetchState.status === 'success' && (
        <FindingList items={visible} restrictAuthorship={restrictAuthorship} onAdd={add} onSkip={skip} />
      )}
    </div>
  )
}
