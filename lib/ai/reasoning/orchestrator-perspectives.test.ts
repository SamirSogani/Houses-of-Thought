// Bounded-retry logic for the Perspectives layer (decision 019, Phase 1.5 #1)
// — the one layer that regenerates per-bundle instead of hard-blocking. This
// pins the two properties that matter and can't be exercised live today
// (provider capacity is too unstable to reach real perspectives review, see
// plans/active/reasoning-pipeline/05): a settled bundle (passed, or already
// degraded) is never re-asked-for or re-reviewed, and a still-failing bundle
// degrades only once MAX_REGENERATION_ATTEMPTS is actually exhausted.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FramePacket, PerspectiveBundle, PerspectiveStance, ReviewPanelVerdict } from './contracts'
import { STANDARD_IDS } from './contracts'
import { MAX_REGENERATION_ATTEMPTS } from './budget'

const completeJSONMock = vi.fn()
const drafterLaneStressMock = vi.fn<() => 'none' | 'degraded' | 'critical'>(() => 'none')
vi.mock('@/lib/ai/router', () => ({
  completeJSON: (...args: unknown[]) => completeJSONMock(...args),
  drafterLaneStress: () => drafterLaneStressMock(),
}))

const runReviewPanelMock = vi.fn()
vi.mock('./orchestrator-panel', () => ({ runReviewPanel: (...args: unknown[]) => runReviewPanelMock(...args) }))

const { runPerspectivesGenerateDetails, runPerspectivesReview } = await import('./orchestrator-perspectives')

const frame: FramePacket = {
  original_query: 'Should our school ban homework?',
  core_question: 'Should our school ban homework?',
  definitions: [],
  purpose: 'test',
  scope_notes: 'test',
}

function stance(id: string, label: string): PerspectiveStance {
  return { perspective_id: id, stance_label: label, stance_summary: 'summary', key_claims: ['claim'] }
}

function bundle(id: string, label: string): PerspectiveBundle {
  return {
    ...stance(id, label),
    sub_questions: [{ question: 'q', answer: 'a' }],
    assumptions: ['a'],
    evidence: [],
    counterargument: { authored_by_perspective_id: 'other', target_claims: ['claim'], rebuttals: ['r'] },
  }
}

function verdict(overall_pass: boolean, degraded = false): ReviewPanelVerdict {
  const standards = Object.fromEntries(
    STANDARD_IDS.map((id) => [id, { pass: overall_pass, notes: overall_pass ? 'fine' : `${id} failed` }])
  ) as ReviewPanelVerdict['standards']
  return { subject_id: 'p1', standards, overall_pass, degraded }
}

beforeEach(() => {
  completeJSONMock.mockReset()
  runReviewPanelMock.mockReset()
  drafterLaneStressMock.mockReset()
  drafterLaneStressMock.mockReturnValue('none')
  completeJSONMock.mockResolvedValue({})
  // runPerspectivesGenerateDetails staggers its calls via real setTimeout
  // (DRAFTER_STAGGER_MS, widened to 20s live to fit Groq's real TPM budget —
  // see orchestrator-perspectives.ts). Fake timers keep these tests fast
  // regardless of that constant's value; vi.runAllTimersAsync() below flushes
  // every pending stagger delay instead of a test actually waiting on it.
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('runPerspectivesGenerateDetails', () => {
  it('generates every bundle fresh when there is no prior verdict', async () => {
    const stances = [stance('p1', 'A'), stance('p2', 'B')]
    completeJSONMock.mockResolvedValue({ sub_questions: [{ question: 'q', answer: 'a' }] })
    const resultPromise = runPerspectivesGenerateDetails(frame, stances, false)
    await vi.runAllTimersAsync()
    const { bundles, attempts } = await resultPromise
    expect(bundles).toHaveLength(2)
    expect(attempts).toEqual([1, 1])
    expect(completeJSONMock).toHaveBeenCalledTimes(8) // 4 sub-elements x 2 bundles
  })

  it('regenerates only the failing bundle, leaving a settled one untouched', async () => {
    const stances = [stance('p1', 'A'), stance('p2', 'B')]
    const priorBundles = [bundle('p1', 'A'), bundle('p2', 'B')]
    const priorVerdicts = [verdict(false), verdict(true)] // p1 failed, p2 already passed
    const priorAttempts = [1, 1]

    completeJSONMock.mockResolvedValue({ sub_questions: [{ question: 'regenerated', answer: 'a' }] })
    const resultPromise = runPerspectivesGenerateDetails(frame, stances, false, {
      priorBundles,
      priorVerdicts,
      priorAttempts,
    })
    await vi.runAllTimersAsync()
    const { bundles, attempts } = await resultPromise

    // p2 (settled) is the exact same object back — never regenerated.
    expect(bundles[1]).toBe(priorBundles[1])
    // p1 (failing) went through completeJSON again.
    expect(completeJSONMock).toHaveBeenCalledTimes(4) // only p1's 4 sub-elements
    expect(attempts).toEqual([2, 1]) // only p1's attempt count advanced

    // The regeneration prompt actually carries the prior artifact + failing notes.
    const userPrompts = completeJSONMock.mock.calls.map((c) => (c[0] as { user: string }).user)
    expect(userPrompts.every((u) => u.includes('Your previous attempt'))).toBe(true)
    expect(userPrompts.every((u) => u.includes('clarity failed'))).toBe(true)
  })

  it('never regenerates a bundle that already exhausted its attempts and degraded', async () => {
    const stances = [stance('p1', 'A')]
    const priorBundles = [bundle('p1', 'A')]
    const priorVerdicts = [verdict(false, true)] // failed AND degraded — settled, gave up
    const priorAttempts = [MAX_REGENERATION_ATTEMPTS]

    const { bundles, attempts } = await runPerspectivesGenerateDetails(frame, stances, false, {
      priorBundles,
      priorVerdicts,
      priorAttempts,
    })

    expect(bundles[0]).toBe(priorBundles[0])
    expect(completeJSONMock).not.toHaveBeenCalled()
    expect(attempts).toEqual([MAX_REGENERATION_ATTEMPTS])
  })

  // Phase 2 dynamic budget enforcement (03-orchestration-and-failure-handling.md
  // "Budget enforcement"): under detected drafter-lane stress, the same
  // flattened schedule should spread further apart — see effectiveStaggerMs()
  // in orchestrator-perspectives.ts.
  it('widens the stagger under degraded stress, and further under critical', async () => {
    const stances = [stance('p1', 'A')]
    completeJSONMock.mockResolvedValue({ sub_questions: ['q'] })

    drafterLaneStressMock.mockReturnValue('degraded')
    const degradedSpy = vi.spyOn(global, 'setTimeout')
    const degradedPromise = runPerspectivesGenerateDetails(frame, stances, false)
    await vi.runAllTimersAsync()
    await degradedPromise
    // Base DRAFTER_STAGGER_MS is 20_000; 'degraded' widens it 1.5x.
    expect(degradedSpy.mock.calls.map((c) => c[1])).toEqual(expect.arrayContaining([0, 30_000, 60_000, 90_000]))
    degradedSpy.mockRestore()

    drafterLaneStressMock.mockReturnValue('critical')
    const criticalSpy = vi.spyOn(global, 'setTimeout')
    const criticalPromise = runPerspectivesGenerateDetails(frame, stances, false)
    await vi.runAllTimersAsync()
    await criticalPromise
    // 'critical' widens it 4x (real-verified 2026-08-02 that 2x still let
    // Cerebras produce invalid JSON under sole-remaining-target load — see
    // effectiveStaggerMs()).
    expect(criticalSpy.mock.calls.map((c) => c[1])).toEqual(expect.arrayContaining([0, 80_000, 160_000, 240_000]))
  })
})

describe('runPerspectivesReview', () => {
  it('reviews every bundle fresh when there is no prior verdict', async () => {
    const bundles = [bundle('p1', 'A'), bundle('p2', 'B')]
    runReviewPanelMock.mockResolvedValue(verdict(true))
    const verdicts = await runPerspectivesReview(frame, bundles, null, null, false)
    expect(verdicts).toHaveLength(2)
    expect(runReviewPanelMock).toHaveBeenCalledTimes(2)
  })

  it('does not re-review a settled bundle (passed, or already degraded)', async () => {
    const bundles = [bundle('p1', 'A'), bundle('p2', 'B')]
    const priorVerdicts = [verdict(true), verdict(false, true)]
    const verdicts = await runPerspectivesReview(frame, bundles, priorVerdicts, [1, MAX_REGENERATION_ATTEMPTS], false)
    expect(runReviewPanelMock).not.toHaveBeenCalled()
    expect(verdicts).toEqual(priorVerdicts)
  })

  it('keeps a still-failing bundle retryable below the attempt cap', async () => {
    const bundles = [bundle('p1', 'A')]
    const priorVerdicts = [verdict(false)]
    runReviewPanelMock.mockResolvedValue(verdict(false))
    const verdicts = await runPerspectivesReview(frame, bundles, priorVerdicts, [1], false)
    expect(verdicts[0].overall_pass).toBe(false)
    expect(verdicts[0].degraded).toBe(false)
  })

  it('degrades a bundle only once it fails at the final attempt', async () => {
    const bundles = [bundle('p1', 'A')]
    const priorVerdicts = [verdict(false)]
    runReviewPanelMock.mockResolvedValue(verdict(false))
    const verdicts = await runPerspectivesReview(frame, bundles, priorVerdicts, [MAX_REGENERATION_ATTEMPTS], false)
    expect(verdicts[0].overall_pass).toBe(false)
    expect(verdicts[0].degraded).toBe(true)
  })
})
