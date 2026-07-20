'use client'

// House Chat's live build card (decision 017). One card = one house: it owns
// its own reducer instance, drives the SAME stage loop as the builder rail
// (useDraftRunner), and persists through saveHouse — a chat build and a rail
// draft are literally the same machinery, so the claim gate, provenance marks,
// and provisional strength all apply unchanged when the house opens in
// /build/[id]. Cards stay mounted in the transcript after settling; only the
// newest card may fire stage calls (enabled) — an older stopped build resumes
// in the builder.

import { useEffect, useReducer, useRef, useState } from 'react'
import Link from 'next/link'
import { reducer } from '@/lib/build/state'
import type { State } from '@/lib/build/types'
import { createClient } from '@/lib/supabase/client'
import {
  SaveError,
  saveHouse,
  serializeContent,
  type SaveErrorCode,
} from '@/lib/build/persistence'
import {
  DRAFT_STAGES,
  DRAFT_STAGE_LABELS,
  unclaimedDraftStages,
  type DraftStage,
} from '@/lib/ai/draft'
import { RATE_LIMITED_CODE, RATE_LIMITED_COPY } from '@/lib/ai/findings'
import type { ConclusionCandidate } from '@/lib/ai/chat'
import { useDraftRunner } from '@/components/build/useDraftRunner'
import { CheckIcon } from '@/components/icons'

// Noun labels for settled rows; the in-progress row uses DRAFT_STAGE_LABELS so
// the running copy matches the builder rail exactly.
const STAGE_NOUNS: Record<DraftStage, string> = {
  concepts: 'Key concepts',
  perspectives: 'Perspectives',
  evidence: 'Cited evidence',
  assumptions: 'Hidden assumptions',
  implications: 'Implications and watchpoints',
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}

// Real counts from live reducer state — every item in a chat house is drafted,
// so raw lengths are the drafted counts.
function stageCount(state: State, stage: DraftStage): string {
  switch (stage) {
    case 'concepts':
      return plural(state.concepts.length, 'concept')
    case 'perspectives': {
      const subs = state.perspectives.reduce((sum, p) => sum + p.subQuestions.length, 0)
      const base = plural(state.perspectives.length, 'perspective')
      return subs > 0 ? `${base} + ${plural(subs, 'sub-question')}` : base
    }
    case 'evidence':
      return plural(state.evidence.length, 'source')
    case 'assumptions':
      return plural(state.assumptions.length, 'assumption')
    case 'implications': {
      const n = state.pos.length + state.neg.length + state.unc.length
      const base = plural(n, 'implication')
      return state.watchpoints.length > 0
        ? `${base} + ${plural(state.watchpoints.length, 'watchpoint')}`
        : base
    }
  }
}

export interface BuildSettle {
  drafted: boolean
  // True when conclusion candidates were requested and their fetch has settled —
  // the parent's hand-off copy points at the card instead of the builder.
  conclusions: boolean
}

const IMPLICATION_GLYPH: Record<ConclusionCandidate['implications'][number]['ikind'], { glyph: string; color: string }> = {
  pos: { glyph: '+', color: 'var(--green-text)' },
  neg: { glyph: '−', color: 'var(--warning-text)' },
  unc: { glyph: '?', color: 'var(--ink-subtle)' },
}

const cardStyle: React.CSSProperties = {
  background: 'var(--white)',
  border: '1px solid var(--rule)',
  borderRadius: 11,
  padding: '14px 16px',
}

const mono: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  letterSpacing: '0.06em',
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

const builderLink: React.CSSProperties = {
  fontWeight: 600,
  fontSize: 12,
  color: 'var(--ink)',
  background: 'var(--amber-tint)',
  border: '1px solid var(--amber)',
  borderRadius: 7,
  padding: '6px 13px',
  textDecoration: 'none',
  display: 'inline-block',
}

export function ChatBuildCard({
  houseId,
  initial,
  initialRev,
  enabled,
  concludeRequested,
  onSettled,
}: {
  houseId: string
  initial: State
  initialRev: string
  enabled: boolean
  // Decision 018 toggle, captured per question at build start: when true, the
  // card fetches conclusion candidates after the material stages settle.
  concludeRequested: boolean
  onSettled: (r: BuildSettle) => void
}) {
  const [state, dispatch] = useReducer(reducer, initial)
  const runner = useDraftRunner(state, dispatch, enabled, houseId)

  const stateRef = useRef(state)
  stateRef.current = state

  // ── autosave: simplified from BuildHousePage's controller — single-flight
  // with a trailing queued save, no backoff. The first save fires immediately
  // (the freshly inserted row holds only owner_id; this persists question,
  // aiContext, and the armed draft before the first stage call returns).
  const [saveCode, setSaveCode] = useState<'saving' | 'saved' | SaveErrorCode>('saving')
  const revRef = useRef(initialRev)
  const savingRef = useRef(false)
  const queuedRef = useRef(false)
  const savedKeyRef = useRef('')
  const contentKey = serializeContent(state)

  async function runSave() {
    if (savingRef.current) {
      queuedRef.current = true
      return
    }
    savingRef.current = true
    setSaveCode('saving')
    try {
      const key = serializeContent(stateRef.current)
      revRef.current = await saveHouse(createClient(), houseId, stateRef.current, revRef.current)
      savedKeyRef.current = key
      setSaveCode('saved')
    } catch (err) {
      setSaveCode(err instanceof SaveError ? err.code : 'save-failed')
    } finally {
      savingRef.current = false
      if (queuedRef.current) {
        queuedRef.current = false
        void runSave()
      }
    }
  }
  const runSaveRef = useRef(runSave)
  runSaveRef.current = runSave

  useEffect(() => {
    const t = setTimeout(() => void runSaveRef.current(), savedKeyRef.current ? 800 : 0)
    return () => clearTimeout(t)
  }, [contentKey])

  // Flush on unmount: client-side navigation keeps the JS context alive, so a
  // fired save completes even as the card disappears.
  useEffect(() => {
    return () => {
      if (serializeContent(stateRef.current) !== savedKeyRef.current) void runSaveRef.current()
    }
  }, [])

  // ── auto-start (decision 017): the build begins the moment the card mounts;
  // Stop is always visible while it runs.
  const startedRef = useRef(false)
  useEffect(() => {
    if (startedRef.current || !enabled) return
    startedRef.current = true
    if (stateRef.current.draft && stateRef.current.draft.stage !== 'done') runner.start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])

  // ── conclusion candidates (decision 018). Fetched once the material stages
  // settle, kept in component state: the transcript is ephemeral, so persisting
  // candidates buys nothing — only an ADOPTED conclusion persists, via ordinary
  // reducer actions and autosave.
  const [candidates, setCandidates] = useState<ConclusionCandidate[] | null>(null)
  const [conclInFlight, setConclInFlight] = useState(false)
  const [conclError, setConclError] = useState<string | null>(null)
  const [adopted, setAdopted] = useState<number | null>(null)

  async function runConclusions(notify: boolean) {
    setConclError(null)
    setConclInFlight(true)
    try {
      const s = stateRef.current
      const res = await fetch('/api/admin/chat-conclusions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ house: JSON.parse(serializeContent(s)), aiContext: s.aiContext }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        setConclError(body.error ?? 'ai-upstream-error')
      } else {
        const data = (await res.json()) as { candidates: ConclusionCandidate[] }
        setCandidates(data.candidates)
      }
    } catch {
      setConclError('ai-network-error')
    } finally {
      setConclInFlight(false)
      // The composer unlocks only now, so the drafter lane never runs two
      // builds' calls at once. Adoption needs no lane and can happen any time.
      if (notify) onSettledRef.current({ drafted: true, conclusions: true })
    }
  }
  const runConclusionsRef = useRef(runConclusions)
  runConclusionsRef.current = runConclusions

  // Adoption is a human click composed entirely of existing reducer actions —
  // the candidate's implications land through the same applyAiAction path (and
  // provenance marks) as every other AI item. One-shot: switching verdicts
  // afterwards belongs in the builder, where editing is first-class.
  function adopt(i: number) {
    const c = candidates?.[i]
    if (!c || adopted !== null) return
    dispatch({ type: 'SET_CONCLUSION', value: c.conclusion })
    dispatch({ type: 'SET_REASONING', value: c.reasoning })
    for (const imp of c.implications) {
      dispatch({
        type: 'APPLY_AI_ACTION',
        action: { kind: 'add_implication', ikind: imp.ikind, text: imp.text, horizon: imp.horizon, who: imp.who },
      })
    }
    setAdopted(i)
  }

  // Tell the transcript once when the build settles (finished or stopped);
  // when candidates were requested, the hand-off waits for their fetch.
  const settledRef = useRef(false)
  const onSettledRef = useRef(onSettled)
  onSettledRef.current = onSettled
  const stage = state.draft?.stage ?? 'done'
  useEffect(() => {
    if (settledRef.current || stage !== 'done') return
    settledRef.current = true
    const drafted = DRAFT_STAGES.some((s) => stateRef.current.draft?.drafted[s])
    if (!concludeRequested || !drafted) {
      onSettledRef.current({ drafted, conclusions: false })
      return
    }
    void runConclusionsRef.current(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage])

  const draft = state.draft
  if (!draft) return null

  const saveLine =
    saveCode === 'saving' ? (
      <span style={{ ...mono, color: 'var(--ink-subtle)' }}>Saving…</span>
    ) : saveCode === 'saved' ? (
      <span style={{ ...mono, color: 'var(--ink-subtle)' }}>Saved</span>
    ) : saveCode === 'stale-write' ? (
      <span style={{ ...mono, color: 'var(--warning-text)' }}>Edited elsewhere — open the builder for the latest</span>
    ) : saveCode === 'signed-out' ? (
      <span style={{ ...mono, color: 'var(--warning-text)' }}>Signed out — log in again to save</span>
    ) : (
      <span style={{ ...mono, color: 'var(--warning-text)' }}>
        Save failed ·{' '}
        <button
          type="button"
          onClick={() => void runSave()}
          style={{ ...mono, color: 'var(--blueprint)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
        >
          Retry
        </button>
      </span>
    )

  // ── live build (or paused / errored mid-way).
  if (draft.stage !== 'done') {
    const currentIdx = DRAFT_STAGES.indexOf(draft.stage)
    return (
      <div style={cardStyle} className="fade-in">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--ink)' }}>
            {runner.running ? 'Building your house…' : 'Build paused'}
          </span>
          <span style={{ ...mono, color: 'var(--ink-subtle)' }}>
            {currentIdx}/{DRAFT_STAGES.length}
          </span>
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--ink-subtle)', marginTop: 3, lineHeight: 1.45 }}>
          {state.question}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 11 }}>
          {DRAFT_STAGES.map((s, i) => {
            const done = i < currentIdx
            const current = i === currentIdx
            return (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: i > currentIdx ? 0.55 : 1 }}>
                <span style={{ width: 16, display: 'inline-flex', justifyContent: 'center', flex: '0 0 auto' }}>
                  {done ? (
                    <CheckIcon size={14} />
                  ) : current && runner.running ? (
                    <span className="mini-spinner" aria-hidden="true" />
                  ) : (
                    <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--rule)' }} />
                  )}
                </span>
                <span style={{ flex: 1, fontSize: 12.5, lineHeight: 1.4, color: done || current ? 'var(--ink)' : 'var(--ink-subtle)' }}>
                  {current ? DRAFT_STAGE_LABELS[s] : STAGE_NOUNS[s]}
                </span>
                {done && draft.drafted[s] && (
                  <span style={{ fontSize: 11.5, color: 'var(--ink-subtle)', flex: '0 0 auto' }}>{stageCount(state, s)}</span>
                )}
              </div>
            )
          })}
        </div>

        {runner.errorCode && (
          <div style={{ fontSize: 12, color: 'var(--ink)', marginTop: 10, lineHeight: 1.45 }}>
            {runner.errorCode === RATE_LIMITED_CODE
              ? RATE_LIMITED_COPY
              : runner.errorCode === 'unauthenticated'
                ? 'Signed out — log in again to keep building.'
                : runner.errorCode === 'draft-not-available'
                  ? 'Draft Mode isn’t available on this account.'
                  : runner.errorCode === 'ai-network-error'
                    ? 'Network hiccup — check your connection and retry.'
                    : 'Could not reach the co-pilot.'}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
          {enabled ? (
            <>
              <button type="button" onClick={runner.running ? runner.pause : runner.start} style={smallBtn}>
                {runner.running ? 'Pause' : runner.errorCode ? 'Retry' : 'Resume'}
              </button>
              <button
                type="button"
                onClick={runner.stop}
                style={{ ...smallBtn, borderColor: 'var(--rule)', color: 'var(--ink-subtle)' }}
              >
                Stop here
              </button>
            </>
          ) : (
            <Link href={`/build/${houseId}`} style={builderLink}>
              Resume in the builder
            </Link>
          )}
          <span style={{ marginLeft: 'auto' }}>{saveLine}</span>
        </div>
      </div>
    )
  }

  // ── settled: finished or stopped.
  const draftedStages = DRAFT_STAGES.filter((s) => draft.drafted[s])
  const unclaimed = unclaimedDraftStages(draft)

  if (draftedStages.length === 0) {
    return (
      <div style={cardStyle} className="fade-in">
        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>Build stopped</span>
        <div style={{ fontSize: 12.5, color: 'var(--ink-subtle)', marginTop: 3, lineHeight: 1.45 }}>
          Nothing was drafted — open the house to build it by hand.
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 11 }}>
          <Link href={`/build/${houseId}`} style={builderLink}>
            Open in builder
          </Link>
          <span style={{ marginLeft: 'auto' }}>{saveLine}</span>
        </div>
      </div>
    )
  }

  return (
    <div style={cardStyle} className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontWeight: 600, fontSize: 13.5, color: 'var(--ink)' }}>
          <CheckIcon size={14} /> House built
        </span>
        {unclaimed.length > 0 && (
          <span style={{ ...mono, color: 'var(--amber-text)', textTransform: 'uppercase' }}>
            {unclaimed.length} {unclaimed.length === 1 ? 'layer' : 'layers'} to claim
          </span>
        )}
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--ink-subtle)', marginTop: 3, lineHeight: 1.45 }}>
        {state.question}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 11 }}>
        {draftedStages.map((s) => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 16, display: 'inline-flex', justifyContent: 'center', flex: '0 0 auto' }}>
              <CheckIcon size={14} />
            </span>
            <span style={{ flex: 1, fontSize: 12.5, color: 'var(--ink)' }}>{STAGE_NOUNS[s]}</span>
            <span style={{ fontSize: 11.5, color: 'var(--ink-subtle)', flex: '0 0 auto' }}>{stageCount(state, s)}</span>
          </div>
        ))}
      </div>

      {concludeRequested && (
        <div style={{ marginTop: 12, paddingTop: 11, borderTop: '1px solid var(--rule)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>Conclusion candidates</span>
            {conclInFlight && <span className="mini-spinner" aria-hidden="true" />}
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-subtle)', marginTop: 3, lineHeight: 1.45 }}>
            {conclInFlight
              ? 'Weighing everything in the house — every layer, every datapoint…'
              : adopted !== null
                ? 'Adopted. The verdict is yours now — refine it in the builder.'
                : 'Drafted from everything in the house, and they disagree on purpose. Adopt one — or write your own in the builder.'}
          </div>

          {conclError && (
            <div style={{ fontSize: 12, color: 'var(--ink)', marginTop: 8, lineHeight: 1.45 }}>
              {conclError === RATE_LIMITED_CODE ? (
                RATE_LIMITED_COPY
              ) : (
                <>
                  Could not draft candidates.{' '}
                  {enabled && (
                    <button
                      type="button"
                      onClick={() => void runConclusions(false)}
                      style={{ color: 'var(--blueprint)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit', textDecoration: 'underline' }}
                    >
                      Retry
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {candidates && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
              {candidates.map((c, i) => {
                const isAdopted = adopted === i
                const dimmed = adopted !== null && !isAdopted
                return (
                  <div
                    key={i}
                    style={{
                      border: `1px solid ${isAdopted ? 'var(--amber)' : 'var(--rule)'}`,
                      borderRadius: 9,
                      padding: '10px 12px',
                      opacity: dimmed ? 0.55 : 1,
                      background: isAdopted ? 'var(--amber-tint)' : 'var(--white)',
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.5 }}>{c.conclusion}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--ink-subtle)', marginTop: 6, lineHeight: 1.5 }}>{c.reasoning}</div>
                    <div style={{ ...mono, color: 'var(--ink-subtle)', marginTop: 7, lineHeight: 1.6 }}>
                      Grounded in: {c.basis.join(' · ')}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
                      {c.implications.map((imp, j) => (
                        <div key={j} style={{ display: 'flex', gap: 7, fontSize: 12, lineHeight: 1.45 }}>
                          <span style={{ color: IMPLICATION_GLYPH[imp.ikind].color, fontWeight: 600, flex: '0 0 auto', width: 10, textAlign: 'center' }}>
                            {IMPLICATION_GLYPH[imp.ikind].glyph}
                          </span>
                          <span style={{ flex: 1, color: 'var(--ink)' }}>{imp.text}</span>
                          <span style={{ ...mono, color: 'var(--ink-subtle)', flex: '0 0 auto' }}>
                            {imp.horizon} · {imp.who}
                          </span>
                        </div>
                      ))}
                    </div>
                    {adopted === null ? (
                      <button type="button" onClick={() => adopt(i)} style={{ ...smallBtn, marginTop: 9, background: 'var(--amber-tint)', borderColor: 'var(--amber)' }}>
                        Adopt this conclusion
                      </button>
                    ) : isAdopted ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 9, fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>
                        <CheckIcon size={13} /> Adopted — implications added to the house
                      </span>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, paddingTop: 11, borderTop: '1px solid var(--rule)' }}>
        <Link href={`/build/${houseId}`} style={builderLink}>
          Open in builder
        </Link>
        <span style={{ fontSize: 11.5, color: 'var(--ink-subtle)', lineHeight: 1.4 }}>
          Strength stays provisional until every layer is claimed
        </span>
        <span style={{ marginLeft: 'auto', flex: '0 0 auto' }}>{saveLine}</span>
      </div>
    </div>
  )
}
