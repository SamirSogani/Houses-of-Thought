'use client'

// Right rail — Co-pilot tab. Live suggestions for the active layer only, powered
// by POST /api/ai/suggest (Groq). The model returns findings; the user clicks Add
// to dispatch APPLY_AI_ACTION — nothing enters the house without that click
// (invariant 2). See plans/active/ai/03-suggest-and-copilot.md.

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Action, AiMode, State } from '@/lib/build/types'
import type { Finding, FindingKind } from '@/lib/ai/findings'
import { RATE_LIMITED_CODE, RATE_LIMITED_COPY } from '@/lib/ai/findings'
import { layers } from '@/lib/build/content'
import { serializeContent } from '@/lib/build/persistence'
import { PlusIcon, SparkIcon } from '../buildIcons'
import { InterviewCard } from './InterviewCard'

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

export function CopilotPanel({
  state,
  dispatch,
  draftCard,
}: {
  state: State
  dispatch: React.Dispatch<Action>
  // Draft Mode card (decision 016), rendered below the interviewer. Created in
  // BuildHousePage so its stage loop survives this panel unmounting.
  draftCard?: React.ReactNode
}) {
  const kicker = layers[state.step - 1].kicker
  const step = state.step
  // The model fills every rendering, so switching mode only re-renders the
  // cached findings — no refetch (deps below are step-only).
  const mode = state.mode

  // Cache keyed step → { findings, hash }, so moving between layers (or back)
  // doesn't refetch. Lives across step changes but resets when the panel unmounts
  // (tab switch) — deliberate: no fetching while the tab is hidden.
  const cacheRef = useRef<Map<number, { findings: Finding[]; hash: string }>>(new Map())
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
        cacheRef.current.set(targetStep, { findings, hash })
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
      setConsumed(new Set())
      return
    }
    runFetch(step)
    return () => abortRef.current?.abort()
    // Only step drives (re)fetching; typing must not. runFetch reads live state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  const stale = fetchState.status === 'success' && fetchState.hash !== liveHash

  return (
    <div className="fade-in">
      {/* Intro tile */}
      <div style={{ background: 'var(--parchment)', border: '1px solid var(--rule)', borderRadius: 11, padding: 13, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <span style={{ width: 26, height: 26, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'var(--ink)', borderRadius: 8, flex: '0 0 auto' }}>
          <SparkIcon size={14} fill="var(--amber)" />
        </span>
        <div>
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>Co-pilot · {kicker}</div>
          <div style={{ fontSize: 12, color: 'var(--ink-subtle)', marginTop: 3, lineHeight: 1.45 }}>
            Suggestions for this layer only. It guides. You decide what enters the house.
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <InterviewCard state={state} dispatch={dispatch} />
        {draftCard}
      </div>

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
          mode={mode}
          onAdd={(finding, idx) => {
            if (finding.action) dispatch({ type: 'APPLY_AI_ACTION', action: finding.action })
            setConsumed((prev) => new Set(prev).add(idx))
          }}
        />
      )}
    </div>
  )
}

function FindingList({
  findings,
  consumed,
  mode,
  onAdd,
}: {
  findings: Finding[]
  consumed: Set<number>
  mode: AiMode
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
        <FindingCard key={idx} finding={f} mode={mode} onAdd={() => onAdd(f, idx)} />
      ))}
    </div>
  )
}

function FindingCard({ finding, mode, onAdd }: { finding: Finding; mode: AiMode; onAdd: () => void }) {
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
      {mode === 'learn' ? (
        // Learn rendering: the Socratic question only — no suggestion, no Add.
        <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.5 }}>{finding.question}</div>
      ) : (
        // Decide rendering: observation + suggestion.
        <>
          <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.45 }}>{finding.observation}</div>
          <div style={{ fontSize: 12, color: 'var(--ink-subtle)', lineHeight: 1.45, marginTop: 5 }}>{finding.suggestion}</div>
        </>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 11 }}>
        <span className="mono" style={{ fontSize: 9, color: 'var(--ink-subtle)' }}>{KIND_LABEL[finding.kind]}</span>
        {mode === 'decide' && finding.action && (
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
