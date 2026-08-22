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

import { aiActionApplicable } from '@/lib/build/aiActions'
import type { State } from '@/lib/build/types'
import type { AiAction } from '@/lib/ai/findings'
import { DRAFT_STAGE_STEP, type DraftStage } from '@/lib/ai/draft'
import { layerKey } from '@/lib/build/content'
import type { ConsoleTurn, RerunProposal } from '@/lib/ai/console'

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
}) {
  return (
    <>
      {turns.map((t) => {
        if (t.role === 'system') {
          return (
            <div key={t.id} style={{ textAlign: 'center', fontSize: 11.5, color: 'var(--ink-subtle)', padding: '4px 0' }}>
              {t.message}
            </div>
          )
        }
        return (
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
