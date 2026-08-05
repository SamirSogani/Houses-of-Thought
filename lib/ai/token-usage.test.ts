// The Supabase calls (recordTokenUsage, getTokenUsageSummary) are hard-gated
// on process.env.VITEST (same pattern as reasoning/persistence.ts, which has
// the identical rationale) — under the test runner they always resolve to a
// no-op/null before touching the network, so what's worth pinning is exactly
// that contract, without inventing a Supabase mock this codebase doesn't
// otherwise use.

import { describe, expect, it } from 'vitest'
import { getTokenUsageSummary, recordTokenUsage } from './token-usage'

describe('token usage under the test runner', () => {
  it('recordTokenUsage never throws (no-op, VITEST-gated)', () => {
    expect(() =>
      recordTokenUsage({
        provider: 'mistral',
        model: 'ministral-8b-latest',
        role: 'coach',
        inputTokens: 100,
        outputTokens: 50,
      })
    ).not.toThrow()
  })

  it('getTokenUsageSummary resolves to null (VITEST-gated)', async () => {
    await expect(getTokenUsageSummary('today')).resolves.toBeNull()
  })
})
