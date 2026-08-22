// Client-safe contract for Loop C — SANDBOX RERUNS with a diff (plan doc
// plans/active/reasoning-pipeline/31-console-sandbox-reruns.md, migration
// 0043): the wire shapes for app/api/houses/[id]/console/candidate/*,
// candidateBlocksNewSandbox (the "one live candidate at a time" rule),
// candidateIsStale, and computeCandidateHouseState/diffCandidateStages.
//
// That last pair is the load-bearing one: the diff is derived from the SAME
// reducer action a real rerun's completion already applies (lib/build/
// state.ts's APPLY_RERUN_RESULT), never a second parallel run-state-to-layer
// mapping — so what the diff card promises and what promoting actually does
// cannot drift apart. The reducer is plain TS with no DOM/Supabase
// dependency, so importing it keeps this module's DB-free posture.
//
// Split out of console.ts once that file passed the repo's ~600-line
// guideline; re-exported from it, so existing import sites are unaffected.

import { z } from 'zod'
import { type AiAction } from './findings'
import { DRAFT_STAGES, type DraftStage } from './draft'
import { reducer } from '@/lib/build/state'
import type { State } from '@/lib/build/types'
import { runLockBlocks } from './console-loops'

// ─────────────────────────────────────────────────────────────────────────
// Loop C — sandbox reruns with a diff (doc 31, migration 0043)
// ─────────────────────────────────────────────────────────────────────────

// PATCH-like finalize step (POST .../console/candidate) — attaches the
// metadata a just-finished sandbox run needs to become an addressable
// candidate (which chat owns it, which stage it targeted, what to diff
// against) that persistRunStep's own per-step upserts have no way to carry
// (they only know is_candidate; chatId/stage/baseContent are UI-session
// facts, not pipeline-step facts). baseContent is the client's own
// serializeContent(state) output (lib/build/persistence.ts), captured at the
// moment the sandbox run STARTED, not when it finished — same shape POST
// .../console already sends as `house`.
export const FinalizeCandidateRequestSchema = z.object({
  runId: z.string().uuid(),
  chatId: z.string().uuid(),
  stage: z.enum(DRAFT_STAGES),
  baseContent: z.record(z.string(), z.unknown()),
})
export type FinalizeCandidateRequest = z.infer<typeof FinalizeCandidateRequestSchema>

// The client-safe shape GET/POST .../console/candidate return. runState is
// typed unknown here rather than importing components/admin/reasoning's
// RunState (a components-tree type this DB-free, server-and-client-shared
// file shouldn't couple to) — callers (ConsolePage, the runner) already know
// the real shape and cast it the same way useReasoningPipelineRunner casts
// its own fetch responses.
export interface CandidateSummary {
  runId: string
  chatId: string
  stage: DraftStage
  baseContent: Record<string, unknown>
  runState: unknown
  updatedAt: string
}

// Trap 2's second half: getConflictingRunningRun/runLockBlocks (persistence.ts
// / above) only see a candidate WHILE it's status: 'running' — a candidate
// that already finished but hasn't been promoted or discarded yet needs a
// separate check, or a house could accumulate an unbounded pile of pending
// diffs (doc 31's "one candidate at a time"). Delegates to runLockBlocks
// directly (same {id, updatedAt} shape, same STALE_RUN_LOCK_MS staleness
// window) rather than re-deriving identical math under a new name — an
// abandoned, never-finalized-or-resolved candidate stops blocking new
// sandbox attempts once it ages out, exactly like an abandoned running lock
// does.
export function candidateBlocksNewSandbox(
  liveCandidate: { id: string; updatedAt: string } | null,
  incomingRunId: string,
  now: number = Date.now()
): boolean {
  return runLockBlocks(liveCandidate, incomingRunId, now)
}

// Staleness: a plain string compare of two serializeContent(state) outputs.
// Both are deterministic JSON (PERSISTED_KEYS is a fixed key order — see
// lib/build/persistence.ts), so inequality means the house genuinely
// changed since this candidate's baseContent was captured, not key-order
// noise. Re-checked on every render of the diff card, and again — the
// authoritative check — by saveHouse's own optimistic-concurrency `rev` at
// promote time.
export function candidateIsStale(baseContentJson: string, currentContentJson: string): boolean {
  return baseContentJson !== currentContentJson
}

// Trap 4: the candidate's house state, derived from the EXACT SAME reducer
// action a real rerun's completion already applies
// (lib/build/state.ts's APPLY_RERUN_RESULT case) — never a second, parallel
// run-state-to-layer mapping that could drift from what promoting actually
// does. `base` is a full State (the house content at sandbox-run-start
// time, reconstructed from baseContent); `actions` comes from
// mapReasoningRunToActions(candidate.runState) — the same helper the real
// rerun path already calls.
export function computeCandidateHouseState(base: State, stages: DraftStage[], actions: AiAction[]): State {
  return reducer(base, { type: 'APPLY_RERUN_RESULT', stages, actions })
}

// One cascaded layer's worth of diff for the diff card — human-readable
// item summaries (same convention as ConsoleTranscript's own
// summarizeAction), not full objects. A layer OUTSIDE the cascade never
// appears here: APPLY_RERUN_RESULT only clears the stages it's given, so
// every layer before the rerun point is byte-identical between base and
// candidate by construction.
export interface CandidateLayerDiff {
  stage: DraftStage
  removed: string[]
  added: string[]
}

// Same normalized-text matching convention aiActionApplicable
// (lib/build/aiActions.ts) already uses for dedup/applicability checks on
// this exact data — reused here (as its own local copy, not an import, to
// keep that file's own module-private `norm` private) so the diff's
// add/remove classification agrees with what the reducer itself treats as
// "the same item."
const norm = (s: string) => s.trim().toLowerCase()

function layerTexts(state: State, stage: DraftStage): string[] {
  switch (stage) {
    case 'concepts':
      return state.concepts.map((c) => c.term)
    case 'perspectives':
      return state.perspectives.map((p) => p.name)
    case 'evidence':
      return state.evidence.map((e) => e.text)
    case 'assumptions':
      return state.assumptions.map((a) => a.text)
    case 'implications':
      return [...state.pos.map((i) => i.text), ...state.neg.map((i) => i.text), ...state.unc.map((i) => i.text), ...state.watchpoints]
  }
}

// Set diff by normalized text — the same matching convention
// aiActionApplicable (lib/build/aiActions.ts) already uses for dedup/
// applicability checks on this exact data. Because APPLY_RERUN_RESULT
// clears each cascaded stage before repopulating it, `removed` is normally
// everything base had there; an item the regeneration happened to reproduce
// verbatim (same normalized text) correctly shows as neither added nor
// removed — it didn't change.
export function diffCandidateStages(base: State, candidate: State, stages: DraftStage[]): CandidateLayerDiff[] {
  return stages.map((stage) => {
    const before = layerTexts(base, stage)
    const after = layerTexts(candidate, stage)
    const beforeNorm = new Set(before.map(norm))
    const afterNorm = new Set(after.map(norm))
    return {
      stage,
      removed: before.filter((t) => !afterNorm.has(norm(t))),
      added: after.filter((t) => !beforeNorm.has(norm(t))),
    }
  })
}

// POST .../console/candidate/promote body. runId is defense-in-depth, not
// the primary lookup key (the route finds the house's live candidate via
// getLiveCandidateRun itself, since at most one can exist — 0043's partial
// unique index) — if it's present and doesn't match, the route treats that
// as "the candidate changed under you" (409) rather than silently promoting
// whatever is currently live, which could be a DIFFERENT candidate than the
// one the person was just looking at a diff for.
export const PromoteCandidateRequestSchema = z.object({ runId: z.string().uuid().optional() })
export type PromoteCandidateRequest = z.infer<typeof PromoteCandidateRequestSchema>
