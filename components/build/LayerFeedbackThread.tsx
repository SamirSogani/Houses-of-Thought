'use client'

// Post-draft Q&A/correction thread (migration 0039; GET/POST
// /api/houses/[id]/layer-feedback). Mounted from DraftClaimBanner for any
// layer the co-pilot has drafted, claimed or not — a person often notices a
// mistake, or realizes the co-pilot lacked some context, well after the
// initial claim. Collapsed to a single line by default and only fetches once
// expanded — this must not become another always-open box competing with the
// layer content it's commenting on (see the rail intro tile's own decluttering,
// components/build/rail/CopilotPanel.tsx).
//
// A reply may carry proposed actions (AiAction[], same vocabulary Draft Mode
// and Suggest already use) — rendered as small Add chips, never applied
// automatically (invariant 2: nothing enters the house without an explicit
// click). The model cannot edit or remove an existing item itself; if
// something already there is wrong, its reply says so in plain text and the
// person removes it by hand via that layer's own controls, same as reviewing
// any other drafted content.

import { useCallback, useEffect, useState } from 'react'
import type { Action, State } from '@/lib/build/types'
import type { AiAction } from '@/lib/ai/findings'
import { RATE_LIMITED_CODE, RATE_LIMITED_COPY } from '@/lib/ai/findings'
import type { DraftStage } from '@/lib/ai/draft'
import { serializeContent } from '@/lib/build/persistence'
import { aiActionApplicable } from '@/lib/build/aiActions'
import { LAYER_FEEDBACK_MESSAGE_MAX, type LayerFeedbackTurn } from '@/lib/ai/layerFeedback'
import { ChevronRight } from './buildIcons'

const ACTION_KIND_LABEL: Partial<Record<AiAction['kind'], string>> = {
  add_concept: 'Concept',
  add_perspective: 'Perspective',
  add_subquestion: 'Sub-question',
  add_perspective_evidence: 'Evidence',
  add_counter: 'Counter',
  add_assumption: 'Assumption',
  add_implication: 'Implication',
  add_watchpoint: 'Watchpoint',
  add_evidence: 'Evidence',
}

// A short, human-readable summary of what an action would add — the fields
// differ per kind (findings.ts's AiActionSchema), so there's no single field
// to just print.
function summarizeAction(action: AiAction): string {
  switch (action.kind) {
    case 'add_concept':
      return `${action.term} — ${action.definition}`
    case 'add_perspective':
      return action.name
    case 'add_subquestion':
      return action.q
    case 'add_perspective_evidence':
      return action.text
    case 'add_counter':
      return action.text
    case 'add_assumption':
      return action.text
    case 'add_implication':
      return action.text
    case 'add_watchpoint':
      return action.text
    case 'add_evidence':
      return action.text
    default:
      return ''
  }
}

type LoadState = 'idle' | 'loading' | 'loaded' | 'error'
type SendState = 'idle' | 'sending' | 'error' | 'rate-limited'

export function LayerFeedbackThread({
  state,
  dispatch,
  houseId,
  stage,
}: {
  state: State
  dispatch: React.Dispatch<Action>
  houseId: string
  stage: DraftStage
}) {
  const [expanded, setExpanded] = useState(false)
  const [loadState, setLoadState] = useState<LoadState>('idle')
  const [turns, setTurns] = useState<LayerFeedbackTurn[]>([])
  const [draft, setDraft] = useState('')
  const [sendState, setSendState] = useState<SendState>('idle')
  // Which (turnId, actionIndex) pairs have been Added this session, so a
  // clicked chip can't be double-added on a re-render.
  const [added, setAdded] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    setLoadState('loading')
    try {
      const res = await fetch(`/api/houses/${houseId}/layer-feedback?stage=${stage}`)
      if (!res.ok) {
        setLoadState('error')
        return
      }
      const { turns: loaded } = (await res.json()) as { turns: LayerFeedbackTurn[] }
      setTurns(loaded)
      setLoadState('loaded')
    } catch {
      setLoadState('error')
    }
  }, [houseId, stage])

  useEffect(() => {
    if (expanded && loadState === 'idle') load()
  }, [expanded, loadState, load])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    const message = draft.trim()
    if (!message || sendState === 'sending') return
    setSendState('sending')
    // Optimistic: show the person's own message immediately, same as
    // TeamMessageThread — the reply lands a moment later.
    const optimisticId = `optimistic-${Date.now()}`
    setTurns((prev) => [...prev, { id: optimisticId, role: 'user', message, actions: null, createdAt: new Date().toISOString() }])
    setDraft('')
    try {
      const res = await fetch(`/api/houses/${houseId}/layer-feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ house: JSON.parse(serializeContent(state)), stage, message }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        setSendState(body.error === RATE_LIMITED_CODE ? 'rate-limited' : 'error')
        return
      }
      const { turn } = (await res.json()) as { turn: LayerFeedbackTurn }
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
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="mono"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          marginTop: 10,
          fontSize: 10,
          letterSpacing: '0.04em',
          color: 'var(--ink-subtle)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
        }}
      >
        <ChevronRight size={10} />
        Ask the co-pilot about this layer
      </button>
    )
  }

  return (
    <div className="fade-in" style={{ marginTop: 12, border: '1px solid var(--rule)', borderRadius: 11, padding: 13 }}>
      <button
        type="button"
        onClick={() => setExpanded(false)}
        className="mono"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          fontSize: 10,
          letterSpacing: '0.04em',
          color: 'var(--ink-subtle)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
        }}
      >
        <span style={{ display: 'inline-flex', transform: 'rotate(90deg)' }}>
          <ChevronRight size={10} />
        </span>
        Ask the co-pilot about this layer
      </button>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
        {loadState === 'loading' && <div style={{ fontSize: 12, color: 'var(--ink-subtle)' }}>Loading…</div>}
        {loadState === 'error' && (
          <div style={{ fontSize: 12, color: 'var(--ink)' }}>
            Couldn&apos;t load this conversation.{' '}
            <button type="button" onClick={load} style={{ color: 'var(--blueprint)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
              Retry
            </button>
          </div>
        )}
        {loadState === 'loaded' && turns.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--ink-subtle)', lineHeight: 1.45 }}>
            Ask why something is here, or point out what it got wrong.
          </div>
        )}
        {turns.map((t) => (
          <div key={t.id}>
            <div
              style={{
                fontSize: 12.5,
                color: 'var(--ink)',
                lineHeight: 1.5,
                background: t.role === 'user' ? 'transparent' : 'var(--parchment)',
                border: t.role === 'user' ? 'none' : '1px solid var(--rule)',
                borderRadius: t.role === 'user' ? 0 : 8,
                padding: t.role === 'user' ? 0 : '8px 10px',
                fontWeight: t.role === 'user' ? 600 : 400,
              }}
            >
              {t.message}
            </div>
            {t.actions && t.actions.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 6 }}>
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
                        gap: 8,
                        fontSize: 11.5,
                        border: '1px solid var(--amber)',
                        background: 'var(--amber-tint)',
                        borderRadius: 7,
                        padding: '5px 8px',
                        opacity: done ? 0.55 : 1,
                      }}
                    >
                      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <span className="mono" style={{ color: 'var(--ink-subtle)', marginRight: 6 }}>
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
                          fontSize: 11,
                          color: 'var(--ink)',
                          background: 'var(--white)',
                          border: '1px solid var(--ink)',
                          borderRadius: 5,
                          padding: '3px 8px',
                          cursor: done ? 'default' : 'pointer',
                        }}
                      >
                        {done ? 'Added' : 'Add'}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {sendState === 'rate-limited' && (
        <div style={{ fontSize: 12, color: 'var(--ink)', marginTop: 10, lineHeight: 1.45 }}>{RATE_LIMITED_COPY}</div>
      )}
      {sendState === 'error' && (
        <div style={{ fontSize: 12, color: 'var(--ink)', marginTop: 10, lineHeight: 1.45 }}>Couldn&apos;t reach the co-pilot — try again.</div>
      )}

      <form onSubmit={handleSend} style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, LAYER_FEEDBACK_MESSAGE_MAX))}
          placeholder="Ask a question, or say what it got wrong…"
          aria-label="Ask the co-pilot about this layer"
          style={{ flex: 1, height: 36, padding: '0 10px', fontSize: 13, color: 'var(--ink)', background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 7, outline: 'none' }}
        />
        <button
          type="submit"
          disabled={sendState === 'sending' || draft.trim().length === 0}
          style={{
            fontWeight: 600,
            fontSize: 12,
            color: 'var(--ink)',
            background: 'var(--amber-tint)',
            border: '1px solid var(--amber)',
            borderRadius: 7,
            padding: '0 13px',
            cursor: 'pointer',
            opacity: sendState === 'sending' ? 0.6 : 1,
          }}
        >
          Send
        </button>
      </form>
    </div>
  )
}
