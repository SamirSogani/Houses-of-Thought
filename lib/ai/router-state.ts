// Module-global routing state: the Groq penalty box, the per-provider daily
// quota map, and the passive per-target health/event log the admin monitor
// reads. Split from router.ts (600-LOC rule).
//
// NOTE: the penalty box and health/event log still live purely per server
// instance — short-lived (30s) or monitoring-only, so losing them on restart
// or under multi-instance fan-out is cheap and stays that way on purpose.
// The daily-exhaustion map (below) is different: it's expensive to
// rediscover (one real, if fast-failing, upstream call per provider) and
// restart-prone in practice (a dev server gets restarted many times across a
// session) — so it's now backed by a `ai_daily_exhaustion` Supabase row
// (0028_ai_daily_exhaustion.sql), reusing the project's existing DB rather
// than adding new infra. This never costs the hot path anything: reads stay
// fully synchronous against the in-memory map exactly as before (hydrated
// from Supabase once, best-effort, in the background at module load — never
// awaited by a request), and writes are fire-and-forget on the rare real
// exhaustion event, never blocking or throwing into the caller. If Supabase
// is unreachable or unconfigured, this degrades to exactly the old
// per-instance-only behavior — never worse, never blocking.

import { createClient as createServiceClient, type SupabaseClient } from '@supabase/supabase-js'
import { TARGETS, targetName, type ProviderId, type Target } from './router-config'
import { log } from '@/lib/log'

// ── Groq penalty box ──────────────────────────────────────────────────────────
// A Groq 429 is read as an *org-wide* block: real-time traffic skips Groq for
// 30s, then returns on the safer fallback model until one success clears it.

const GROQ_PENALTY_MS = 30_000

let groqPenaltyUntil = 0
let groqRecovering = false

export function groqCoolingDown(): boolean {
  return Date.now() < groqPenaltyUntil
}
export function openGroqPenalty(): void {
  groqPenaltyUntil = Date.now() + GROQ_PENALTY_MS
  groqRecovering = true
}
export function clearGroqRecovering(): void {
  groqRecovering = false
}
export function groqState(): { penaltyUntil: number; recovering: boolean } {
  return { penaltyUntil: groqPenaltyUntil, recovering: groqRecovering }
}
// Which Groq target the real-time lane should address right now.
export function currentGroqTarget(): Target {
  return groqRecovering ? TARGETS.groqGptOss20b : TARGETS.groqQwen
}

// ── Daily blackout airbag (per provider) ──────────────────────────────────────
// Tracked as the UTC date each provider tripped its daily quota, so entries
// auto-clear at day rollover without a timer. One provider's daily limit no
// longer reads as a fleet-wide blackout: the exhausted provider is skipped for
// the day, and OpenRouter fires only when a whole lane is exhausted.

const dailyExhausted = new Map<ProviderId, string>()

export function todayUTC(): string {
  return new Date().toISOString().slice(0, 10)
}
export function providerDailyExhausted(p: ProviderId): boolean {
  return dailyExhausted.get(p) === todayUTC()
}
// True when ANY provider is daily-exhausted today (monitor signal, not routing).
export function dailyLimitsExhausted(): boolean {
  return dailyExhaustedProviders().length > 0
}
export function dailyExhaustedProviders(): string[] {
  return [...dailyExhausted.entries()].filter(([, d]) => d === todayUTC()).map(([p]) => p)
}
export function markDailyExhausted(p: ProviderId): void {
  dailyExhausted.set(p, todayUTC())
  log.error('ai', 'daily quota exhausted — skipping until UTC midnight', { provider: p })
  void persistDailyExhausted(p)
}

// ── Supabase-backed persistence for the daily-exhaustion map ──────────────────
// Hard-gated on process.env.VITEST (set automatically by the test runner,
// zero config needed): this table is real shared production state, and a
// test throwing a fake daily-quota error must never be able to write to it —
// not "probably won't because .env isn't loaded in tests," but categorically
// can't, regardless of what happens to be in the environment. Also skips
// cleanly (same as the old per-instance-only behavior) if the service-role
// key isn't configured at all, e.g. a contributor's local .env without it.
function testEnv(): boolean {
  return Boolean(process.env.VITEST)
}

let service: SupabaseClient | null = null
function serviceClient(): SupabaseClient | null {
  if (testEnv()) return null
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null
  if (!service) {
    service = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } }
    )
  }
  return service
}

// Fire-and-forget: called from markDailyExhausted, never awaited by it, never
// throws into the caller. Losing this write (Supabase down, RLS misconfigured,
// whatever) just means the NEXT process restart re-discovers the exhaustion
// itself, same as today — never a functional regression, only a missed
// optimization.
async function persistDailyExhausted(p: ProviderId): Promise<void> {
  const client = serviceClient()
  if (!client) return
  try {
    const { error } = await client
      .from('ai_daily_exhaustion')
      .upsert({ provider: p, day: todayUTC() }, { onConflict: 'provider,day', ignoreDuplicates: true })
    if (error) throw error
  } catch (err) {
    log.error('ai/router-state', 'failed to persist daily exhaustion (non-fatal)', {
      provider: p,
      error: (err as Error)?.message,
    })
  }
}

// Runs once per process, fired at module load (below) — never awaited by a
// request, so it costs the hot path nothing. Best-effort: any failure here
// (missing config, network, RLS) just leaves the in-memory map empty exactly
// like before this change existed. The rare request that races ahead of a
// slow hydration on a cold start sees one extra real (fast-failing) upstream
// call, self-healing since that call re-marks the provider anyway.
let hydrated: Promise<void> | null = null
function ensureHydrated(): Promise<void> {
  if (hydrated) return hydrated
  hydrated = (async () => {
    const client = serviceClient()
    if (!client) return
    try {
      const { data, error } = await client
        .from('ai_daily_exhaustion')
        .select('provider, day')
        .eq('day', todayUTC())
      if (error) throw error
      for (const row of data ?? []) {
        dailyExhausted.set(row.provider as ProviderId, row.day as string)
      }
    } catch (err) {
      log.error('ai/router-state', 'daily-exhaustion hydration failed, starting empty (non-fatal)', {
        error: (err as Error)?.message,
      })
    }
  })()
  return hydrated
}
void ensureHydrated()

// ── Passive health / event log (feeds the admin monitor) ──────────────────────
// Near-zero-cost health derived from real traffic: every attempt records its
// last outcome per target. The monitor reads the snapshot; the per-model detail
// page reads the ring buffer.

export type TargetStatus = 'ok' | 'rate_limited' | 'daily' | 'error' | 'unknown'

export interface TargetHealth {
  provider: ProviderId
  model: string
  keyEnv: string
  configured: boolean
  contextWindow: number
  lastStatus: TargetStatus
  lastDetail?: string
  lastAt?: number // epoch ms of the last observation
  okCount: number
  failCount: number
}

export interface LogEvent {
  at: number // epoch ms
  kind: TargetStatus
  source: 'traffic' | 'probe'
  detail?: string
  latencyMs?: number
}
const EVENT_CAP = 50

const health = new Map<string, TargetHealth>()
const events = new Map<string, LogEvent[]>()

export function record(
  t: Target,
  status: TargetStatus,
  detail?: string,
  latencyMs?: number,
  source: 'traffic' | 'probe' = 'traffic'
): void {
  const key = targetName(t)
  const h: TargetHealth = health.get(key) ?? {
    provider: t.provider,
    model: t.model,
    keyEnv: t.keyEnv,
    configured: Boolean(process.env[t.keyEnv]),
    contextWindow: t.contextWindow,
    lastStatus: 'unknown',
    okCount: 0,
    failCount: 0,
  }
  h.lastStatus = status
  h.lastDetail = detail
  h.lastAt = Date.now()
  h.configured = Boolean(process.env[t.keyEnv])
  if (status === 'ok') h.okCount += 1
  else h.failCount += 1
  health.set(key, h)

  const log = events.get(key) ?? []
  log.push({ at: Date.now(), kind: status, source, detail, latencyMs })
  if (log.length > EVENT_CAP) log.shift()
  events.set(key, log)
}

export function healthFor(t: Target): TargetHealth {
  const h = health.get(targetName(t))
  return {
    provider: t.provider,
    model: t.model,
    keyEnv: t.keyEnv,
    configured: Boolean(process.env[t.keyEnv]),
    contextWindow: t.contextWindow,
    lastStatus: h?.lastStatus ?? 'unknown',
    lastDetail: h?.lastDetail,
    lastAt: h?.lastAt,
    okCount: h?.okCount ?? 0,
    failCount: h?.failCount ?? 0,
  }
}

export function eventsFor(name: string): LogEvent[] {
  return (events.get(name) ?? []).slice()
}

// Test-only: reset every piece of module-global routing state.
export function __resetRoutingState(): void {
  groqPenaltyUntil = 0
  groqRecovering = false
  dailyExhausted.clear()
  health.clear()
  events.clear()
  hydrated = null
  service = null
}
