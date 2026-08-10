// Observability surface of the routing engine: the passive snapshot the admin
// monitor renders, the active per-target probes, and the per-model detail.
// Split from router.ts (600-LOC rule). Reads state from router-state and
// targets/clients from router-config; the engine (router.ts) re-exports this
// module's public API so existing '@/lib/ai/router' imports keep working.

import { clientFor, TARGETS, targetName, type ProviderId, type Target } from './router-config'
import {
  currentGroqTarget,
  dailyExhaustedProviders,
  dailyLimitsExhausted,
  eventsFor,
  groqCoolingDown,
  groqState,
  healthFor,
  record,
  type LogEvent,
  type TargetHealth,
} from './router-state'
import { isDailyQuota, reasoningEffortFor, statusOf, supportsJsonSchema } from './router-shared'

export interface LaneStep {
  label: string
  provider: ProviderId
  model: string
  keyEnv: string
  configured: boolean
  contextWindow: number
  note?: string
}
function laneStep(label: string, t: Target, note?: string): LaneStep {
  return {
    label,
    provider: t.provider,
    model: t.model,
    keyEnv: t.keyEnv,
    configured: Boolean(process.env[t.keyEnv]),
    contextWindow: t.contextWindow,
    note,
  }
}

export interface RouterSnapshot {
  now: number
  lanes: {
    suggestor: LaneStep[] // sidebar suggestions — Cerebras-first
    realtime: LaneStep[] // coach | critic
    drafter: LaneStep[]
    swarm: LaneStep[] // reasoning pipeline only — DeepInfra-first
    synthesis: LaneStep[] // reasoning pipeline only — final composition
  }
  groq: {
    coolingDown: boolean
    penaltyUntil: number
    msRemaining: number
    recovering: boolean
    currentModel: string
  }
  dailyLimitsExhausted: boolean
  // Which providers tripped their daily quota today (per-instance signal).
  dailyExhaustedProviders: string[]
  targets: TargetHealth[]
}

// The intended failover chains (nominal order). Single source of truth reused by
// both the snapshot and the per-model detail (so neighbours/transitions line up).
function buildLanes(): {
  suggestor: LaneStep[]
  realtime: LaneStep[]
  drafter: LaneStep[]
  swarm: LaneStep[]
  synthesis: LaneStep[]
} {
  return {
    suggestor: [
      laneStep('Primary — ultra-fast', TARGETS.cerebrasGptOss120b),
      laneStep('Fallback (Cerebras 429)', TARGETS.mistral8b),
      laneStep('Fallback (Mistral 429)', TARGETS.groqQwen, 'post-cooldown → gpt-oss-20b'),
      laneStep('Shock absorber (Groq cooling / 429)', TARGETS.geminiFlash),
    ],
    realtime: [
      laneStep('Primary', TARGETS.mistral8b),
      laneStep('Paid relief valve (Mistral 429)', TARGETS.deepinfra),
      laneStep('Secondary (DeepInfra failure)', TARGETS.groqQwen, 'post-cooldown → gpt-oss-20b'),
      laneStep('Shock absorber (Groq cooling)', TARGETS.geminiFlash),
      laneStep('Multi-throttle bridge (Google 429)', TARGETS.cerebrasGptOss120b),
    ],
    drafter: [
      laneStep('Primary — strict json_schema', TARGETS.groqGptOss20b),
      laneStep('Fallback (Groq cooling / 429) — large context', TARGETS.geminiFlash),
      laneStep('Fallback (Gemini 429)', TARGETS.cerebrasGptOss120b),
    ],
    // Reasoning pipeline only (lib/ai/reasoning/*) — every generate/review call
    // except final composition. See router.ts's swarmAttempts().
    swarm: [
      laneStep('Primary — paid, highest-volume traffic', TARGETS.deepinfra),
      laneStep('Burst absorber (DeepInfra failure)', TARGETS.groqGptOss20b, 'skipped while Groq is cooling'),
      laneStep('Fallback (Groq unavailable)', TARGETS.geminiFlash),
      laneStep('Fallback (Gemini 429)', TARGETS.mistral8b),
      laneStep('Fallback (Mistral 429)', TARGETS.cerebrasGptOss120b),
    ],
    // Reasoning pipeline only, final-composition step ONLY. See router.ts's
    // synthesisAttempts().
    synthesis: [
      laneStep('Primary', TARGETS.groqGptOss20b, 'skipped while Groq is cooling'),
      laneStep('Fallback (Groq unavailable)', TARGETS.deepinfra),
      laneStep('Fallback (DeepInfra 429)', TARGETS.geminiFlash),
      laneStep('Fallback (Gemini 429)', TARGETS.mistral8b),
      laneStep('Fallback (Mistral 429)', TARGETS.cerebrasGptOss120b),
    ],
  }
}

// The intended failover chains (nominal order) plus current live state. Reflects
// "how the router is working" without firing any request.
export function getRouterSnapshot(): RouterSnapshot {
  const now = Date.now()
  const { penaltyUntil, recovering } = groqState()
  const targets: TargetHealth[] = (Object.values(TARGETS) as Target[]).map(healthFor)
  return {
    now,
    lanes: buildLanes(),
    groq: {
      coolingDown: groqCoolingDown(),
      penaltyUntil,
      msRemaining: Math.max(0, penaltyUntil - now),
      recovering,
      currentModel: currentGroqTarget().model,
    },
    dailyLimitsExhausted: dailyLimitsExhausted(),
    dailyExhaustedProviders: dailyExhaustedProviders(),
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

// A minimal schema so probes exercise the SAME structured-output shape live
// traffic sends each target (json_schema for gpt-oss, json_object elsewhere).
// A target that 400s on structured output — or a sunset model id — now shows
// ERROR here instead of probing UP while failing every real request.
const PROBE_JSON_SCHEMA = {
  type: 'object',
  properties: { ok: { type: 'boolean' } },
  required: ['ok'],
  additionalProperties: false,
} as const

// Active liveness check on ONE target: fires a tiny completion, shaped like real
// traffic, and classifies the result. Unlike the live traffic path it
// deliberately does NOT open the penalty box or flip the daily flag (a
// diagnostic must not perturb routing), but it DOES log an event so the detail
// page shows probe history.
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
  const response_format = supportsJsonSchema(t.model)
    ? { type: 'json_schema' as const, json_schema: { name: 'probe', schema: PROBE_JSON_SCHEMA } }
    : { type: 'json_object' as const }
  try {
    await client.chat.completions.create(
      {
        model: t.model,
        // Enough room for reasoning models to still emit the JSON.
        max_tokens: 64,
        response_format,
        ...(effort ? { reasoning_effort: effort } : {}),
        messages: [{ role: 'user', content: 'Reply with exactly this JSON object: {"ok":true}' }],
      } as Parameters<typeof client.chat.completions.create>[0],
      { timeout: 8_000 }
    )
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
  lane: 'suggestor' | 'realtime' | 'drafter' | 'swarm' | 'synthesis'
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
  for (const laneName of ['suggestor', 'realtime', 'drafter', 'swarm', 'synthesis'] as const) {
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
    events: eventsFor(name),
    positions,
  }
}
