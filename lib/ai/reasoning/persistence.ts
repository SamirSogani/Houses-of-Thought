// Fire-and-forget persistence for the reasoning pipeline (decision 019,
// Phase 2 item 1 — see plans/active/reasoning-pipeline/15-persistence.md for
// the "whether" decision and rationale). One JSONB row per run
// (reasoning_runs, 0030_reasoning_runs.sql), upserted after every real
// (non-dry-run) step response — not just on completion, so a halted run (the
// exact case 13/14 hand-documented from console logs) is captured too.
// Mirrors router-state.ts's persistDailyExhausted: same service-role client,
// same VITEST hard-gate, same fire-and-forget contract — never awaited by the
// route, never throws into the caller. A lost write just means that one run
// has no durable record; never a functional regression to the pipeline.

import { createClient as createServiceClient, type SupabaseClient } from '@supabase/supabase-js'
import { log } from '@/lib/log'
import type { StepId, PipelineMode } from './steps'

if (typeof window !== 'undefined') {
  throw new Error('lib/ai/reasoning/persistence.ts is server-only and must not run in the browser')
}

export type ReasoningRunStatus = 'running' | 'halted' | 'done'

// A run is 'done' only once the last step (final-composition) completes with
// no further step to advance to; 'halted' on a hard-block's exhausted
// retries; 'running' otherwise, including a retry loop-back mid-layer.
export function runStatusFrom(nextStep: StepId | null, isHalted: boolean): ReasoningRunStatus {
  if (isHalted) return 'halted'
  return nextStep === null ? 'done' : 'running'
}

// Same test/config gating as router-state.ts's serviceClient(): hard-gated on
// VITEST so a test throwing a fake failure can never write to real shared
// state, and skips cleanly if the service-role key isn't configured (e.g. a
// contributor's local .env without it).
function testEnv(): boolean {
  return Boolean(process.env.VITEST)
}

let service: SupabaseClient | null = null
function serviceClient(): SupabaseClient | null {
  if (testEnv()) return null
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null
  if (!service) {
    service = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return service
}

// `runState` is the FULL merged run (prior state + this step's patch) — a
// single JSONB blob per run, not separate packet/verdict tables (the packet
// shapes in 02-data-contracts.md already live inside RunState as-is; no
// evidence yet of a query that needs to slice one packet type across runs).
//
// `houseId` (0038_reasoning_runs_house_id.sql, plan doc 27): optional and
// defaults to null so the admin route's existing call sites (which never
// pass it) keep working unmodified — admin-triggered runs are house_id: null
// exactly as before this column existed. Only the new house-scoped route
// (app/api/houses/[id]/reasoning/route.ts) ever passes a real value.
//
// `isCandidate` (0043_reasoning_runs_candidate.sql, plan doc
// plans/active/reasoning-pipeline/31-console-sandbox-reruns.md, Loop C):
// defaults to false so every existing caller (the admin route, and the
// house route's own real start()/rerunFrom() steps) keeps writing ordinary,
// non-candidate rows unmodified. Set true from the FIRST step of a sandbox
// rerun, not just at completion — getReasoningRunByHouseId excludes these
// rows from "the house's current run" for their entire lifetime, not only
// once finished, so a candidate run in progress can never be mistaken for
// one even mid-flight.
// `mode` (0046_reasoning_runs_mode.sql, Express Mode 2026-09-02): defaults to
// 'thorough' so every existing call site (dispatch.ts's house-scoped route,
// this file's own test) keeps writing exactly what it wrote before this
// param existed. Only the admin route ever passes 'express' today. Same
// tier as panels_off (0032) — a run-level fact set once, not derived from
// run_state.
export async function persistRunStep(
  runId: string,
  originalQuery: string,
  runState: unknown,
  step: StepId,
  status: ReasoningRunStatus,
  haltReason: string | undefined,
  panelsOff: boolean,
  houseId: string | null = null,
  isCandidate: boolean = false,
  mode: PipelineMode = 'thorough'
): Promise<void> {
  const client = serviceClient()
  if (!client) return
  try {
    const { error } = await client.from('reasoning_runs').upsert(
      {
        id: runId,
        original_query: originalQuery,
        status,
        last_step: step,
        halt_reason: haltReason ?? null,
        run_state: runState,
        panels_off: panelsOff,
        house_id: houseId,
        is_candidate: isCandidate,
        mode,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    )
    if (error) throw error
  } catch (err) {
    log.error('ai/reasoning/persistence', 'failed to persist run step (non-fatal)', {
      runId,
      step,
      error: (err as Error)?.message,
    })
  }
}

// ── Read side (browse-past-runs admin UI, 15-persistence.md) ──────────────────
// Same service-role client as the write side above. Unlike persistRunStep,
// these ARE awaited by their callers (the admin API routes) — a read has
// nothing useful to "fire and forget" into — but still never throw: a `null`
// return matches this app's existing admin-monitor read pattern
// (lib/ai/limits.ts's getAiUsageSummary), so the UI can render "unavailable"
// instead of a 500.

export interface ReasoningRunSummary {
  id: string
  originalQuery: string
  status: ReasoningRunStatus
  lastStep: StepId
  haltReason: string | null
  panelsOff: boolean
  createdAt: string
  updatedAt: string
}

export interface ReasoningRunDetail extends ReasoningRunSummary {
  runState: unknown
}

interface ReasoningRunRow {
  id: string
  original_query: string
  status: string
  last_step: string
  halt_reason: string | null
  panels_off: boolean
  created_at: string
  updated_at: string
}

function rowToSummary(row: ReasoningRunRow): ReasoningRunSummary {
  return {
    id: row.id,
    originalQuery: row.original_query,
    status: row.status as ReasoningRunStatus,
    lastStep: row.last_step as StepId,
    haltReason: row.halt_reason,
    panelsOff: row.panels_off,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// Most-recently-updated first, capped — this is a debugging/audit list, not a
// paginated archive; nothing yet needs more than the most recent handful.
const LIST_LIMIT = 50

export async function listReasoningRuns(): Promise<ReasoningRunSummary[] | null> {
  const client = serviceClient()
  if (!client) return null
  try {
    const { data, error } = await client
      .from('reasoning_runs')
      .select('id, original_query, status, last_step, halt_reason, panels_off, created_at, updated_at')
      .order('updated_at', { ascending: false })
      .limit(LIST_LIMIT)
    if (error) throw error
    return ((data ?? []) as ReasoningRunRow[]).map(rowToSummary)
  } catch (err) {
    log.error('ai/reasoning/persistence', 'failed to list runs (non-fatal)', { error: (err as Error)?.message })
    return null
  }
}

export async function getReasoningRun(id: string): Promise<ReasoningRunDetail | null> {
  const client = serviceClient()
  if (!client) return null
  try {
    const { data, error } = await client
      .from('reasoning_runs')
      .select('id, original_query, status, last_step, halt_reason, panels_off, created_at, updated_at, run_state')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    if (!data) return null
    return { ...rowToSummary(data as ReasoningRunRow), runState: (data as { run_state: unknown }).run_state }
  } catch (err) {
    log.error('ai/reasoning/persistence', 'failed to load run (non-fatal)', { runId: id, error: (err as Error)?.message })
    return null
  }
}

// Post-pipeline console (plan doc 28) — the console page has no in-memory
// pipeline state to fall back on (a real navigation to /build/[id]/console
// doesn't carry React state across), so it loads the house's own finished
// run by house_id instead of a runId it doesn't have. Most-recently-updated
// row for this house — a house only ever has one reasoning-pipeline run in
// flight/finished at a time in the current product (Draft Mode and the
// pipeline are mutually exclusive per house, decision 016 §1 / plan doc 27),
// so "most recent" is unambiguous today; revisit if that ever changes.
//
// `.eq('is_candidate', false)` (0043_reasoning_runs_candidate.sql, plan doc
// plans/active/reasoning-pipeline/31-console-sandbox-reruns.md, Loop C's
// Trap 1): WITHOUT this, a candidate rerun — persisted under the SAME
// house_id as every ordinary run, upserted after every step — would become
// "the" run for the house the moment it starts, since it is by construction
// the most recently updated row. Every caller of this function inherits the
// fix by fixing it once here rather than once per call site: the console's
// real-rerun starting point (app/api/houses/[id]/reasoning/route.ts GET),
// the "stale chat" badge (console/chats/route.ts GET), and the
// run_id_at_last_reply bookkeeping (console/route.ts and console/revise/
// route.ts POST) all want the REAL run, never a candidate, and none of them
// needed to change to get that once this line was added.
export async function getReasoningRunByHouseId(houseId: string): Promise<ReasoningRunDetail | null> {
  const client = serviceClient()
  if (!client) return null
  try {
    const { data, error } = await client
      .from('reasoning_runs')
      .select('id, original_query, status, last_step, halt_reason, panels_off, created_at, updated_at, run_state')
      .eq('house_id', houseId)
      .eq('is_candidate', false)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw error
    if (!data) return null
    return { ...rowToSummary(data as ReasoningRunRow), runState: (data as { run_state: unknown }).run_state }
  } catch (err) {
    log.error('ai/reasoning/persistence', 'failed to load run by house (non-fatal)', {
      houseId,
      error: (err as Error)?.message,
    })
    return null
  }
}

// Single-flight per house (doc 30's Loop B item 1a,
// plans/active/reasoning-pipeline/30-console-subagent-loops.md) — finds the
// most-recently-updated 'running' row for this house that is NOT the
// incoming request's own run (excludeRunId), so
// app/api/houses/[id]/reasoning/route.ts can decide whether an in-flight run
// elsewhere blocks a NEW start. The `.neq('id', excludeRunId)` is the whole
// trick: a continuation step of the caller's own run always resends its own
// runId, so it can never see itself here regardless of whether that row has
// even been persisted yet (persistRunStep runs in `after()`, fire-and-forget
// — this function never needs to race it). runLockBlocks (lib/ai/console.ts)
// turns this row (or its absence) plus the caller's runId into an allow/deny
// decision; staleness (a row whose updated_at is old enough that its run was
// clearly abandoned, e.g. a closed tab) is also decided there, not here.
//
// Same fail-open posture as every other read in this module: a lookup
// failure returns null (no lock found) rather than blocking a legitimate run
// over an infrastructure hiccup — this is a cost/consistency control, not a
// security boundary, so an outage here should never be the reason a real
// pipeline run can't start.
export interface RunningRunLock {
  id: string
  updatedAt: string
}

// Deliberately NOT filtered on is_candidate (plan doc
// plans/active/reasoning-pipeline/31-console-sandbox-reruns.md, Trap 2): a
// candidate run's steps persist with status: 'running' exactly like a real
// run's do, and that is intentional, not an oversight — a candidate rerun is
// a real, billed pipeline cascade in flight, so it blocks (and is blocked
// by) a second concurrent real rerun or candidate rerun for the same house
// through this SAME lock, no separate mechanism needed. What this lock does
// NOT cover is a candidate that already finished but hasn't been promoted or
// discarded yet (status: 'done', not 'running') — that case is a deliberate
// SEPARATE check, getLiveCandidateRun + candidateBlocksNewSandbox below,
// gated on the request actually being a sandbox one.
export async function getConflictingRunningRun(houseId: string, excludeRunId: string): Promise<RunningRunLock | null> {
  const client = serviceClient()
  if (!client) return null
  try {
    const { data, error } = await client
      .from('reasoning_runs')
      .select('id, updated_at')
      .eq('house_id', houseId)
      .eq('status', 'running')
      .neq('id', excludeRunId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw error
    if (!data) return null
    const row = data as { id: string; updated_at: string }
    return { id: row.id, updatedAt: row.updated_at }
  } catch (err) {
    log.error('ai/reasoning/persistence', 'failed to check run lock (non-fatal, fails open)', {
      houseId,
      error: (err as Error)?.message,
    })
    return null
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Loop C — sandbox reruns with a diff (plan doc
// plans/active/reasoning-pipeline/31-console-sandbox-reruns.md, migration
// 0043)
// ─────────────────────────────────────────────────────────────────────────

export interface CandidateRunRow {
  id: string
  updatedAt: string
  status: ReasoningRunStatus
  chatId: string | null
  stage: string | null
  baseContent: unknown
  resolution: 'promoted' | 'discarded' | null
  runState: unknown
}

interface RawCandidateRow {
  id: string
  updated_at: string
  status: string
  candidate_chat_id: string | null
  candidate_stage: string | null
  candidate_base_content: unknown
  candidate_resolution: 'promoted' | 'discarded' | null
  run_state: unknown
}

function rowToCandidate(row: RawCandidateRow): CandidateRunRow {
  return {
    id: row.id,
    updatedAt: row.updated_at,
    status: row.status as ReasoningRunStatus,
    chatId: row.candidate_chat_id,
    stage: row.candidate_stage,
    baseContent: row.candidate_base_content,
    resolution: row.candidate_resolution,
    runState: row.run_state,
  }
}

const CANDIDATE_SELECT =
  'id, updated_at, status, candidate_chat_id, candidate_stage, candidate_base_content, candidate_resolution, run_state'

// The house's one LIVE candidate (is_candidate = true, candidate_resolution
// still null), if any — enforced to be at most one by the partial unique
// index (0043) and the pre-flight check in
// app/api/houses/[id]/reasoning/route.ts that uses this. Used both by that
// pre-flight check and by GET .../console/candidate to hydrate the diff
// card across a reload. Same fail-open posture as every other read here: a
// lookup failure returns null rather than blocking a legitimate request over
// an infrastructure hiccup.
export async function getLiveCandidateRun(houseId: string): Promise<CandidateRunRow | null> {
  const client = serviceClient()
  if (!client) return null
  try {
    const { data, error } = await client
      .from('reasoning_runs')
      .select(CANDIDATE_SELECT)
      .eq('house_id', houseId)
      .eq('is_candidate', true)
      .is('candidate_resolution', null)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw error
    if (!data) return null
    return rowToCandidate(data as RawCandidateRow)
  } catch (err) {
    log.error('ai/reasoning/persistence', 'failed to load live candidate (non-fatal)', {
      houseId,
      error: (err as Error)?.message,
    })
    return null
  }
}

// Attaches the metadata a candidate needs beyond what persistRunStep already
// wrote during the sandbox run itself (chat ownership, the stage, the diff
// baseline) — an UPDATE, not an insert; the row already exists and is
// already live by the time this is called. Only succeeds against a row that
// is genuinely this house's finished (status: 'done'), still-unresolved,
// is_candidate row — never a halted or still-running one (nothing to show a
// diff for yet), and never a run belonging to a different house.
export async function finalizeCandidateRun(
  runId: string,
  houseId: string,
  chatId: string,
  stage: string,
  baseContent: unknown
): Promise<CandidateRunRow | null> {
  const client = serviceClient()
  if (!client) return null
  try {
    const { data, error } = await client
      .from('reasoning_runs')
      .update({ candidate_chat_id: chatId, candidate_stage: stage, candidate_base_content: baseContent })
      .eq('id', runId)
      .eq('house_id', houseId)
      .eq('is_candidate', true)
      .eq('status', 'done')
      .is('candidate_resolution', null)
      .select(CANDIDATE_SELECT)
      .maybeSingle()
    if (error) throw error
    if (!data) return null
    return rowToCandidate(data as RawCandidateRow)
  } catch (err) {
    log.error('ai/reasoning/persistence', 'failed to finalize candidate (non-fatal)', {
      runId,
      houseId,
      error: (err as Error)?.message,
    })
    return null
  }
}

// Promote or discard the house's live candidate (doc 31's Trap 5/6 —
// promote never re-runs anything, it only flips this flag once the caller
// has already applied the candidate's actions to the house on its own).
// Scoped to is_candidate = true AND candidate_resolution IS NULL so a
// double-click (or a stale UI after someone else already resolved it) is a
// harmless no-op (returns null) rather than resolving twice.
export async function resolveCandidateRun(
  runId: string,
  houseId: string,
  resolution: 'promoted' | 'discarded'
): Promise<CandidateRunRow | null> {
  const client = serviceClient()
  if (!client) return null
  try {
    const { data, error } = await client
      .from('reasoning_runs')
      .update({ candidate_resolution: resolution })
      .eq('id', runId)
      .eq('house_id', houseId)
      .eq('is_candidate', true)
      .is('candidate_resolution', null)
      .select(CANDIDATE_SELECT)
      .maybeSingle()
    if (error) throw error
    if (!data) return null
    return rowToCandidate(data as RawCandidateRow)
  } catch (err) {
    log.error('ai/reasoning/persistence', `failed to mark candidate ${resolution} (non-fatal)`, {
      runId,
      houseId,
      error: (err as Error)?.message,
    })
    return null
  }
}

// Test-only: drop the cached client so a test can force a fresh env re-read.
export function __resetPersistenceClient(): void {
  service = null
}
