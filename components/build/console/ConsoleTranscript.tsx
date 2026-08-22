'use client'

// Turn rendering for the console (plan doc
// plans/active/reasoning-pipeline/29-console-multi-chat.md's "File splits
// this forces"): the message list, proposed-action chips, the rerun-proposal
// card's "Preview this rerun" trigger, and per-message "Branch from here".
// RerunPanel (its own file) renders the confirm/progress card itself once
// ConsolePage opens it.
//
// Bug fix (doc 29 "Two bugs found while planning" #2): a chip's applied
// state now renders from aiActionApplicable(state, action) — which already
// knows whether the target exists/was already added — rather than trusting
// only the ephemeral `added` Set. That Set (owned by ConsolePage, passed in)
// still exists, but purely for the optimistic flash right after a click;
// without this fix, a forked chat showed its inherited actions as live
// offers even when the parent had already applied them (doc 29's open
// question on fork + pending actions, answered: inherited but rendered
// applied).
//
// "Branch from here" renders as an always-visible small link rather than a
// strict hover-only reveal — doc 29 calls it a "hover action," but this
// repo's build UI has no hover-reveal precedent (CopilotPanel/ConsolePage's
// own buttons are always visible) and hover has no equivalent on touch, so a
// permanent, muted link matches both the surrounding style and mobile.
//
// Loop A, bounded revise (plan doc
// plans/active/reasoning-pipeline/30-console-subagent-loops.md): every
// VISIBLE assistant turn (one groupRevisionChains, lib/ai/console.ts, does
// not mark as superseded by a later revision) gets a "Revise this answer"
// control. A completed chain's earlier links are never deleted — they
// collapse under an "N earlier attempts" disclosure rendered at the HEAD
// turn's own chronological position, each with its stored critique shown on
// expand ("a loop whose inside the person cannot see is a loop they cannot
// check," doc 30). The actual POST/turns-list update lives in ConsolePage
// (onRevise prop) — this file only owns the per-turn open/closed textbox and
// the disclosure's own open/closed state, same split as ChatSidebar's local
// rename-box state one level up.

import { useState } from 'react'
import { aiActionApplicable } from '@/lib/build/aiActions'
import type { State } from '@/lib/build/types'
import type { AiAction } from '@/lib/ai/findings'
import { DRAFT_STAGE_STEP, type DraftStage } from '@/lib/ai/draft'
import { layerKey } from '@/lib/build/content'
import {
  CONSOLE_MESSAGE_MAX,
  MAX_REVISE_ITERATIONS,
  groupRevisionChains,
  revisionCapReached,
  type ConsoleTurn,
  type ReviseCritique,
  type RerunProposal,
} from '@/lib/ai/console'

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

const REVISE_STANDARD_ROWS: { id: keyof ReviseCritique['standards']; label: string }[] = [
  { id: 'clarity', label: 'Clarity' },
  { id: 'relevance', label: 'Relevance' },
  { id: 'depth', label: 'Depth' },
]

// The critic-role verdict stored on a revision row — "the critique text is
// stored ... and shown on expand" (doc 30). Only revision rows ever carry
// one (the original, unrevised answer's critique is null).
function CritiqueDetail({ critique }: { critique: ReviseCritique }) {
  return (
    <div style={{ marginTop: 6, padding: '8px 10px', background: 'var(--parchment)', border: '1px solid var(--rule)', borderRadius: 8 }}>
      {REVISE_STANDARD_ROWS.map((r) => (
        <div key={r.id} style={{ fontSize: 11, color: 'var(--ink-subtle)', lineHeight: 1.5, marginBottom: 3 }}>
          <span className="mono" style={{ color: 'var(--ink)', fontWeight: 600, marginRight: 6 }}>
            {r.label} {critique.standards[r.id].pass ? '✓' : '✗'}
          </span>
          {critique.standards[r.id].note}
        </div>
      ))}
      <div style={{ fontSize: 11, color: 'var(--ink)', lineHeight: 1.5, marginTop: 4, fontStyle: 'italic' }}>
        {critique.guidance}
      </div>
    </div>
  )
}

// "Earlier attempts collapse under a disclosure rather than vanishing" (doc
// 30) — rendered at the HEAD turn's own chronological position (see
// groupRevisionChains, lib/ai/console.ts), oldest first, each with its own
// stored critique shown on expand.
function EarlierAttempts({ earlier }: { earlier: ConsoleTurn[] }) {
  const [open, setOpen] = useState(false)
  if (earlier.length === 0) return null
  return (
    <div style={{ marginBottom: 8 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="mono"
        style={{ fontSize: 10.5, color: 'var(--ink-subtle)', letterSpacing: '0.02em', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
      >
        {open ? '▾' : '▸'} {earlier.length} earlier attempt{earlier.length === 1 ? '' : 's'}
      </button>
      {open && (
        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {earlier.map((e) => (
            <div key={e.id} style={{ opacity: 0.7 }}>
              <div
                style={{
                  fontSize: 13,
                  color: 'var(--ink)',
                  lineHeight: 1.55,
                  background: 'var(--white)',
                  border: '1px solid var(--rule)',
                  borderRadius: 10,
                  padding: '9px 12px',
                }}
              >
                {e.message}
              </div>
              {e.critique && <CritiqueDetail critique={e.critique} />}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// The per-turn "Revise this answer" trigger + its inline instruction box.
// Deliberately does not close itself or clear its draft on submit: a
// successful revision makes THIS turn superseded (groupRevisionChains), so
// the whole control unmounts on its own next render; a failed one leaves the
// box open with the draft intact so the person can just retry.
function ReviseControl({
  turn,
  onRevise,
  busy,
  error,
}: {
  turn: ConsoleTurn
  onRevise: (turnId: string, instruction: string) => void
  busy: boolean
  error: string | null
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')

  if (revisionCapReached(turn.revisionIteration)) {
    return (
      <div className="mono" style={{ marginTop: 5, fontSize: 10.5, color: 'var(--ink-subtle)', letterSpacing: '0.02em' }}>
        {MAX_REVISE_ITERATIONS} revisions reached for this answer
      </div>
    )
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mono"
        style={{ marginTop: 5, fontSize: 10.5, color: 'var(--ink-subtle)', letterSpacing: '0.02em', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
      >
        Revise this answer
      </button>
    )
  }

  return (
    <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value.slice(0, CONSOLE_MESSAGE_MAX))}
        placeholder="What should change? e.g. shorter, or you missed…"
        aria-label="Revision instruction"
        disabled={busy}
        style={{ fontSize: 12.5, padding: '6px 9px', border: '1px solid var(--ink)', borderRadius: 6, outline: 'none' }}
      />
      {error && <div style={{ fontSize: 11, color: 'var(--ink)', lineHeight: 1.4 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          disabled={busy || draft.trim().length === 0}
          onClick={() => onRevise(turn.id, draft.trim())}
          style={{
            fontWeight: 600,
            fontSize: 11.5,
            color: 'var(--ink)',
            background: 'var(--amber-tint)',
            border: '1px solid var(--amber)',
            borderRadius: 6,
            padding: '4px 10px',
            cursor: busy ? 'default' : 'pointer',
            opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? 'Revising…' : 'Revise'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setOpen(false)}
          style={{ fontWeight: 600, fontSize: 11.5, color: 'var(--ink-subtle)', background: 'none', border: '1px solid var(--rule)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

export function ConsoleTranscript({
  turns,
  state,
  added,
  onAdd,
  hasPersistedRun,
  confirmingTurnId,
  rerunActive,
  onPreviewRerun,
  onBranchFromMessage,
  branchingMessageId,
  onRevise,
  revisingMessageId,
  reviseError,
}: {
  turns: ConsoleTurn[]
  state: State
  added: Set<string>
  onAdd: (turnId: string, idx: number, action: AiAction) => void
  hasPersistedRun: boolean
  confirmingTurnId: string | null
  rerunActive: boolean
  onPreviewRerun: (turnId: string, proposal: RerunProposal) => void
  onBranchFromMessage: (messageId: string) => void
  branchingMessageId: string | null
  // Loop A (doc 30) — onRevise mirrors onBranchFromMessage's own shape:
  // ConsolePage owns the actual POST + turns-list update, this component
  // only ever asks for it. revisingMessageId disables every OTHER turn's
  // control while one request is in flight (same posture as
  // branchingMessageId); reviseError is the last failed attempt, shown only
  // next to the turn it belongs to.
  onRevise: (turnId: string, instruction: string) => void
  revisingMessageId: string | null
  reviseError: { turnId: string; message: string } | null
}) {
  // Loop A's collapse grouping (doc 30) — turns that some LATER turn
  // revises are hidden from their own chronological spot and folded into
  // the disclosure rendered at their chain's head instead.
  const chainGroups = groupRevisionChains(turns)
  const hiddenIds = new Set(chainGroups.flatMap((g) => g.earlierIds))
  const earlierByHead = new Map(chainGroups.map((g) => [g.headId, g.earlierIds]))
  const byId = new Map(turns.map((t) => [t.id, t]))

  return (
    <>
      {turns.map((t) => {
        if (hiddenIds.has(t.id)) return null
        if (t.role === 'system') {
          return (
            <div key={t.id} style={{ textAlign: 'center', fontSize: 11.5, color: 'var(--ink-subtle)', padding: '4px 0' }}>
              {t.message}
            </div>
          )
        }
        const earlierIds = earlierByHead.get(t.id)
        return (
          <div key={t.id}>
            {earlierIds && earlierIds.length > 0 && (
              <EarlierAttempts earlier={earlierIds.map((id) => byId.get(id)).filter((e): e is ConsoleTurn => Boolean(e))} />
            )}
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
                  // Bug fix #2 — see module header comment.
                  const done = added.has(key) || !aiActionApplicable(state, a)
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
                        onClick={() => onAdd(t.id, idx, a)}
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
                {!hasPersistedRun && (
                  <div style={{ fontSize: 11.5, color: 'var(--ink-subtle)', marginTop: 6 }}>
                    No saved pipeline run found for this house — a rerun needs one.
                  </div>
                )}
                {hasPersistedRun && confirmingTurnId !== t.id && (
                  <button
                    type="button"
                    disabled={rerunActive}
                    onClick={() => onPreviewRerun(t.id, t.rerunProposal!)}
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

            {t.role === 'assistant' && (
              <ReviseControl
                turn={t}
                onRevise={onRevise}
                busy={revisingMessageId === t.id}
                error={reviseError?.turnId === t.id ? reviseError.message : null}
              />
            )}

            <button
              type="button"
              disabled={branchingMessageId !== null}
              onClick={() => onBranchFromMessage(t.id)}
              className="mono"
              style={{
                marginTop: 5,
                fontSize: 10.5,
                color: 'var(--ink-subtle)',
                letterSpacing: '0.02em',
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: branchingMessageId !== null ? 'default' : 'pointer',
                opacity: branchingMessageId === t.id ? 0.6 : 1,
              }}
            >
              {branchingMessageId === t.id ? 'Branching…' : 'Branch from here'}
            </button>
          </div>
        )
      })}
    </>
  )
}
