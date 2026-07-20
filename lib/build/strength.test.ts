// House Strength + layer thresholds + derived status (frontend plan Phase 1,
// tests 13–14). Pins CURRENT behavior — including that strength counts items,
// not quality (product-strategy-gaps §1) — so any rebalancing is deliberate.

import { describe, expect, it } from 'vitest'
import { computeStrength, doneCount, layerDone } from './strength'
import { blankState, deriveStatus } from './persistence'
import type { State } from './types'

function withContent(patch: Partial<State>): State {
  return { ...blankState(), ...patch }
}

const evidence = (n: number): State['evidence'] =>
  Array.from({ length: n }, (_, i) => ({ id: i + 1, text: 't', source: 's', owner: 'you' as const, byAI: false }))
const perspectives = (n: number): State['perspectives'] =>
  Array.from({ length: n }, (_, i) => ({
    id: i + 1, name: 'P', summary: 's', stance: '', subQuestions: [], supportingEvidence: [], counters: [], strength: 0, owner: 'you' as const,
  }))
const assumptions = (n: number): State['assumptions'] =>
  Array.from({ length: n }, (_, i) => ({ id: i + 1, text: 'a', owner: 'you' as const }))
const implications = (n: number): State['pos'] =>
  Array.from({ length: n }, (_, i) => ({ id: i + 1, text: 'x', horizon: 'Near-term' as const, who: '' }))

describe('computeStrength', () => {
  it('empty house floors: evidence 14 / logic 22 / coverage 4 / overall 14', () => {
    expect(computeStrength(blankState())).toEqual({ evidence: 14, logic: 22, coverage: 4, overall: 14 })
  })

  it('every axis caps at 100', () => {
    const s = withContent({
      evidence: evidence(10),
      perspectives: perspectives(12),
      assumptions: assumptions(15),
      pos: implications(20),
    })
    const { evidence: e, logic, coverage } = computeStrength(s)
    expect([e, logic, coverage]).toEqual([100, 100, 100])
  })

  it('overall is the weighted round (40/35/25)', () => {
    const s = withContent({ evidence: evidence(3) }) // evidence 68, logic 22, coverage 4
    expect(computeStrength(s).overall).toBe(Math.round(68 * 0.4 + 22 * 0.35 + 4 * 0.25))
  })

  it('the Evidence axis only fully credits SOURCED evidence (ai-slop §8)', () => {
    const unsourced = (n: number): State['evidence'] =>
      Array.from({ length: n }, (_, i) => ({ id: i + 1, text: 't', source: '', owner: 'you' as const, byAI: false }))

    // Blank rows used to score identically to cited ones, so five empty rows
    // maxed the axis the copy describes as "backed by a cited, checkable source".
    expect(computeStrength(withContent({ evidence: unsourced(3) })).evidence).toBeLessThan(
      computeStrength(withContent({ evidence: evidence(3) })).evidence
    )

    // A row counts as sourced via `source` OR `url`.
    const byUrl: State['evidence'] = [
      { id: 1, text: 't', source: '', url: 'https://x.test/a', owner: 'you', byAI: false },
    ]
    expect(computeStrength(withContent({ evidence: byUrl })).evidence).toBe(
      computeStrength(withContent({ evidence: evidence(1) })).evidence
    )

    // Unsourced still counts half — a written claim is real work, just ungrounded.
    expect(computeStrength(withContent({ evidence: unsourced(2) })).evidence).toBe(
      computeStrength(withContent({ evidence: evidence(1) })).evidence
    )
  })
})

describe('layerDone thresholds', () => {
  it('each layer flips exactly at its documented threshold', () => {
    expect(layerDone(1, withContent({ concepts: Array(2).fill({ term: 't', definition: '' }) }))).toBe(false)
    expect(layerDone(1, withContent({ concepts: Array(3).fill({ term: 't', definition: '' }) }))).toBe(true)
    expect(layerDone(2, withContent({ perspectives: perspectives(3) }))).toBe(false)
    expect(layerDone(2, withContent({ perspectives: perspectives(4) }))).toBe(true)
    expect(layerDone(3, withContent({ evidence: evidence(1) }))).toBe(false)
    expect(layerDone(3, withContent({ evidence: evidence(2) }))).toBe(true)
    expect(layerDone(4, withContent({ assumptions: assumptions(2) }))).toBe(false)
    expect(layerDone(4, withContent({ assumptions: assumptions(3) }))).toBe(true)
    expect(layerDone(5, withContent({ conclusion: 'done' }))).toBe(true)
    expect(layerDone(5, withContent({ reasoning: 'r' }))).toBe(true)
    expect(layerDone(6, withContent({ pos: implications(2), neg: implications(2) }))).toBe(true)
    expect(layerDone(6, withContent({ pos: implications(3) }))).toBe(false)
    expect(layerDone(7, blankState())).toBe(false) // needs overall ≥ 60
  })
})

describe('deriveStatus', () => {
  it('empty → in-progress (title only) → complete (all 7 layers)', () => {
    expect(deriveStatus(blankState())).toBe('empty')
    expect(deriveStatus(withContent({ title: 'Named' }))).toBe('in-progress')
    // Prose counts as content (bl-M3): conclusion-only is work in progress.
    expect(deriveStatus(withContent({ conclusion: 'My verdict.' }))).toBe('in-progress')
    expect(deriveStatus(withContent({ question: 'Q?' }))).toBe('in-progress')

    const complete = withContent({
      concepts: Array(3).fill({ term: 't', definition: '' }),
      perspectives: perspectives(4),
      evidence: evidence(5),
      assumptions: assumptions(3),
      conclusion: 'verdict',
      pos: implications(4),
    })
    expect(doneCount(complete)).toBe(7)
    expect(deriveStatus(complete)).toBe('complete')
  })
})
