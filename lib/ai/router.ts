// Multi-LLM API Routing Engine (server-only) — the execution core and public
// facade. One controller owns provider selection, structured-output plumbing,
// the Groq 30-second penalty box, the daily-blackout airbag, and error mapping.
// Every AI route calls `completeJSON` with a `role`; the role decides which
// failover lane the request rides. See decisions/006 (model choice), 012
// (failover), 013 (multi-provider).
//
// The module is split to honor the repo's 600-LOC rule; this file re-exports
// the whole public API so callers import only '@/lib/ai/router':
//   router-shared.ts  — AiError/AiRole, error classification, model quirks
//   router-config.ts  — providers, targets, client construction (+ test seam)
//   router-state.ts   — penalty box, per-provider daily map, health/event log
//   router-monitor.ts — admin snapshot, probes, per-model detail
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
//   Heavy framework generation. Uses Gemini's large context + daily budget.
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
// per-minute 429 NEVER reaches them. Daily-quota exhaustion is tracked PER
// PROVIDER (UTC day): an exhausted provider is skipped for the rest of the day,
// and only when EVERY configured, size-adequate target in the attempted lane is
// daily-exhausted does OpenRouter's free model catch the request.
//
// Context window: each target declares one. We estimate a call's need (input +
// output + headroom) and SKIP any target too small for it, so a large request
// (e.g. a long context-intake interview) automatically lands on Gemini's ~1M
// window instead of 400-ing on an 8-128k model. A genuine overflow error is also
// caught and escalated to the next larger-window target rather than surfaced.
//
// Cascade discipline: 429s, context overflows, 5xx, timeouts / network errors,
// sunset-model 404s, and empty generations all advance to the next target —
// provider incidents are exactly what a multi-target lane exists to survive.
// Only a misconfiguration-shaped error (400 / 401 / 403) is thrown immediately so
// a genuine bug surfaces instead of being retried at full price four times.
// Latency: every attempt carries a per-role timeout and the chain a shared
// deadline (ATTEMPT_TIMEOUT_MS / CHAIN_DEADLINE_MS) so one slow-but-alive
// provider cannot eat the route's entire 30s serverless budget.

import type OpenAI from 'openai'
import { z } from 'zod'
import {
  AiError,
  estimateTokens,
  isContextOverflow,
  isDailyQuota,
  mapUpstream,
  reasoningEffortFor,
  statusOf,
  supportsJsonSchema,
  TOKEN_SAFETY_MARGIN,
  type AiRole,
} from './router-shared'
import { clientFor, TARGETS, __resetClients, __setClientFactory, type Target } from './router-config'
import {
  clearGroqRecovering,
  currentGroqTarget,
  groqCoolingDown,
  markDailyExhausted,
  openGroqPenalty,
  providerDailyExhausted,
  record,
  __resetRoutingState,
} from './router-state'

// Fail loudly if this module is ever pulled into a client bundle — the API keys
// must never ship to the browser.
if (typeof window !== 'undefined') {
  throw new Error('lib/ai/router.ts is server-only and must not run in the browser')
}

// ── Public facade re-exports ──────────────────────────────────────────────────

export { AiError, type AiRole } from './router-shared'
export { __setClientFactory } from './router-config'
export {
  dailyLimitsExhausted,
  dailyExhaustedProviders,
  type TargetStatus,
  type TargetHealth,
  type LogEvent,
} from './router-state'
export {
  getRouterSnapshot,
  probeTargets,
  probeOne,
  getTargetDetail,
  type RouterSnapshot,
  type LaneStep,
  type ProbeResult,
  type LanePosition,
  type TargetDetail,
} from './router-monitor'

// ── Latency budgets ───────────────────────────────────────────────────────────
// One slow-but-alive target must not eat the whole serverless budget
// (maxDuration = 30 on every AI route). A timed-out attempt surfaces as a
// no-status error and cascades like any transient failure — so the penalty box
// and health log still see it, unlike a platform kill. The chain-wide deadline
// is shared across completeJSON's parse-retry too, leaving ~4s headroom for
// response serialization.
const ATTEMPT_TIMEOUT_MS: Record<AiRole, number> = {
  suggestor: 8_000,
  coach: 8_000,
  critic: 8_000,
  drafter: 20_000,
}
const CHAIN_DEADLINE_MS = 26_000

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

// ── Execution ─────────────────────────────────────────────────────────────────

interface ExecuteOpts {
  system: string
  user: string
  jsonSchema: Record<string, unknown>
  schemaName: string
  effort: 'low' | 'high'
  maxTokens: number
  neededTokens: number // estimated input + output; drives size-aware routing
  deadlineAt: number //  epoch ms; shared across the parse-retry (see completeJSON)
}

// Send one prompt down the role's failover chain. Returns raw content from the
// first provider that answers.
//   - Size: a target whose context window is smaller than the estimated need is
//     skipped, so a large request automatically lands on the 1M-token Gemini.
//   - 429: advances to the next target; a daily 429 marks THAT provider
//     exhausted for the day, a Groq 429 opens the penalty box.
//   - Context overflow (400/413/422 "too long"): escalates to the next
//     larger-window target instead of surfacing as a bug.
//   - 5xx / timeout / network / sunset-model 404 / empty generation: transient
//     provider incidents — advance the chain.
//   - 400 / 401 / 403: misconfiguration-shaped — thrown immediately.
//   - Deadline: attempts stop once opts.deadlineAt passes, throwing the most
//     actionable error seen, so a slow chain degrades instead of platform-killing.
async function execute(role: AiRole, opts: ExecuteOpts): Promise<string> {
  const attempts = attemptsForRole(role)
  let last429: AiError | null = null
  let lastTransient: AiError | null = null
  let anyProviderTried = false
  let skippedForSize = false
  let skippedForDaily = false
  let overflowSeen = false
  let deadlineHit = false
  // Falsified by any non-daily failure; while true (and something was relevant),
  // the whole lane is verified daily-exhausted and the airbag may fire.
  let laneAllDaily = true

  for (const attempt of attempts) {
    if (Date.now() >= opts.deadlineAt) {
      deadlineHit = true
      break
    }
    if (opts.neededTokens > attempt.contextWindow) {
      skippedForSize = true // input too big for this model — try a larger window
      continue
    }
    if (providerDailyExhausted(attempt.provider)) {
      skippedForDaily = true // known-exhausted today; don't burn latency on it
      continue
    }
    const client = clientFor(attempt)
    if (!client) continue // no key → skip, don't abort
    anyProviderTried = true
    const started = Date.now()
    const timeoutMs = Math.max(
      1_000,
      Math.min(ATTEMPT_TIMEOUT_MS[role], opts.deadlineAt - Date.now())
    )
    try {
      const content = await callProvider(client, attempt, opts, timeoutMs)
      if (attempt.provider === 'groq') clearGroqRecovering() // healthy again
      record(attempt, 'ok', undefined, Date.now() - started)
      return content
    } catch (err) {
      const latencyMs = Date.now() - started
      // An empty generation is provider flakiness (Groq's json_validate_failed
      // pattern returns exactly this), not caller error — cascade past it.
      if (err instanceof AiError && err.message === 'ai-empty-output') {
        laneAllDaily = false
        lastTransient = err
        record(attempt, 'error', 'empty-output', latencyMs)
        continue
      }
      if (err instanceof AiError) throw err // defensive; none expected here
      const s = statusOf(err)
      if (s === 429) {
        last429 = new AiError(429, 'ai-rate-limited')
        const daily = isDailyQuota(err)
        record(attempt, daily ? 'daily' : 'rate_limited', 'HTTP 429', latencyMs)
        if (daily) {
          markDailyExhausted(attempt.provider)
        } else {
          laneAllDaily = false
          if (attempt.penaltyOnRateLimit) openGroqPenalty()
        }
        continue
      }
      if (isContextOverflow(err)) {
        overflowSeen = true
        laneAllDaily = false
        record(attempt, 'error', 'context-overflow', latencyMs)
        continue // escalate to the next larger-window target
      }
      // Transient provider incidents: 5xx, no-status (SDK timeout / network),
      // and 404 (a sunset model id must degrade, not kill the lane).
      if (s === undefined || s >= 500 || s === 404) {
        laneAllDaily = false
        lastTransient = mapUpstream(err, attempt.provider)
        record(attempt, 'error', s ? `HTTP ${s}` : 'timeout/network', latencyMs)
        continue
      }
      record(attempt, 'error', `HTTP ${s}`, latencyMs)
      throw mapUpstream(err, attempt.provider) // 400 / 401 / 403
    }
  }

  // Terminal airbag: fires only on a VERIFIED whole-lane daily blackout — every
  // configured, size-adequate target in this lane either 429'd on a daily quota
  // just now or was already marked exhausted today. A single provider's daily
  // limit (with the rest merely rate-limited or erroring) never reaches here.
  const laneDailyBlackout = laneAllDaily && (anyProviderTried || skippedForDaily)
  if (
    laneDailyBlackout &&
    !deadlineHit &&
    opts.neededTokens <= TARGETS.openrouterFree.contextWindow
  ) {
    const client = clientFor(TARGETS.openrouterFree)
    if (client) {
      const timeoutMs = Math.max(1_000, Math.min(ATTEMPT_TIMEOUT_MS[role], opts.deadlineAt - Date.now()))
      try {
        const content = await callProvider(client, { ...TARGETS.openrouterFree }, opts, timeoutMs)
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

  // Nothing succeeded. Prefer the most actionable reason.
  if (overflowSeen) throw new AiError(413, 'ai-context-overflow')
  if (!anyProviderTried && !skippedForDaily && skippedForSize) {
    throw new AiError(413, 'ai-context-overflow')
  }
  if (last429) throw last429
  if (skippedForDaily && !anyProviderTried) throw new AiError(429, 'ai-rate-limited')
  if (lastTransient) throw lastTransient
  if (deadlineHit) throw new AiError(504, 'ai-timeout')
  if (!anyProviderTried) throw new AiError(500, 'ai-not-configured')
  throw new AiError(429, 'ai-rate-limited')
}

async function callProvider(
  client: OpenAI,
  attempt: Attempt,
  opts: ExecuteOpts,
  timeoutMs: number
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

  const completion = await client.chat.completions.create(
    {
      model: attempt.model,
      max_tokens: opts.maxTokens,
      response_format,
      // reasoning_effort is only accepted by some models; omit it elsewhere.
      ...(reasoning_effort ? { reasoning_effort } : {}),
      messages: [
        { role: 'system', content: systemContent },
        { role: 'user', content: opts.user },
      ],
    } as Parameters<typeof client.chat.completions.create>[0],
    // Per-attempt budget (overrides the client-level 25s backstop) so a slow
    // target times out into the cascade instead of eating the whole chain.
    { timeout: timeoutMs }
  )

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
  // Estimate the window this call needs: input (system + user + embedded schema)
  // plus the output budget plus headroom. Drives size-aware target selection.
  const inputTokens = estimateTokens(
    opts.system + opts.user + JSON.stringify(jsonSchema)
  )
  const neededTokens = inputTokens + opts.maxTokens + TOKEN_SAFETY_MARGIN

  const base: ExecuteOpts = {
    system: opts.system,
    user: opts.user,
    jsonSchema,
    schemaName: opts.schemaName,
    effort: opts.effort,
    maxTokens: opts.maxTokens,
    neededTokens,
    // One deadline covers the first chain AND the parse-retry chain, so the
    // whole completeJSON call stays inside the route's 30s function budget.
    deadlineAt: Date.now() + CHAIN_DEADLINE_MS,
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
    // First issue only, capped: zod's full stringified issue array can run 1–3k
    // chars, and this text is appended to the retry prompt at full token price.
    const issue = result.error.issues[0]
    const compact = issue
      ? `${issue.path.join('.') || '(root)'}: ${issue.message}`.slice(0, 300)
      : 'did not match the schema'
    return { ok: false, error: compact }
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

// Test-only hook: reset module-global routing state between cases. (The client
// factory seam is separate — __setClientFactory — and survives resets.)
export function __resetRouterState(): void {
  __resetRoutingState()
  __resetClients()
}
