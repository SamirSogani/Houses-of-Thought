// House Strength algorithm + threshold helpers. See handoff 03-STATE-MODEL.md §3–5.

import type { State } from './types'

export interface Strength {
  evidence: number
  logic: number
  coverage: number
  overall: number
}

export function computeStrength(s: State): Strength {
  const withSrc = s.evidence.length
  const evidence = Math.min(100, withSrc * 18 + 14)

  const implic = s.pos.length + s.neg.length + s.unc.length
  const logic = Math.min(100, s.assumptions.length * 7 + 16 + implic * 2 + 6)

  const coverage = Math.min(100, s.perspectives.length * 11 + 4)

  const overall = Math.round(evidence * 0.4 + logic * 0.35 + coverage * 0.25)
  return { evidence, logic, coverage, overall }
}

// Three distinct threshold helpers. Do NOT merge them (03 §4).

// Perspective bars and evidence numerals.
export function color(v: number): string {
  return v >= 75 ? '#3F8F5B' : v >= 55 ? '#8A7A3F' : '#C2682B'
}

// Overall strength + the three axis scores.
export function strengthColor(v: number): string {
  return v >= 70 ? '#3F8F5B' : v >= 50 ? '#8A7A3F' : '#C2682B'
}

// Per-axis text label.
export function axisLabel(v: number): string {
  return v >= 75 ? 'Strong' : v >= 55 ? 'Developing' : 'Thin'
}

// Overall text label.
export function overallLabel(v: number): string {
  return v >= 75 ? 'Strong' : v >= 60 ? 'Solid, with gaps' : v >= 45 ? 'Developing' : 'Thin'
}

// Overall summary sentence by band (03 §4).
export function overallSummary(v: number): string {
  if (v >= 75)
    return 'Well supported across the board. Publish with confidence and keep sharpening the edges.'
  if (v >= 60)
    return 'A solid house with clear soft spots. The steps below are the fastest way to firm it up.'
  if (v >= 45)
    return 'The reasoning is taking shape but leans on thin support. Add evidence and coverage before publishing.'
  return 'Early days. The house needs more evidence, perspectives, and surfaced assumptions before it holds weight.'
}

// Layer completion predicates (03 §5).
export function layerDone(i: number, s: State): boolean {
  if (i === 1) return s.concepts.length >= 3
  if (i === 2) return s.perspectives.length >= 4
  if (i === 3) return s.evidence.length >= 2
  if (i === 4) return s.assumptions.length >= 3
  if (i === 5) return true
  if (i === 6) return s.pos.length + s.neg.length + s.unc.length >= 4
  if (i === 7) return computeStrength(s).overall >= 60
  return false
}

export function doneCount(s: State): number {
  let n = 0
  for (let i = 1; i <= 7; i++) if (layerDone(i, s)) n++
  return n
}
