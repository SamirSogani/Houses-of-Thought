'use client'

// The rerun confirmation card + live progress (plan doc
// plans/active/reasoning-pipeline/29-console-multi-chat.md's "File splits
// this forces" — "the confirm card plus ReasoningStagesList, lifted
// unchanged out of today's file"). Behavior is identical to the block this
// was extracted from in the pre-split ConsolePage.tsx: a confirmed rerun
// cascades through cascadeStages() and only ever executes after this
// explicit confirm click (plan doc 28's invariant), never from a chat reply
// alone.

import { RATE_LIMITED_CODE, RATE_LIMITED_COPY } from '@/lib/ai/findings'
import { DRAFT_STAGE_STEP, type DraftStage } from '@/lib/ai/draft'
import { layerKey } from '@/lib/build/content'
import { cascadeStages, type RerunProposal } from '@/lib/ai/console'
import type { ReasoningPipelineRunner } from '../useReasoningPipelineRunner'
import { ReasoningStagesList } from '@/components/admin/reasoning/ReasoningStagesList'
import { ContextGatherAnswerBox } from '@/components/admin/reasoning/ContextGatherAnswerBox'
import { EvidenceGatherAnswerBox } from '@/components/admin/reasoning/EvidenceGatherAnswerBox'
import type { State } from '@/lib/build/types'

function stageLabel(stage: DraftStage): string {
  return layerKey(DRAFT_STAGE_STEP[stage])
}

export function RerunPanel({
  proposal,
  state,
  runner,
  rerunActive,
  onConfirm,
  onClose,
}: {
  proposal: RerunProposal
  state: State
  runner: ReasoningPipelineRunner
  rerunActive: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <div style={{ border: '1px solid var(--ink)', borderRadius: 11, padding: 14 }} className="fade-in">
      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>Confirm rerun</div>
      <div style={{ fontSize: 12.5, color: 'var(--ink)', marginTop: 6, lineHeight: 1.5 }}>
        This will regenerate, in order:
      </div>
      <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
        {cascadeStages(proposal.stage).map((s) => (
          <li key={s} style={{ fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.6 }}>
            {stageLabel(s)}
            {state.draft?.claimed[s] ? ' — already claimed, will be reset' : ''}
          </li>
        ))}
      </ul>
      <div style={{ fontSize: 11.5, color: 'var(--ink-subtle)', marginTop: 8, lineHeight: 1.5 }}>
        Anything you&apos;ve edited by hand in those layers is replaced, not merged. Layers before this point are
        untouched.
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--ink-subtle)', marginTop: 4, lineHeight: 1.5 }}>
        This changes the house for every chat, not just this one — once it finishes, every active chat gets a note
        that these layers were regenerated.
      </div>

      {!rerunActive && (
        <div style={{ display: 'flex', gap: 8, marginTop: 11 }}>
          <button
            type="button"
            onClick={onConfirm}
            style={{ fontWeight: 600, fontSize: 12, color: 'var(--ink)', background: 'var(--amber-tint)', border: '1px solid var(--amber)', borderRadius: 7, padding: '6px 13px', cursor: 'pointer' }}
          >
            Confirm rerun
          </button>
          <button
            type="button"
            onClick={onClose}
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
          {runner.haltReason && <div style={{ fontSize: 12, color: 'var(--ink)', marginTop: 10, lineHeight: 1.45 }}>{runner.haltReason}</div>}

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
                  onClose()
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
  )
}
