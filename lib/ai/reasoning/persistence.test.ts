// runStatusFrom is pure and tested directly. The read/write Supabase calls
// (persistRunStep, listReasoningRuns, getReasoningRun) are hard-gated on
// process.env.VITEST (same pattern as router-state.ts's serviceClient(),
// which has no dedicated test file either) — under the test runner they
// always resolve to a no-op/null before touching the network, so what's
// worth pinning is exactly that contract: they resolve cleanly rather than
// throwing, without inventing a Supabase mock this codebase doesn't
// otherwise use.

import { describe, expect, it } from 'vitest'
import { getReasoningRun, listReasoningRuns, persistRunStep, runStatusFrom } from './persistence'

describe('runStatusFrom', () => {
  it('is "halted" whenever isHalted is true, regardless of nextStep', () => {
    expect(runStatusFrom('frame-generate', true)).toBe('halted')
    expect(runStatusFrom(null, true)).toBe('halted')
  })

  it('is "done" only when not halted and there is no next step', () => {
    expect(runStatusFrom(null, false)).toBe('done')
  })

  it('is "running" when not halted and a next step remains', () => {
    expect(runStatusFrom('frame-review', false)).toBe('running')
  })
})

describe('Supabase calls under the test runner', () => {
  it('persistRunStep resolves without throwing (no-op, VITEST-gated)', async () => {
    await expect(
      persistRunStep('00000000-0000-0000-0000-000000000000', 'test query', {}, 'context-gather-pre', 'running', undefined, false)
    ).resolves.toBeUndefined()
  })

  it('listReasoningRuns resolves to null (VITEST-gated)', async () => {
    await expect(listReasoningRuns()).resolves.toBeNull()
  })

  it('getReasoningRun resolves to null (VITEST-gated)', async () => {
    await expect(getReasoningRun('00000000-0000-0000-0000-000000000000')).resolves.toBeNull()
  })
})
