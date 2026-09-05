'use client'

// Inline pipeline progress indicators for the canvas's 7-layer document
// (Level 2 redesign — plan doc 32). Each layer section header shows a small
// dot/spinner/check reflecting where the pipeline run currently is, instead
// of a full-screen PipelineView replacing the canvas.

import { stepOrderForMode, type PipelineMode, type StepId } from '@/lib/ai/reasoning/steps'
import { CheckIcon } from '@/components/icons'
import type { ReasoningPipelineRunner } from './useReasoningPipelineRunner'

// Step-to-layer mapping for both modes.
const EXPRESS_LAYER_STEPS: Partial<Record<number, StepId[]>> = {
  1: ['frame-generate'],
  2: ['breadth-scoping', 'perspectives-generate-stances', 'perspectives-generate-details'],
  5: ['conclusions-generate', 'final-composition'],
  6: ['implications-generate'],
}

const THOROUGH_LAYER_STEPS: Partial<Record<number, StepId[]>> = {
  1: ['context-gather-pre', 'frame-generate', 'frame-review', 'context-gather-post'],
  2: ['breadth-scoping', 'perspectives-generate-stances', 'perspectives-generate-details',
      'perspectives-evidence-strategy', 'perspectives-evidence-populate', 'perspectives-evidence-confidence', 'perspectives-review'],
  3: ['global-evidence-strategy', 'global-evidence-populate', 'global-evidence-confidence', 'global-evidence-review'],
  4: ['global-assumptions-generate', 'global-assumptions-review'],
  5: ['conclusions-generate', 'conclusions-review', 'final-composition'],
  6: ['implications-generate', 'implications-review'],
}

export type LayerPipelineStatus = 'active' | 'done' | 'pending'

export function layerPipelineStatus(
  layerStep: number,
  runner: ReasoningPipelineRunner,
  mode: PipelineMode
): LayerPipelineStatus | null {
  // Only show indicators while the pipeline is actively running/paused/halted
  const active = runner.phase === 'running' || runner.phase === 'paused' || runner.phase === 'awaiting-input' || runner.phase === 'halted'
  if (!active) return null

  const mapping = mode === 'express' ? EXPRESS_LAYER_STEPS : THOROUGH_LAYER_STEPS
  const steps = mapping[layerStep]
  if (!steps) return null

  const order = stepOrderForMode(mode)
  const currentIdx = runner.step ? order.indexOf(runner.step) : -1
  const lastIdx = order.indexOf(steps[steps.length - 1])
  const firstIdx = order.indexOf(steps[0])

  if (currentIdx > lastIdx) return 'done'
  if (currentIdx >= firstIdx) return 'active'
  return 'pending'
}

// Small inline indicator shown in each layer section header.
export function PipelineLayerIndicator({ status }: { status: LayerPipelineStatus }) {
  if (status === 'done') {
    return <span style={{ display: 'inline-flex', color: 'var(--amber)' }}><CheckIcon size={13} /></span>
  }
  if (status === 'active') {
    return <span className="mini-spinner" aria-label="Generating" style={{ width: 13, height: 13 }} />
  }
  // pending
  return <span style={{ width: 7, height: 7, borderRadius: 999, background: 'var(--rule)', display: 'inline-block', flexShrink: 0 }} />
}
