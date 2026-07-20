// Module-global routing state: the Groq penalty box, the per-provider daily
// quota map, and the passive per-target health/event log the admin monitor
// reads. Split from router.ts (600-LOC rule).
//
// NOTE: all of this lives per server instance. On Vercel's serverless runtime
// each instance keeps its own penalty box / daily map / health log, so under
// heavy fan-out the signal is local, not global. That is acceptable — it only
// ever degrades toward a *safer* lane, never starves one — and needs no extra
// infra. Swap for a shared store (Redis / a Supabase row) if a truly global
// signal is ever required.

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
}

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
}
