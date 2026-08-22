'use client'

// The sandbox-rerun trigger, live progress, and diff card (Loop C, plan doc
// plans/active/reasoning-pipeline/31-console-sandbox-reruns.md). Sibling to
// RerunPanel.tsx, deliberately a SEPARATE component rendering from
// SEPARATE ConsolePage state — Trap 3's own instruction not to disturb the
// existing rerunFrom()/RerunPanel path, which stays untouched.
//
// Two phases, chosen by which prop is set:
//   - `candidate` set (a finalized, persisted candidate exists — either
//     freshly finished this session, or found on load/reload via GET
//     .../console/candidate): the diff card. Trap 4 — the diff comes from
//     computeCandidateHouseState/diffCandidateStages (lib/ai/console.ts),
//     which apply the SAME APPLY_RERUN_RESULT reducer action a real rerun's
//     completion already uses, never a second mapping.
//   - `proposal` set, no candidate yet: the "Run as sandbox" confirm, then
//     (once runner.sandboxMode is active) the same ReasoningStagesList
//     progress RerunPanel already shows for a real rerun.
// `candidate` wins if both happen to be set (there can only be one live
// candidate per house — 0043's partial unique index — so this is just "the
// finished one takes priority over the stale confirm state that led to it").

import { useMemo } from 'react'
import { RATE_LIMITED_CODE, RATE_LIMITED_COPY } from '@/lib/ai/findings'
import { DRAFT_STAGE_STEP, type DraftStage } from '@/lib/ai/draft'
import { layerKey } from '@/lib/build/content'
import { blankState } from '@/lib/build/persistence'
import type { State } from '@/lib/build/types'
import { mapReasoningRunToActions } from '@/lib/ai/reasoning/houseMapping'
import {
  cascadeStages,
  candidateIsStale,
  computeCandidateHouseState,
  diffCandidateStages,
  type CandidateSummary,
  type RerunProposal,
} from '@/lib/ai/console'
import type { ReasoningPipelineRunner } from '../useReasoningPipelineRunner'
import { ReasoningStagesList, type RunState } from '@/components/admin/reasoning/ReasoningStagesList'
import { ContextGatherAnswerBox } from '@/components/admin/reasoning/ContextGatherAnswerBox'
import { EvidenceGatherAnswerBox } from '@/components/admin/reasoning/EvidenceGatherAnswerBox'

function stageLabel(stage: DraftStage): string {
  return layerKey(DRAFT_STAGE_STEP[stage])
}

const buttonBase: React.CSSProperties = {
  fontWeight: 600,
  fontSize: 12,
  borderRadius: 7,
  padding: '6px 13px',
  cursor: 'pointer',
}

export function SandboxPanel({
  proposal,
  candidate,
  runner,
  sandboxActive,
  currentContentJson,
  onStartSandbox,
  onPromote,
  onDiscard,
  onClose,
  promoting,
  discarding,
  actionError,
}: {
  proposal: RerunProposal | null
  candidate: CandidateSummary | null
  runner: ReasoningPipelineRunner
  sandboxActive: boolean
  // JSON.stringify(the live house's serializeContent output) — compared
  // against candidate.baseContent to decide staleness (candidateIsStale).
  currentContentJson: string
  onStartSandbox: () => void
  onPromote: () => void
  onDiscard: () => void
  onClose: () => void
  promoting: boolean
  discarding: boolean
  actionError: string | null
}) {
  // Trap 4: the diff is computeCandidateHouseState's OUTPUT versus its
  // INPUT — not a parallel run-state-to-layer mapping. Recomputed only when
  // the candidate itself changes (it's a pure function of candidate.runState
  // /baseContent/stage).
  const diff = useMemo(() => {
    if (!candidate) return null
    const stages = cascadeStages(candidate.stage)
    const base: State = { ...blankState(), ...(candidate.baseContent as Partial<State>) }
    const actions = mapReasoningRunToActions(candidate.runState as RunState)
    const candidateState = computeCandidateHouseState(base, stages, actions)
    return diffCandidateStages(base, candidateState, stages)
  }, [candidate])

  const stale = candidate ? candidateIsStale(JSON.stringify(candidate.baseContent), currentContentJson) : false

  if (candidate) {
    return (
      <div style={{ border: '1px solid var(--ink)', borderRadius: 11, padding: 14 }} className="fade-in">
        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>
          Sandbox rerun — {stageLabel(candidate.stage)} onward
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-subtle)', marginTop: 4, lineHeight: 1.5 }}>
          Nothing has been written to the house. Review what would change, then promote it or discard it.
        </div>

        {diff && diff.every((l) => l.added.length === 0 && l.removed.length === 0) && (
          <div style={{ fontSize: 12, color: 'var(--ink-subtle)', marginTop: 10 }}>No differences from the current house.</div>
        )}

        {diff?.map(
          (layer) =>
            (layer.added.length > 0 || layer.removed.length > 0) && (
              <div key={layer.stage} style={{ marginTop: 10 }}>
                <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--ink)' }}>{stageLabel(layer.stage)}</div>
                {layer.removed.map((t, i) => (
                  <div key={`r${i}`} style={{ fontSize: 12, color: 'var(--ink-subtle)', textDecoration: 'line-through', lineHeight: 1.5 }}>
                    {t}
                  </div>
                ))}
                {layer.added.map((t, i) => (
                  <div key={`a${i}`} style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.5 }}>
                    + {t}
                  </div>
                ))}
              </div>
            )
        )}

        {stale && (
          <div style={{ fontSize: 11.5, color: 'var(--ink)', marginTop: 10, lineHeight: 1.5 }}>
            The house has changed since this candidate was computed — promoting is disabled. Discard it and rerun the sandbox
            again if you still want this change.
          </div>
        )}
        {actionError && <div style={{ fontSize: 11.5, color: 'var(--ink)', marginTop: 8, lineHeight: 1.45 }}>{actionError}</div>}

        <div style={{ display: 'flex', gap: 8, marginTop: 11 }}>
          <button
            type="button"
            disabled={stale || promoting || discarding}
            onClick={onPromote}
            style={{
              ...buttonBase,
              color: 'var(--ink)',
              background: 'var(--amber-tint)',
              border: '1px solid var(--amber)',
              opacity: stale || promoting || discarding ? 0.5 : 1,
              cursor: stale || promoting || discarding ? 'default' : 'pointer',
            }}
          >
            {promoting ? 'Promoting…' : 'Promote — apply to the house'}
          </button>
          <button
            type="button"
            disabled={promoting || discarding}
            onClick={onDiscard}
            style={{
              ...buttonBase,
              color: 'var(--ink-subtle)',
              background: 'none',
              border: '1px solid var(--rule)',
              opacity: promoting || discarding ? 0.6 : 1,
            }}
          >
            {discarding ? 'Discarding…' : 'Discard'}
          </button>
        </div>
      </div>
    )
  }

  if (!proposal) return null

  return (
    <div style={{ border: '1px solid var(--ink)', borderRadius: 11, padding: 14 }} className="fade-in">
      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>Run as sandbox</div>
      <div style={{ fontSize: 12.5, color: 'var(--ink)', marginTop: 6, lineHeight: 1.5 }}>
        This regenerates, in order, WITHOUT touching the house:
      </div>
      <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
        {cascadeStages(proposal.stage).map((s) => (
          <li key={s} style={{ fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.6 }}>
            {stageLabel(s)}
          </li>
        ))}
      </ul>
      <div style={{ fontSize: 11.5, color: 'var(--ink-subtle)', marginTop: 8, lineHeight: 1.5 }}>
        You&apos;ll see exactly what would change before deciding to promote it or discard it. Only one sandbox candidate can
        be pending per house at a time.
      </div>

      {!sandboxActive && (
        <div style={{ display: 'flex', gap: 8, marginTop: 11 }}>
          <button
            type="button"
            onClick={onStartSandbox}
            style={{ ...buttonBase, color: 'var(--ink)', background: 'var(--white)', border: '1px solid var(--ink)' }}
          >
            Run as sandbox
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{ ...buttonBase, color: 'var(--ink-subtle)', background: 'none', border: '1px solid var(--rule)' }}
          >
            Cancel
          </button>
        </div>
      )}

      {sandboxActive && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 600, fontSize: 12.5, color: 'var(--ink)', marginBottom: 8 }}>
            {runner.phase === 'running'
              ? 'Reasoning…'
              : runner.phase === 'halted'
                ? 'Halted'
                : runner.phase === 'awaiting-input'
                  ? 'Clarification needed'
                  : runner.phase === 'done'
                    ? 'Finalizing the candidate…'
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
              <button
                type="button"
                onClick={runner.pause}
                style={{ ...buttonBase, color: 'var(--ink)', background: 'var(--white)', border: '1px solid var(--ink)', padding: '4px 10px' }}
              >
                Pause
              </button>
            )}
            {runner.phase === 'paused' && (
              <button
                type="button"
                onClick={runner.resume}
                style={{ ...buttonBase, color: 'var(--ink)', background: 'var(--white)', border: '1px solid var(--ink)', padding: '4px 10px' }}
              >
                {runner.errorCode ? 'Retry' : 'Resume'}
              </button>
            )}
            {runner.phase === 'halted' && (
              <button
                type="button"
                onClick={() => {
                  runner.reset()
                  onClose()
                }}
                style={{ ...buttonBase, color: 'var(--ink-subtle)', background: 'none', border: '1px solid var(--rule)', padding: '4px 10px' }}
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
