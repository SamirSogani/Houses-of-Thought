// Cost model for the reasoning pipeline (decisions/019, subagent count model:
// generators `5n+9`, review panel `9n+45`, total `14n+54`). Client-safe.
//
// Phase 1 uses this only as a pre-flight display + a static clamp on n — no
// dynamic budget-based shrinking yet (that's a Phase 2 concern per
// 03-orchestration-and-failure-handling.md's "Budget enforcement" knob).

// Matches decisions/019's own "n=2-3" minimal-build spec, not the larger
// production default (4-6) the architecture doc suggests once retries and
// cost data justify it.
export const MAX_N_PHASE1 = 3
export const MIN_N = 2

// Bounded retries (03-orchestration-and-failure-handling.md): a failing
// bundle or hard-block layer gets up to 2 regenerations — 3 attempts total —
// before it degrades (perspectives) or halts the pipeline (everything else).
export const MAX_REGENERATION_ATTEMPTS = 3

export function estimatePipelineCost(n: number): { generators: number; reviewers: number; total: number } {
  const generators = 5 * n + 9
  const reviewers = 9 * n + 45
  return { generators, reviewers, total: generators + reviewers }
}

export function clampN(n: number): number {
  return Math.min(MAX_N_PHASE1, Math.max(MIN_N, Math.round(n)))
}
