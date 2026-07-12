// Multi-LLM API Routing Engine (server-only).
//
// One controller owns provider selection, structured-output plumbing, the Groq
// 30-second penalty box, the daily-blackout airbag, and error mapping. Every AI
// route calls `completeJSON` with a `role`; the role decides which failover lane
// the request rides. See decisions/006 (model choice) and 012 (failover). The
// former Groq-only two-tier wrapper (lib/ai/groq.ts) now re-exports from here.
//
// Two lanes, keyed by role:
//
//   SIDEBAR SUGGESTIONS  (suggestor)
//   The most latency-sensitive surface, so it leads with Cerebras' ultra-fast
//   custom hardware, then falls onto the real-time resilience tail.
//     1. Cerebras  gpt-oss-120b           (primary — ultra-fast)
//     2. Mistral   ministral-8b-latest    (on Cerebras 429)
//     3. Groq      qwen3.6-27b            (on Mistral 429)  ── stateful, see below
//     4. Google    gemini-2.5-flash       (while Groq cools / on Groq 429)
//
//   REAL-TIME BACKGROUND  (coach | critic)
//   Latency-sensitive background events fired by user activity. Kept off the big
//   models to preserve the shared Mistral 50k TPM budget.
//     1. Mistral   ministral-8b-latest    (primary)
//     2. Groq      qwen3.6-27b            (on Mistral 429)  ── stateful, see below
//     3. Google    gemini-2.5-flash       (while Groq cools / on Groq 429)
//     4. Cerebras  gpt-oss-120b           (multi-throttle bridge, on Google 429)
//
//   ON-DEMAND COMPLEX  (drafter)
//   Heavy framework generation. Uses Gemini's large context + 1,500/day budget.
//     1. Google    gemini-2.5-flash       (primary)
//     2. Cerebras  gpt-oss-120b           (on Gemini 429)
//
// Groq is special. A Groq 429 is read as an *org-wide* block, so we do NOT
// immediately hop to gpt-oss-20b on the same account. Instead we open a strict
// 30s penalty box: while it is open, real-time traffic skips Groq entirely and
// diverts to Google (then Cerebras). Once the window clears, Groq is allowed
// again but on the safer fallback model gpt-oss-20b until one call succeeds.
//
// Airbag: OpenRouter / GitHub Models stay completely isolated. A per-second or
// per-minute 429 NEVER reaches them. Only a verified daily-quota exhaustion flips
// the global `dailyLimitsExhausted` flag, after which OpenRouter's free model is
// the terminal safety net for the rest of the (UTC) day.
//
// Cascade discipline: only an HTTP 429 advances to the next provider. Every other
// error (401 / 400 / 5xx / network) is thrown immediately so a misconfiguration
// or upstream outage surfaces instead of silently draining the whole chain.

import OpenAI from 'openai'
import { z } from 'zod'

// Fail loudly if this module is ever pulled into a client bundle — the API keys
// must never ship to the browser.
if (typeof window !== 'undefined') {
  throw new Error('lib/ai/router.ts is server-only and must not run in the browser')
}

// Carries an HTTP status so routes can echo it straight back to the client.
export class AiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message)
    this.name = 'AiError'
  }
}

export type AiRole = 'coach' | 'critic' | 'suggestor' | 'drafter'

// ── Provider configuration ────────────────────────────────────────────────────
// Each provider contributes only a base URL. A routing *target* pairs a model
// with the exact env var holding that model's key — the .env vars are named after
// the specific keys they carry, so every model authenticates with its own key
// (Groq's two models therefore use two distinct keys on the same base URL). Base
// URLs, model IDs, and key env-var names are all overridable via env.

type ProviderId = 'mistral' | 'groq' | 'google' | 'cerebras' | 'openrouter'

const BASE_URLS: Record<ProviderId, string> = {
  mistral: process.env.MISTRAL_BASE_URL ?? 'https://api.mistral.ai/v1',
  groq: process.env.GROQ_BASE_URL ?? 'https://api.groq.com/openai/v1',
  google:
    process.env.GEMINI_BASE_URL ??
    'https://generativelanguage.googleapis.com/v1beta/openai/',
  cerebras: process.env.CEREBRAS_BASE_URL ?? 'https://api.cerebras.ai/v1',
  openrouter: process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1',
}

// A concrete place to send a request: which provider, which model, and the env
// var holding that model's key.
interface Target {
  provider: ProviderId
  model: string
  keyEnv: string
}

const TARGETS = {
  mistral8b: {
    provider: 'mistral',
    model: process.env.MISTRAL_MODEL ?? 'ministral-8b-latest',
    keyEnv: process.env.MISTRAL_KEY_ENV ?? 'MISTRAL_MINISTRAL_8B_API_KEY',
  },
  groqQwen: {
    provider: 'groq',
    model: process.env.GROQ_QWEN_MODEL ?? 'qwen/qwen3.6-27b',
    keyEnv: process.env.GROQ_QWEN_KEY_ENV ?? 'GROQ_QWEN_3_POINT_6_27B_API_KEY',
  },
  groqGptOss20b: {
    provider: 'groq',
    model: process.env.GROQ_GPT_OSS_MODEL ?? 'openai/gpt-oss-20b',
    keyEnv: process.env.GROQ_GPT_OSS_KEY_ENV ?? 'GROQ_OPENAI_GPT_OSS_20B_API_KEY',
  },
  geminiFlash: {
    provider: 'google',
    model: process.env.GEMINI_FLASH_MODEL ?? 'gemini-2.5-flash',
    keyEnv: process.env.GEMINI_KEY_ENV ?? 'GEMINI_FLASH_2_POINT_5_API_KEY',
  },
  cerebrasGptOss120b: {
    provider: 'cerebras',
    model: process.env.CEREBRAS_GPT_OSS_MODEL ?? 'gpt-oss-120b',
    keyEnv: process.env.CEREBRAS_KEY_ENV ?? 'CEREBRAS_GPT_OSS_120B_API_KEY',
  },
  openrouterFree: {
    provider: 'openrouter',
    // Free qwen coder. NB: the spec's 'qwen/qwen-2.5-coder-32b:free' is not a real
    // OpenRouter model id (it 400s); the live free coder is 'qwen/qwen3-coder:free'.
    model: process.env.OPENROUTER_FREE_MODEL ?? 'qwen/qwen3-coder:free',
    keyEnv: process.env.OPENROUTER_KEY_ENV ?? 'OPENROUTER_API_KEY',
  },
} satisfies Record<string, Target>

// Lazily built, cached one-per-key. Returns null when the target's key is not
// configured so that target is *skipped* (not treated as a fatal upstream error).
const clients = new Map<string, OpenAI | null>()
function clientFor(target: Target): OpenAI | null {
  if (clients.has(target.keyEnv)) return clients.get(target.keyEnv)!
  const apiKey = process.env[target.keyEnv]
  const client = apiKey
    ? // maxRetries: 0 — the engine's own lane owns failover. We want an instant
      // hop on 429 (not the SDK's Retry-After backoff) and an immediate throw on
      // non-429s, so the SDK must never silently retry the same target.
      new OpenAI({
        apiKey,
        baseURL: BASE_URLS[target.provider],
        timeout: 25_000,
        maxRetries: 0,
      })
    : null
  if (!client) {
    console.error(
      `[ai] no API key at ${target.keyEnv} for ${target.provider}/${target.model} — skipping`
    )
  }
  clients.set(target.keyEnv, client)
  return client
}

// ── Routing state (module-global) ─────────────────────────────────────────────
// NOTE: this lives per server instance. On Vercel's serverless runtime each
// instance keeps its own penalty box / airbag flag, so under heavy fan-out the
// signal is local, not global. That is acceptable — it only ever degrades toward
// a *safer* lane, never starves one — and needs no extra infra. Swap for a shared
// store (Redis / a Supabase row) if a truly global signal is ever required.

const GROQ_PENALTY_MS = 30_000

// While now < groqPenaltyUntil, Groq is in its cooldown box (real-time traffic
// diverts to Google). groqRecovering stays true from the moment a penalty opens
// until the first post-cooldown Groq call succeeds — during that stretch Groq is
// addressed with the safer fallback model gpt-oss-20b.
let groqPenaltyUntil = 0
let groqRecovering = false

function groqCoolingDown(): boolean {
  return Date.now() < groqPenaltyUntil
}
function openGroqPenalty(): void {
  groqPenaltyUntil = Date.now() + GROQ_PENALTY_MS
  groqRecovering = true
}
// Which Groq target the real-time lane should address right now.
function currentGroqTarget(): Target {
  return groqRecovering ? TARGETS.groqGptOss20b : TARGETS.groqQwen
}

// Daily blackout airbag. Stored as the UTC date it was tripped, so it
// auto-clears when the day rolls over without any timer.
let dailyExhaustedOn: string | null = null
function todayUTC(): string {
  return new Date().toISOString().slice(0, 10)
}
export function dailyLimitsExhausted(): boolean {
  return dailyExhaustedOn === todayUTC()
}
function markDailyExhausted(): void {
  dailyExhaustedOn = todayUTC()
  console.error('[ai] daily blackout tripped — OpenRouter airbag armed for today')
}

// ── Observability (for the admin monitor) ─────────────────────────────────────
// Passive, near-zero-cost health derived from real traffic: every attempt records
// its last outcome per target. The admin panel reads this snapshot and can also
// trigger an active probe (probeTargets) for a live up/down check.

export type TargetStatus = 'ok' | 'rate_limited' | 'daily' | 'error' | 'unknown'

export interface TargetHealth {
  provider: ProviderId
  model: string
  keyEnv: string
  configured: boolean
  lastStatus: TargetStatus
  lastDetail?: string
  lastAt?: number // epoch ms of the last observation
  okCount: number
  failCount: number
}

// One recent-event ring buffer per target feeds the per-model detail page's log.
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
function targetName(t: Target): string {
  return `${t.provider}/${t.model}`
}
function record(
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

export interface LaneStep {
  label: string
  provider: ProviderId
  model: string
  keyEnv: string
  configured: boolean
  note?: string
}
function laneStep(label: string, t: Target, note?: string): LaneStep {
  return {
    label,
    provider: t.provider,
    model: t.model,
    keyEnv: t.keyEnv,
    configured: Boolean(process.env[t.keyEnv]),
    note,
  }
}

export interface RouterSnapshot {
  now: number
  lanes: {
    suggestor: LaneStep[] // sidebar suggestions — Cerebras-first
    realtime: LaneStep[] // coach | critic
    drafter: LaneStep[]
  }
  groq: {
    coolingDown: boolean
    penaltyUntil: number
    msRemaining: number
    recovering: boolean
    currentModel: string
  }
  dailyLimitsExhausted: boolean
  targets: TargetHealth[]
}

// The intended failover chains (nominal order). Single source of truth reused by
// both the snapshot and the per-model detail (so neighbours/transitions line up).
function buildLanes(): { suggestor: LaneStep[]; realtime: LaneStep[]; drafter: LaneStep[] } {
  return {
    suggestor: [
      laneStep('Primary — ultra-fast', TARGETS.cerebrasGptOss120b),
      laneStep('Fallback (Cerebras 429)', TARGETS.mistral8b),
      laneStep('Fallback (Mistral 429)', TARGETS.groqQwen, 'post-cooldown → gpt-oss-20b'),
      laneStep('Shock absorber (Groq cooling / 429)', TARGETS.geminiFlash),
    ],
    realtime: [
      laneStep('Primary', TARGETS.mistral8b),
      laneStep('Secondary (Mistral 429)', TARGETS.groqQwen, 'post-cooldown → gpt-oss-20b'),
      laneStep('Shock absorber (Groq cooling)', TARGETS.geminiFlash),
      laneStep('Multi-throttle bridge (Google 429)', TARGETS.cerebrasGptOss120b),
    ],
    drafter: [
      laneStep('Primary', TARGETS.geminiFlash),
      laneStep('Secondary (Gemini 429)', TARGETS.cerebrasGptOss120b),
    ],
  }
}

function healthFor(t: Target): TargetHealth {
  const h = health.get(targetName(t))
  return {
    provider: t.provider,
    model: t.model,
    keyEnv: t.keyEnv,
    configured: Boolean(process.env[t.keyEnv]),
    lastStatus: h?.lastStatus ?? 'unknown',
    lastDetail: h?.lastDetail,
    lastAt: h?.lastAt,
    okCount: h?.okCount ?? 0,
    failCount: h?.failCount ?? 0,
  }
}

// The intended failover chains (nominal order) plus current live state. Reflects
// "how the router is working" without firing any request.
export function getRouterSnapshot(): RouterSnapshot {
  const now = Date.now()
  const targets: TargetHealth[] = (Object.values(TARGETS) as Target[]).map(healthFor)
  return {
    now,
    lanes: buildLanes(),
    groq: {
      coolingDown: groqCoolingDown(),
      penaltyUntil: groqPenaltyUntil,
      msRemaining: Math.max(0, groqPenaltyUntil - now),
      recovering: groqRecovering,
      currentModel: currentGroqTarget().model,
    },
    dailyLimitsExhausted: dailyLimitsExhausted(),
    targets,
  }
}

export interface ProbeResult {
  name: string
  provider: ProviderId
  model: string
  configured: boolean
  up: boolean
  status: 'ok' | 'rate-limited' | 'daily-limit' | 'error' | 'unconfigured'
  detail?: string
  latencyMs: number
}

// Active liveness check on ONE target: fires a tiny (max_tokens: 8) completion and
// classifies the result. Unlike the live traffic path it deliberately does NOT
// open the penalty box or flip the daily flag (a diagnostic must not perturb
// routing), but it DOES log an event so the detail page shows probe history.
async function probeTarget(t: Target): Promise<ProbeResult> {
  const base = {
    name: targetName(t),
    provider: t.provider,
    model: t.model,
    configured: Boolean(process.env[t.keyEnv]),
  }
  const client = clientFor(t)
  if (!client) {
    return { ...base, up: false, status: 'unconfigured', detail: 'no API key', latencyMs: 0 }
  }
  const started = Date.now()
  const effort = reasoningEffortFor(t.model, 'low')
  try {
    await client.chat.completions.create({
      model: t.model,
      max_tokens: 8,
      ...(effort ? { reasoning_effort: effort } : {}),
      messages: [{ role: 'user', content: 'ping' }],
    } as Parameters<typeof client.chat.completions.create>[0])
    const latencyMs = Date.now() - started
    record(t, 'ok', 'probe ok', latencyMs, 'probe')
    return { ...base, up: true, status: 'ok', latencyMs }
  } catch (err) {
    const latencyMs = Date.now() - started
    const s = statusOf(err)
    if (s === 429) {
      const daily = isDailyQuota(err)
      record(t, daily ? 'daily' : 'rate_limited', 'HTTP 429', latencyMs, 'probe')
      return {
        ...base,
        up: false,
        status: daily ? 'daily-limit' : 'rate-limited',
        detail: 'HTTP 429',
        latencyMs,
      }
    }
    const detail = s ? `HTTP ${s}` : ((err as Error)?.message ?? 'network error')
    record(t, 'error', detail, latencyMs, 'probe')
    return { ...base, up: false, status: 'error', detail, latencyMs }
  }
}

// Probe every target (the "Run live check" button). Admin-triggered only.
export async function probeTargets(): Promise<ProbeResult[]> {
  return Promise.all((Object.values(TARGETS) as Target[]).map(probeTarget))
}

// Probe a single target by name (the per-model detail page). Returns null when the
// name matches no configured target.
export async function probeOne(name: string): Promise<ProbeResult | null> {
  const t = (Object.values(TARGETS) as Target[]).find((x) => targetName(x) === name)
  return t ? probeTarget(t) : null
}

// ── Per-model detail (for the model page) ─────────────────────────────────────

export interface LanePosition {
  lane: 'suggestor' | 'realtime' | 'drafter'
  index: number
  total: number
  // The model this one falls back FROM (upstream) / TO (downstream on failure).
  prev: LaneStep | null
  next: LaneStep | null
  // The condition that routes traffic INTO this step (from prev), and onward to
  // next, derived from the lane step labels.
  arriveVia: string
  fallsToVia: string | null
}

export interface TargetDetail {
  found: boolean
  name: string
  health: TargetHealth | null
  events: LogEvent[] // most-recent last
  positions: LanePosition[]
}

// Everything the model page needs: identity, health summary, recent event log, and
// where this model sits in each failover lane (with its neighbours + transitions).
export function getTargetDetail(name: string): TargetDetail {
  const t = (Object.values(TARGETS) as Target[]).find((x) => targetName(x) === name)
  if (!t) return { found: false, name, health: null, events: [], positions: [] }

  const lanes = buildLanes()
  const positions: LanePosition[] = []
  for (const laneName of ['suggestor', 'realtime', 'drafter'] as const) {
    const steps = lanes[laneName]
    const i = steps.findIndex((s) => `${s.provider}/${s.model}` === name)
    if (i < 0) continue
    const next = steps[i + 1] ?? null
    positions.push({
      lane: laneName,
      index: i,
      total: steps.length,
      prev: steps[i - 1] ?? null,
      next,
      arriveVia: steps[i].label,
      fallsToVia: next ? next.label : null,
    })
  }

  return {
    found: true,
    name,
    health: healthFor(t),
    events: (events.get(name) ?? []).slice(),
    positions,
  }
}

// ── Error classification ──────────────────────────────────────────────────────

function statusOf(err: unknown): number | undefined {
  const s = (err as { status?: number })?.status
  return typeof s === 'number' ? s : undefined
}

// Flatten whatever the SDK gives us into searchable text.
function errorText(err: unknown): string {
  const e = err as { message?: string; error?: unknown; code?: string; type?: string }
  let body = ''
  try {
    body = e?.error ? JSON.stringify(e.error) : ''
  } catch {
    body = ''
  }
  return `${e?.message ?? ''} ${e?.code ?? ''} ${e?.type ?? ''} ${body}`
}

// A 429 is only a *daily* blackout when the provider explicitly names a per-day /
// non-resetting quota. Bare "RESOURCE_EXHAUSTED" (Gemini uses it for per-minute
// too) is deliberately treated as transient so OpenRouter stays isolated.
const DAILY_QUOTA_RE =
  /(per[\s-]?day|\bdaily\b|\brpd\b|\btpd\b|requests?\s+per\s+day|tokens?\s+per\s+day|quota.*exhaust|daily\s+quota|free[-\s]?tier.*day)/i
function isDailyQuota(err: unknown): boolean {
  return DAILY_QUOTA_RE.test(errorText(err))
}

// Map a non-429 (or terminal) error onto a status routes can surface.
function mapUpstream(err: unknown, provider: ProviderId): AiError {
  const status = statusOf(err)
  console.error(`[ai] ${provider} error (status ${status ?? 'unknown'})`, err)
  if (status === 401 || status === 403) return new AiError(status, 'ai-unauthorized')
  if (status === 400) return new AiError(400, 'ai-bad-request')
  return new AiError(502, 'ai-upstream-error')
}

// ── Failover plans ────────────────────────────────────────────────────────────

interface Attempt extends Target {
  // Real-time Groq attempts open the penalty box on a (non-daily) 429 instead of
  // hopping straight to another Groq model.
  penaltyOnRateLimit?: boolean
}

// Real-time background lane (coach | critic): Mistral primary, then the Groq
// penalty-aware bridge to Google / Cerebras.
function realtimeAttempts(): Attempt[] {
  const attempts: Attempt[] = [{ ...TARGETS.mistral8b }]
  if (groqCoolingDown()) {
    // Shock absorber: Groq penalty is open — skip it entirely.
    attempts.push({ ...TARGETS.geminiFlash })
    attempts.push({ ...TARGETS.cerebrasGptOss120b })
  } else {
    attempts.push({ ...currentGroqTarget(), penaltyOnRateLimit: true })
    // On a Groq 429 we do not chain to another Groq model; we bridge to Google
    // then Cerebras while the freshly-opened penalty box holds.
    attempts.push({ ...TARGETS.geminiFlash })
    attempts.push({ ...TARGETS.cerebrasGptOss120b })
  }
  return attempts
}

// Sidebar suggestions ride an ultra-fast Cerebras-first lane — its custom hardware
// is the lowest-latency target, and suggestions are the most latency-sensitive
// surface. On a Cerebras 429 it falls onto the standard real-time resilience tail
// (Mistral → Groq → Google), sharing the same Groq penalty box.
function suggestorAttempts(): Attempt[] {
  const attempts: Attempt[] = [{ ...TARGETS.cerebrasGptOss120b }, { ...TARGETS.mistral8b }]
  if (groqCoolingDown()) {
    attempts.push({ ...TARGETS.geminiFlash })
  } else {
    attempts.push({ ...currentGroqTarget(), penaltyOnRateLimit: true })
    attempts.push({ ...TARGETS.geminiFlash })
  }
  return attempts
}

// Built fresh per request so it reflects current penalty-box / recovery state.
function attemptsForRole(role: AiRole): Attempt[] {
  if (role === 'drafter') {
    return [{ ...TARGETS.geminiFlash }, { ...TARGETS.cerebrasGptOss120b }]
  }
  if (role === 'suggestor') return suggestorAttempts()
  return realtimeAttempts() // coach | critic
}

// ── Structured-output helpers ─────────────────────────────────────────────────

// Groq's strict json_schema structured output is only reliable on the gpt-oss
// family here; everything else uses json_object (schema embedded in the prompt).
function supportsJsonSchema(model: string): boolean {
  return model.includes('gpt-oss')
}

// reasoning_effort's vocabulary is per-model and a mismatch is a hard 400 (which
// would NOT fall through — it surfaces as an error). gpt-oss takes low|high; the
// qwen *reasoning* models (e.g. qwen3.6-27b) take none|default. Everything else —
// Mistral, Gemini, and qwen *coder* models (qwen3-coder / qwen-2.5-coder) — accept
// no such field, so we omit it (undefined). Excluding 'coder' is what keeps the
// OpenRouter airbag from 400-ing.
function reasoningEffortFor(model: string, effort: 'low' | 'high'): string | undefined {
  if (model.includes('gpt-oss')) return effort
  if (model.includes('qwen') && !model.includes('coder')) {
    return effort === 'high' ? 'default' : 'none'
  }
  return undefined
}

// ── Execution ─────────────────────────────────────────────────────────────────

interface ExecuteOpts {
  system: string
  user: string
  jsonSchema: Record<string, unknown>
  schemaName: string
  effort: 'low' | 'high'
  maxTokens: number
}

// Send one prompt down the role's failover chain. Returns raw content from the
// first provider that answers. Only 429s advance; a daily 429 arms the airbag; a
// Groq 429 opens the penalty box. Non-429s throw immediately.
async function execute(role: AiRole, opts: ExecuteOpts): Promise<string> {
  const attempts = attemptsForRole(role)
  let last429: AiError | null = null
  let anyProviderTried = false

  for (const attempt of attempts) {
    const client = clientFor(attempt)
    if (!client) continue // no key → skip, don't abort
    anyProviderTried = true
    const started = Date.now()
    try {
      const content = await callProvider(client, attempt, opts)
      if (attempt.provider === 'groq') groqRecovering = false // healthy again
      record(attempt, 'ok', undefined, Date.now() - started)
      return content
    } catch (err) {
      if (err instanceof AiError) throw err // e.g. empty output — terminal
      const latencyMs = Date.now() - started
      if (statusOf(err) === 429) {
        last429 = new AiError(429, 'ai-rate-limited')
        const daily = isDailyQuota(err)
        record(attempt, daily ? 'daily' : 'rate_limited', 'HTTP 429', latencyMs)
        if (daily) markDailyExhausted()
        else if (attempt.penaltyOnRateLimit) openGroqPenalty()
        continue // only a 429 cascades
      }
      record(attempt, 'error', statusOf(err) ? `HTTP ${statusOf(err)}` : 'network', latencyMs)
      throw mapUpstream(err, attempt.provider) // 401 / 400 / 5xx / network
    }
  }

  // Terminal airbag: every primary provider is rate-limited AND we are in a
  // verified daily blackout. Only now may OpenRouter (kept isolated otherwise)
  // catch the request.
  if (dailyLimitsExhausted()) {
    const client = clientFor(TARGETS.openrouterFree)
    if (client) {
      try {
        const content = await callProvider(client, { ...TARGETS.openrouterFree }, opts)
        record(TARGETS.openrouterFree, 'ok')
        return content
      } catch (err) {
        if (err instanceof AiError) throw err
        if (statusOf(err) === 429) {
          record(TARGETS.openrouterFree, 'rate_limited', 'HTTP 429')
          throw new AiError(429, 'ai-rate-limited')
        }
        record(TARGETS.openrouterFree, 'error', statusOf(err) ? `HTTP ${statusOf(err)}` : 'network')
        throw mapUpstream(err, 'openrouter')
      }
    }
  }

  if (!anyProviderTried) throw new AiError(500, 'ai-not-configured')
  throw last429 ?? new AiError(429, 'ai-rate-limited')
}

async function callProvider(
  client: OpenAI,
  attempt: Attempt,
  opts: ExecuteOpts
): Promise<string> {
  const useJsonSchema = supportsJsonSchema(attempt.model)
  const systemContent = useJsonSchema
    ? opts.system
    : `${opts.system}\n\nRespond with a single JSON object and nothing else. It must conform to this JSON Schema:\n${JSON.stringify(opts.jsonSchema)}`
  const response_format = useJsonSchema
    ? ({
        type: 'json_schema' as const,
        json_schema: { name: opts.schemaName, schema: opts.jsonSchema },
      })
    : ({ type: 'json_object' as const })
  const reasoning_effort = reasoningEffortFor(attempt.model, opts.effort)

  const completion = await client.chat.completions.create({
    model: attempt.model,
    max_tokens: opts.maxTokens,
    response_format,
    // reasoning_effort is only accepted by some models; omit it elsewhere.
    ...(reasoning_effort ? { reasoning_effort } : {}),
    messages: [
      { role: 'system', content: systemContent },
      { role: 'user', content: opts.user },
    ],
  } as Parameters<typeof client.chat.completions.create>[0])

  const content = (completion as OpenAI.Chat.Completions.ChatCompletion).choices[0]
    ?.message?.content
  if (!content) throw new AiError(502, 'ai-empty-output')
  return content
}

// ── Public facade ─────────────────────────────────────────────────────────────

export async function completeJSON<T>(opts: {
  role: AiRole // decides the failover lane
  system: string
  user: string
  schema: z.ZodType<T> // zod schema; also converted to JSON Schema below
  schemaName: string // response_format json_schema name (a-z, 0-9, _, -)
  effort: 'low' | 'high' // maps to reasoning_effort where the model accepts it
  maxTokens: number
}): Promise<T> {
  const jsonSchema = z.toJSONSchema(opts.schema, { target: 'draft-7' }) as Record<
    string,
    unknown
  >
  const base: ExecuteOpts = {
    system: opts.system,
    user: opts.user,
    jsonSchema,
    schemaName: opts.schemaName,
    effort: opts.effort,
    maxTokens: opts.maxTokens,
  }

  function tryParse(raw: string): { ok: true; value: T } | { ok: false; error: string } {
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      return { ok: false, error: 'response was not valid JSON' }
    }
    const result = opts.schema.safeParse(parsed)
    if (result.success) return { ok: true, value: result.data }
    return { ok: false, error: result.error.message }
  }

  // Ask once; on schema-parse failure, ask again with the validation error
  // appended so the model can self-correct. Then give up.
  const first = tryParse(await execute(opts.role, base))
  if (first.ok) return first.value

  const retryUser = `${opts.user}\n\nYour previous reply did not match the required schema (${first.error}). Reply again with only valid JSON that matches the schema.`
  const second = tryParse(await execute(opts.role, { ...base, user: retryUser }))
  if (second.ok) return second.value

  throw new AiError(502, 'ai-invalid-output')
}

// Test-only hook: reset module-global routing state between cases.
export function __resetRouterState(): void {
  groqPenaltyUntil = 0
  groqRecovering = false
  dailyExhaustedOn = null
  clients.clear()
  health.clear()
  events.clear()
}
