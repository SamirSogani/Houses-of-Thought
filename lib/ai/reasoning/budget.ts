// Cost model for the reasoning pipeline (decisions/019, subagent count model:
// generators `7n+11`, review panel `9n+45`, total `16n+56`). Client-safe.
// Generators went 5n+9 → 7n+11 on 2026-08-13 (Samir): evidence generation
// (per-perspective AND global) split from 1 call into 3 (strategy →
// populate → confidence — see steps.ts) — +2 per perspective, +2 fixed for
// the global-evidence trio replacing its old single call. Review-gate count
// is unchanged (9n+45) — evidence still isn't independently reviewed, it's
// reviewed as part of the whole bundle/packet at perspectives-review /
// global-evidence-review, same as before.
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

// One further attempt a hard-block layer earns after MAX_REGENERATION_ATTEMPTS
// still fails (2026-08-11, Samir addendum) — a master reviewer synthesizes
// guidance from all 9 standards' verdicts together (something the blind panel
// structurally can't do itself) for exactly this one extra try before the
// layer genuinely halts. Perspectives doesn't use this (it already degrades
// instead of halting — real redundancy from the other bundles). See
// app/api/admin/reasoning/route.ts's tryMasterReviewOrHalt.
export const MASTER_REVIEW_ATTEMPT = MAX_REGENERATION_ATTEMPTS + 1

// Repair calls opt into 'high' reasoning effort (router-shared.ts's
// allowHighReasoning) on the theory that a genuine revision needs real
// deliberation — but on gpt-oss-20b, 'high' effort's internal reasoning
// tokens draw from the SAME maxTokens budget as the final JSON answer.
// Real-verified live (2026-08-12, testing this branch): every repair call in
// a perspectives-generate-details batch (subquestions/assumptions/
// counterargument — evidence moved out to its own steps 2026-08-13, still
// gets this same headroom on its populate/confidence calls) exhausted its
// first-pass maxTokens on reasoning alone
// before emitting any output — finishReason 'length', empty completion — on
// BOTH DeepInfra and Groq (same underlying model, so the failure cascaded
// through both rather than one covering for the other). Added on top of each
// call's own first-pass maxTokens only when that call is in repair mode.
export const REPAIR_TOKEN_HEADROOM = 3000

// panelsOff (decision 019 verification stage 3, A/B the review panel): every
// runReviewPanel call short-circuits to an auto-pass verdict instead of its 9
// real reviewer calls (orchestrator-panel.ts's autoPassVerdict) — generation
// is unaffected, only the 9n+45 reviewer cost disappears.
export function estimatePipelineCost(n: number, panelsOff = false): { generators: number; reviewers: number; total: number } {
  const generators = 7 * n + 11
  const reviewers = panelsOff ? 0 : 9 * n + 45
  return { generators, reviewers, total: generators + reviewers }
}

// Express mode: no review panels, no evidence steps, no context-gather.
// Generators only: frame(1) + breadthScoping(1) + stances(n) + details(n) +
// conclusions(1) + implications(1) + finalComposition(1) = 2n + 5.
// No concurrent review calls — peak concurrency is just the n parallel
// perspective calls.
export function estimateExpressCost(n: number): { generators: number; reviewers: number; total: number } {
  const generators = 2 * n + 5
  return { generators, reviewers: 0, total: generators }
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
