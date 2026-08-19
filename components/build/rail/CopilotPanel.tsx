'use client'

// Right rail — Co-pilot tab. Live suggestions for the active layer only, powered
// by POST /api/ai/suggest (Groq). The model returns findings; the user clicks Add
// to dispatch APPLY_AI_ACTION — nothing enters the house without that click
// (invariant 2). See plans/active/ai/03-suggest-and-copilot.md.

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type { Action, State } from '@/lib/build/types'
import type { Finding, FindingKind } from '@/lib/ai/findings'
import { RATE_LIMITED_CODE, RATE_LIMITED_COPY } from '@/lib/ai/findings'
import { layers } from '@/lib/build/content'
import { aiActionApplicable } from '@/lib/build/aiActions'
import { serializeContent } from '@/lib/build/persistence'
import { PlusIcon } from '../buildIcons'
import { InterviewCard, useInterviewSession, type InterviewSession } from './InterviewCard'
import { houseIsBlank } from './DraftCard'
import { ReasoningPipelineCard, ReasoningConclusionSuggestion } from './ReasoningPipelineCard'
import type { ReasoningPipelineRunner } from '../useReasoningPipelineRunner'

// snake_case finding kind → the mono tag shown on each card.
const KIND_LABEL: Record<FindingKind, string> = {
  framing: 'Framing',
  vague_concept: 'Concept',
  missing_perspective: 'Perspective',
  weak_perspective: 'Perspective',
  missing_evidence: 'Evidence',
  single_source: 'Evidence',
  hidden_assumption: 'Assumption',
  load_bearing: 'Assumption',
  conclusion_gap: 'Conclusion',
  unexamined_implication: 'Implication',
}

// Cheap, stable content fingerprint (djb2) so we can tell "the house changed since
// this fetch" without diffing — protects tokens while the user types.
function hashString(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i)
  return (h >>> 0).toString(36)
}

type FetchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; code: string }
  | { status: 'success'; findings: Finding[]; hash: string }

// Suggestion cache, keyed by step. Owned by BuildHousePage (like the draft
// runner) so tab switches and the mobile drawer don't discard it — every
// discard used to refetch on remount, and suggest is the biggest per-student
// cost driver (~15–30 calls per assignment walk before this). `consumed` (the
// indexes the user Added) lives in the entry so a step revisit doesn't re-offer
// already-added cards for a second, duplicate Add (bl-M1).
export type SuggestCache = Map<number, { findings: Finding[]; hash: string; consumed: number[] }>

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

  // Cache keyed step → { findings, hash }, so moving between layers (or back),
  // switching tabs, or closing the mobile drawer doesn't refetch (the ref lives
  // in BuildHousePage when provided). Refresh is the explicit refetch path.
  const localCacheRef = useRef<SuggestCache>(new Map())
  const cacheRef = suggestCache ?? localCacheRef
  // Hoisted interview session, same fallback pattern as the suggest cache above
  // — the panel still works if ever rendered standalone, without BuildHousePage.
  const localInterview = useInterviewSession()
  const interviewSession = interview ?? localInterview
  const abortRef = useRef<AbortController | null>(null)

  const [fetchState, setFetchState] = useState<FetchState>({ status: 'idle' })
  // Findings the user has Added this session are hidden; keyed by array index of
  // the currently-shown findings, reset whenever the finding set changes.
  const [consumed, setConsumed] = useState<Set<number>>(new Set())

  // Live fingerprint of the persistable house — recomputed each render so a
  // "house changed" hint can appear as the user types, without refetching.
  const liveHash = hashString(serializeContent(state))

  const runFetch = useCallback(
    async (targetStep: number) => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      const content = serializeContent(state)
      const hash = hashString(content)
      setFetchState({ status: 'loading' })
      setConsumed(new Set())

      try {
        const res = await fetch('/api/ai/suggest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ house: JSON.parse(content), step: targetStep, mode: state.mode }),
          signal: controller.signal,
        })
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string }
          setFetchState({ status: 'error', code: body.error ?? 'ai-upstream-error' })
          return
        }
        const { findings } = (await res.json()) as { findings: Finding[] }
        cacheRef.current.set(targetStep, { findings, hash, consumed: [] })
        setFetchState({ status: 'success', findings, hash })
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return
        setFetchState({ status: 'error', code: 'ai-network-error' })
      }
    },
    [state]
  )

  // Auto-fetch on mount / step change: serve cache if present, else fetch once.
  useEffect(() => {
    const cached = cacheRef.current.get(step)
    if (cached) {
      setFetchState({ status: 'success', findings: cached.findings, hash: cached.hash })
      // Restore what was already Added — a revisit must not re-offer it (bl-M1).
      setConsumed(new Set(cached.consumed))
      return
    }
    runFetch(step)
    return () => abortRef.current?.abort()
    // Only step drives (re)fetching; typing must not. runFetch reads live state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  const stale = fetchState.status === 'success' && fetchState.hash !== liveHash

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
            onClick={() => runFetch(step)}
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
            onClick={() => runFetch(step)}
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
                onClick={() => runFetch(step)}
                style={{ marginTop: 10, fontWeight: 600, fontSize: 12, color: 'var(--ink)', background: 'var(--white)', border: '1px solid var(--ink)', borderRadius: 6, padding: '5px 13px', cursor: 'pointer' }}
              >
                Retry
              </button>
            </>
          )}
        </div>
      )}

      {fetchState.status === 'success' && (
        <FindingList
          findings={fetchState.findings}
          consumed={consumed}
          restrictAuthorship={restrictAuthorship}
          onAdd={(finding, idx) => {
            // A stale card (its target deleted/renamed since the fetch, or the
            // item already added) used to vanish silently while adding nothing
            // (bl-M2). Say so and KEEP the card unconsumed.
            if (finding.action && !aiActionApplicable(state, finding.action)) {
              dispatch({ type: 'SET_TOAST', value: 'That suggestion no longer applies here.' })
              return
            }
            if (finding.action) dispatch({ type: 'APPLY_AI_ACTION', action: finding.action })
            setConsumed((prev) => new Set(prev).add(idx))
            const entry = cacheRef.current.get(step)
            if (entry && !entry.consumed.includes(idx)) entry.consumed.push(idx)
          }}
        />
      )}
    </div>
  )
}

function FindingList({
  findings,
  consumed,
  restrictAuthorship,
  onAdd,
}: {
  findings: Finding[]
  consumed: Set<number>
  restrictAuthorship: boolean
  onAdd: (finding: Finding, idx: number) => void
}) {
  const visible = findings.map((f, idx) => ({ f, idx })).filter(({ idx }) => !consumed.has(idx))

  if (visible.length === 0) {
    return (
      <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--ink-subtle)', padding: '20px 0', lineHeight: 1.5 }}>
        No open suggestions for this layer. Refresh once you&apos;ve made changes.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {visible.map(({ f, idx }) => (
        <FindingCard key={idx} finding={f} restrictAuthorship={restrictAuthorship} onAdd={() => onAdd(f, idx)} />
      ))}
    </div>
  )
}

// Declutter item 3: always show the Socratic question AND the concrete
// observation/suggestion — the model already fills all three on every finding
// regardless of mode (lib/ai/findings.ts), so this was always a rendering
// choice, never a data one. The Add button follows finding.action (null when
// the model's move is "think", not "add") AND !restrictAuthorship — a
// coach-posture account (student, or a standard account's own assignment
// submission) sees the same question and suggestion text as anyone else, just
// never the one-click insert (lib/auth/capabilities.ts's "never get author
// output").
function FindingCard({
  finding,
  restrictAuthorship,
  onAdd,
}: {
  finding: Finding
  restrictAuthorship: boolean
  onAdd: () => void
}) {
  const important = finding.severity === 'important'
  return (
    <div
      className="pop"
      style={{
        border: '1px solid var(--rule)',
        borderLeft: important ? '3px solid var(--amber)' : '1px solid var(--rule)',
        borderRadius: 11,
        padding: 13,
      }}
    >
      <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.5 }}>{finding.question}</div>
      <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.45, marginTop: 8 }}>{finding.observation}</div>
      <div style={{ fontSize: 12, color: 'var(--ink-subtle)', lineHeight: 1.45, marginTop: 5 }}>{finding.suggestion}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 11 }}>
        <span className="mono" style={{ fontSize: 9, color: 'var(--ink-subtle)' }}>{KIND_LABEL[finding.kind]}</span>
        {finding.action && !restrictAuthorship && (
          <button
            type="button"
            onClick={onAdd}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 600, fontSize: 12, color: 'var(--ink)', background: 'var(--amber-tint)', border: '1px solid var(--amber)', borderRadius: 6, padding: '5px 11px', cursor: 'pointer' }}
          >
            <PlusIcon size={12} />
            Add
          </button>
        )}
      </div>
    </div>
  )
}

function SkeletonCards() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ border: '1px solid var(--rule)', borderRadius: 11, padding: 13, opacity: 0.6 }}>
          <div style={{ height: 11, background: 'var(--rule)', borderRadius: 4, width: '92%' }} />
          <div style={{ height: 11, background: 'var(--rule)', borderRadius: 4, width: '70%', marginTop: 7 }} />
          <div style={{ height: 9, background: 'var(--parchment)', borderRadius: 4, width: '40%', marginTop: 12 }} />
        </div>
      ))}
    </div>
  )
}
