'use client'

// Post-pipeline console (plan doc
// plans/active/reasoning-pipeline/28-post-pipeline-console.md) — a dedicated
// page (/build/[id]/console), entered deliberately once a reasoning-pipeline
// run is done. Whole-house chatbot: ask a question, or point out a mistake,
// and it answers — proposing add_*/remove_* actions (click-to-accept, same
// invariant as everywhere else) for local corrections, or a rerun proposal
// for foundational ones. A rerun only ever executes after the person
// explicitly confirms it (Confirm rerun button below) — never from a chat
// reply alone.

import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import Link from 'next/link'
import { reducer } from '@/lib/build/state'
import type { State } from '@/lib/build/types'
import { serializeContent, saveHouse } from '@/lib/build/persistence'
import { aiActionApplicable } from '@/lib/build/aiActions'
import type { AiAction } from '@/lib/ai/findings'
import { RATE_LIMITED_CODE, RATE_LIMITED_COPY } from '@/lib/ai/findings'
import { DRAFT_STAGE_STEP, type DraftStage } from '@/lib/ai/draft'
import { layerKey } from '@/lib/build/content'
import {
  CONSOLE_MESSAGE_MAX,
  cascadeStages,
  type ConsoleTurn,
  type RerunProposal,
} from '@/lib/ai/console'
import { useReasoningPipelineRunner } from '../useReasoningPipelineRunner'
import { ReasoningStagesList, type RunState } from '@/components/admin/reasoning/ReasoningStagesList'
import { ContextGatherAnswerBox } from '@/components/admin/reasoning/ContextGatherAnswerBox'
import { EvidenceGatherAnswerBox } from '@/components/admin/reasoning/EvidenceGatherAnswerBox'
import { createClient } from '@/lib/supabase/client'

const ACTION_KIND_LABEL: Partial<Record<AiAction['kind'], string>> = {
  add_concept: 'Add concept',
  add_perspective: 'Add perspective',
  add_subquestion: 'Add sub-question',
  add_perspective_evidence: 'Add evidence',
  add_counter: 'Add counter',
  add_assumption: 'Add assumption',
  add_implication: 'Add implication',
  add_watchpoint: 'Add watchpoint',
  add_evidence: 'Add evidence',
  remove_concept: 'Remove concept',
  remove_perspective: 'Remove perspective',
  remove_subquestion: 'Remove sub-question',
  remove_perspective_evidence: 'Remove evidence',
  remove_counter: 'Remove counter',
  remove_assumption: 'Remove assumption',
  remove_implication: 'Remove implication',
  remove_watchpoint: 'Remove watchpoint',
  remove_evidence: 'Remove evidence',
}

function summarizeAction(action: AiAction): string {
  switch (action.kind) {
    case 'add_concept':
    case 'remove_concept':
      return action.term
    case 'add_perspective':
    case 'remove_perspective':
      return action.name
    case 'add_subquestion':
    case 'remove_subquestion':
      return action.q
    default:
      return 'text' in action ? action.text : ''
  }
}

function stageLabel(stage: DraftStage): string {
  return layerKey(DRAFT_STAGE_STEP[stage])
}

interface PersistedRun {
  runId: string
  originalQuery: string
  status: string
  lastStep: string
  runState: RunState
}

type LoadState = 'loading' | 'loaded' | 'error'
type SendState = 'idle' | 'sending' | 'error' | 'rate-limited'

export function ConsolePage({ houseId, initialState }: { houseId: string; initialState: State }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const [turns, setTurns] = useState<ConsoleTurn[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [persistedRun, setPersistedRun] = useState<PersistedRun | null>(null)
  const [draft, setDraft] = useState('')
  const [sendState, setSendState] = useState<SendState>('idle')
  const [added, setAdded] = useState<Set<string>>(new Set())
  const [confirmingRerun, setConfirmingRerun] = useState<{ turnId: string; proposal: RerunProposal } | null>(null)
  const revRef = useRef<string | undefined>(undefined)
  const stateRef = useRef(state)
  stateRef.current = state
  const scrollRef = useRef<HTMLDivElement>(null)

  const runner = useReasoningPipelineRunner(dispatch, houseId)

  // Persist any accepted action or a finished rerun — this page has no
  // canvas/autosave loop of its own (BuildHousePage's), so it saves
  // explicitly right after each change lands, same rev-token contract as
  // everywhere else (lib/build/persistence.ts's saveHouse).
  const save = useCallback(async () => {
    const supabase = createClient()
    revRef.current = await saveHouse(supabase, houseId, stateRef.current, revRef.current)
  }, [houseId])

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const [transcriptRes, runRes] = await Promise.all([
          fetch(`/api/houses/${houseId}/console`),
          fetch(`/api/houses/${houseId}/reasoning`),
        ])
        if (!active) return
        if (!transcriptRes.ok) {
          setLoadState('error')
          return
        }
        const { turns: loadedTurns } = (await transcriptRes.json()) as { turns: ConsoleTurn[] }
        setTurns(loadedTurns)
        if (runRes.ok) {
          const { run } = (await runRes.json()) as { run: PersistedRun | null }
          setPersistedRun(run)
        }
        setLoadState('loaded')
      } catch {
        if (active) setLoadState('error')
      }
    })()
    return () => {
      active = false
    }
  }, [houseId])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [turns, confirmingRerun, runner.phase])

  // A finished rerun already dispatched APPLY_RERUN_RESULT (the hook itself,
  // on nextStep === null) — save what landed, refresh the persisted run so a
  // second rerun later resumes from THIS one's output, and clear the
  // confirmation card.
  useEffect(() => {
    if (runner.phase !== 'done') return
    setConfirmingRerun(null)
    void save()
    fetch(`/api/houses/${houseId}/reasoning`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { run: PersistedRun | null } | null) => {
        if (data?.run) setPersistedRun(data.run)
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runner.phase])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    const message = draft.trim()
    if (!message || sendState === 'sending') return
    setSendState('sending')
    const optimisticId = `optimistic-${Date.now()}`
    setTurns((prev) => [
      ...prev,
      { id: optimisticId, role: 'user', message, actions: null, rerunProposal: null, createdAt: new Date().toISOString() },
    ])
    setDraft('')
    try {
      const res = await fetch(`/api/houses/${houseId}/console`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ house: JSON.parse(serializeContent(state)), message }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        setSendState(body.error === RATE_LIMITED_CODE ? 'rate-limited' : 'error')
        return
      }
      const { turn } = (await res.json()) as { turn: ConsoleTurn }
      setTurns((prev) => [...prev, turn])
      setSendState('idle')
    } catch {
      setSendState('error')
    }
  }

  function handleAdd(turnId: string, idx: number, action: AiAction) {
    const key = `${turnId}:${idx}`
    if (!aiActionApplicable(state, action)) {
      dispatch({ type: 'SET_TOAST', value: 'That no longer applies here.' })
      setAdded((prev) => new Set(prev).add(key))
      return
    }
    dispatch({ type: 'APPLY_AI_ACTION', action })
    setAdded((prev) => new Set(prev).add(key))
    void save()
  }

  function handleConfirmRerun() {
    if (!confirmingRerun || !persistedRun) return
    const { proposal } = confirmingRerun
    runner.rerunFrom(persistedRun.runState, proposal.stage, proposal.reason, proposal.guidance)
  }

  const rerunActive = runner.phase !== 'idle'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--parchment)', display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '14px 20px',
          borderBottom: '1px solid var(--rule)',
          background: 'var(--white)',
        }}
      >
        <Link href={`/build/${houseId}`} style={{ fontSize: 13, color: 'var(--blueprint)', textDecoration: 'none', fontWeight: 600 }}>
          ‹ Back to house
        </Link>
        <span style={{ color: 'var(--rule)' }}>·</span>
        <span style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 600 }}>Full console</span>
      </header>

      <div style={{ flex: '1 1 auto', maxWidth: 720, width: '100%', margin: '0 auto', padding: '24px 20px', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ fontSize: 13, color: 'var(--ink-subtle)', lineHeight: 1.5, marginBottom: 16 }}>
          Ask about the house, or point out what it got wrong. Proposed changes are click-to-accept, same as
          everywhere else — nothing here writes to the house on its own, including a stage rerun, which only
          happens once you confirm it.
        </div>

        <div ref={scrollRef} style={{ flex: '1 1 auto', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 12 }}>
          {loadState === 'loading' && <div style={{ fontSize: 13, color: 'var(--ink-subtle)' }}>Loading…</div>}
          {loadState === 'error' && <div style={{ fontSize: 13, color: 'var(--ink)' }}>Couldn&apos;t load this conversation.</div>}
          {loadState === 'loaded' && turns.length === 0 && (
            <div style={{ fontSize: 13, color: 'var(--ink-subtle)', lineHeight: 1.5 }}>
              Ask why something is here, what it means, or say what it got wrong.
            </div>
          )}
          {turns.map((t) => (
            <div key={t.id}>
              <div
                style={{
                  fontSize: 13.5,
                  color: 'var(--ink)',
                  lineHeight: 1.55,
                  background: t.role === 'user' ? 'transparent' : 'var(--white)',
                  border: t.role === 'user' ? 'none' : '1px solid var(--rule)',
                  borderRadius: t.role === 'user' ? 0 : 10,
                  padding: t.role === 'user' ? 0 : '10px 13px',
                  fontWeight: t.role === 'user' ? 600 : 400,
                }}
              >
                {t.message}
              </div>

              {t.actions && t.actions.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                  {t.actions.map((a, idx) => {
                    const key = `${t.id}:${idx}`
                    const done = added.has(key)
                    return (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 10,
                          fontSize: 12.5,
                          border: '1px solid var(--amber)',
                          background: 'var(--amber-tint)',
                          borderRadius: 8,
                          padding: '7px 10px',
                          opacity: done ? 0.55 : 1,
                        }}
                      >
                        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <span className="mono" style={{ color: 'var(--ink-subtle)', marginRight: 7 }}>
                            {ACTION_KIND_LABEL[a.kind] ?? a.kind}
                          </span>
                          {summarizeAction(a)}
                        </span>
                        <button
                          type="button"
                          disabled={done}
                          onClick={() => handleAdd(t.id, idx, a)}
                          style={{
                            flex: '0 0 auto',
                            fontWeight: 600,
                            fontSize: 11.5,
                            color: 'var(--ink)',
                            background: 'var(--white)',
                            border: '1px solid var(--ink)',
                            borderRadius: 6,
                            padding: '4px 10px',
                            cursor: done ? 'default' : 'pointer',
                          }}
                        >
                          {done ? 'Done' : 'Apply'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}

              {t.rerunProposal && (
                <div style={{ marginTop: 8, border: '1px solid var(--amber)', borderRadius: 10, padding: '10px 13px', background: 'var(--amber-tint)' }}>
                  <div style={{ fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.5 }}>
                    <strong>Suggests redoing {stageLabel(t.rerunProposal.stage)}</strong> — {t.rerunProposal.reason}
                  </div>
                  {!persistedRun && (
                    <div style={{ fontSize: 11.5, color: 'var(--ink-subtle)', marginTop: 6 }}>
                      No saved pipeline run found for this house — a rerun needs one.
                    </div>
                  )}
                  {persistedRun && confirmingRerun?.turnId !== t.id && (
                    <button
                      type="button"
                      disabled={rerunActive}
                      onClick={() => setConfirmingRerun({ turnId: t.id, proposal: t.rerunProposal! })}
                      style={{
                        marginTop: 8,
                        fontWeight: 600,
                        fontSize: 12,
                        color: 'var(--ink)',
                        background: 'var(--white)',
                        border: '1px solid var(--ink)',
                        borderRadius: 6,
                        padding: '5px 11px',
                        cursor: rerunActive ? 'default' : 'pointer',
                        opacity: rerunActive ? 0.5 : 1,
                      }}
                    >
                      Preview this rerun
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}

          {confirmingRerun && (
            <div style={{ border: '1px solid var(--ink)', borderRadius: 11, padding: 14 }} className="fade-in">
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>Confirm rerun</div>
              <div style={{ fontSize: 12.5, color: 'var(--ink)', marginTop: 6, lineHeight: 1.5 }}>
                This will regenerate, in order:
              </div>
              <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                {cascadeStages(confirmingRerun.proposal.stage).map((s) => (
                  <li key={s} style={{ fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.6 }}>
                    {stageLabel(s)}
                    {state.draft?.claimed[s] ? ' — already claimed, will be reset' : ''}
                  </li>
                ))}
              </ul>
              <div style={{ fontSize: 11.5, color: 'var(--ink-subtle)', marginTop: 8, lineHeight: 1.5 }}>
                Anything you&apos;ve edited by hand in those layers is replaced, not merged. Layers before this
                point are untouched.
              </div>

              {!rerunActive && (
                <div style={{ display: 'flex', gap: 8, marginTop: 11 }}>
                  <button
                    type="button"
                    onClick={handleConfirmRerun}
                    style={{ fontWeight: 600, fontSize: 12, color: 'var(--ink)', background: 'var(--amber-tint)', border: '1px solid var(--amber)', borderRadius: 7, padding: '6px 13px', cursor: 'pointer' }}
                  >
                    Confirm rerun
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingRerun(null)}
                    style={{ fontWeight: 600, fontSize: 12, color: 'var(--ink-subtle)', background: 'none', border: '1px solid var(--rule)', borderRadius: 7, padding: '6px 13px', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                </div>
              )}

              {rerunActive && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontWeight: 600, fontSize: 12.5, color: 'var(--ink)', marginBottom: 8 }}>
                    {runner.phase === 'running'
                      ? 'Reasoning…'
                      : runner.phase === 'halted'
                        ? 'Halted'
                        : runner.phase === 'awaiting-input'
                          ? 'Clarification needed'
                          : runner.phase === 'done'
                            ? 'Done — review the reset layers in the house'
                            : 'Paused'}
                  </div>
                  <ReasoningStagesList run={runner.run} currentStep={runner.step} running={runner.phase === 'running'} />

                  {runner.phase === 'awaiting-input' && runner.pendingGather && (
                    <ContextGatherAnswerBox
                      verdict={runner.pendingGather.verdict}
                      onSubmit={runner.resolvePendingGather}
                      onSkip={runner.skipPendingGather}
                    />
                  )}
                  {runner.phase === 'awaiting-input' && runner.pendingEvidenceGather && (
                    <EvidenceGatherAnswerBox
                      units={runner.pendingEvidenceGather.units}
                      onSubmit={runner.resolvePendingEvidenceGather}
                      onSkip={runner.skipPendingEvidenceGather}
                    />
                  )}

                  {runner.errorCode && (
                    <div style={{ fontSize: 12, color: 'var(--ink)', marginTop: 10, lineHeight: 1.45 }}>
                      {runner.errorCode === RATE_LIMITED_CODE ? RATE_LIMITED_COPY : 'Could not reach the reasoning pipeline.'}
                    </div>
                  )}
                  {runner.haltReason && (
                    <div style={{ fontSize: 12, color: 'var(--ink)', marginTop: 10, lineHeight: 1.45 }}>{runner.haltReason}</div>
                  )}

                  <div style={{ display: 'flex', gap: 8, marginTop: 11 }}>
                    {runner.phase === 'running' && (
                      <button type="button" onClick={runner.pause} style={{ fontWeight: 600, fontSize: 12, color: 'var(--ink)', background: 'var(--white)', border: '1px solid var(--ink)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>
                        Pause
                      </button>
                    )}
                    {runner.phase === 'paused' && (
                      <button type="button" onClick={runner.resume} style={{ fontWeight: 600, fontSize: 12, color: 'var(--ink)', background: 'var(--white)', border: '1px solid var(--ink)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>
                        {runner.errorCode ? 'Retry' : 'Resume'}
                      </button>
                    )}
                    {(runner.phase === 'halted' || runner.phase === 'done') && (
                      <button
                        type="button"
                        onClick={() => {
                          runner.reset()
                          setConfirmingRerun(null)
                        }}
                        style={{ fontWeight: 600, fontSize: 12, color: 'var(--ink-subtle)', background: 'none', border: '1px solid var(--rule)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}
                      >
                        Close
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {sendState === 'rate-limited' && (
          <div style={{ fontSize: 12, color: 'var(--ink)', marginBottom: 8, lineHeight: 1.45 }}>{RATE_LIMITED_COPY}</div>
        )}
        {sendState === 'error' && (
          <div style={{ fontSize: 12, color: 'var(--ink)', marginBottom: 8, lineHeight: 1.45 }}>Couldn&apos;t reach the co-pilot — try again.</div>
        )}

        <form onSubmit={handleSend} style={{ display: 'flex', gap: 10 }}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, CONSOLE_MESSAGE_MAX))}
            placeholder="Ask about the house, or say what it got wrong…"
            aria-label="Message the co-pilot"
            style={{ flex: 1, height: 42, padding: '0 13px', fontSize: 14, color: 'var(--ink)', background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 8, outline: 'none' }}
          />
          <button
            type="submit"
            disabled={sendState === 'sending' || draft.trim().length === 0}
            style={{
              fontWeight: 600,
              fontSize: 13,
              color: 'var(--ink)',
              background: 'var(--amber-tint)',
              border: '1px solid var(--amber)',
              borderRadius: 8,
              padding: '0 18px',
              cursor: 'pointer',
              opacity: sendState === 'sending' ? 0.6 : 1,
            }}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  )
}
