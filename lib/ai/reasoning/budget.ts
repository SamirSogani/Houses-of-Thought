// Cost model for the reasoning pipeline (decisions/019, subagent count model:
// generators `5n+9`, review panel `9n+45`, total `14n+54`). Client-safe.
//
// clampN() is Phase 1's static clamp; clampNForStress() below is Phase 2's
// dynamic one (03-orchestration-and-failure-handling.md's "Budget
// enforcement" knob). It takes an already-computed DrafterLaneStress rather
// than reading live router state itself — this file is imported directly by
// the client component (ReasoningPipelinePage.tsx) for its pre-flight cost
// display, so it must never import a server-only module with a runtime
// value; only the caller (the route handler) may call drafterLaneStress()
// and pass the result in.

// Type-only: erased at compile time, so this never pulls router-state.ts's
// runtime (Supabase client, module-global provider maps) into a client
// bundle — see above.
import type { DrafterLaneStress } from '@/lib/ai/router-state'

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

// A further pre-flight clamp on top of clampN(), applied only when the
// caller has detected the drafter lane is under live pressure. 'degraded'
// asks for one fewer perspective than requested; 'critical' forces the
// floor. At today's narrow MIN_N=2/MAX_N_PHASE1=3 range both collapse a
// requested n=3 down to 2 — a real distinction only once MAX_N_PHASE1 grows
// past 3, but still the correct policy now.
export function clampNForStress(n: number, stress: DrafterLaneStress): number {
  const clamped = clampN(n)
  if (stress === 'none') return clamped
  if (stress === 'degraded') return Math.max(MIN_N, clamped - 1)
  return MIN_N // 'critical'
}
