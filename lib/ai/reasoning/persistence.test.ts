// Only runStatusFrom is tested directly: persistRunStep's Supabase call is
// hard-gated on process.env.VITEST (same pattern as router-state.ts's
// serviceClient(), which has no dedicated test file either) — under the test
// runner it always no-ops before touching the network, so there is nothing
// further to assert without inventing a mock this codebase doesn't otherwise use.

import { describe, expect, it } from 'vitest'
import { runStatusFrom } from './persistence'

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
