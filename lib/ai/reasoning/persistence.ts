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
import type { StepId } from './steps'

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
export async function persistRunStep(
  runId: string,
  originalQuery: string,
  runState: unknown,
  step: StepId,
  status: ReasoningRunStatus,
  haltReason: string | undefined,
  panelsOff: boolean
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

// Test-only: drop the cached client so a test can force a fresh env re-read.
export function __resetPersistenceClient(): void {
  service = null
}
