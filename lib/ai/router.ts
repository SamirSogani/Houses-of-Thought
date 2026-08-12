// Multi-LLM API Routing Engine (server-only) — the execution core and public
// facade. One controller owns structured-output plumbing, the daily-blackout
// airbag, and error mapping. Every AI route calls `completeJSON` with a
// `role`; the role decides which failover lane the request rides — see
// router-lanes.ts for the five lanes and why each is ordered the way it is
// (decisions/006 model choice, 012 failover, 013 multi-provider, and 013's
// 2026-08-10 addendum for swarm/synthesis, the reasoning pipeline's own
// DeepInfra-led lanes).
//
// The module is split to honor the repo's 600-LOC rule; this file re-exports
// the whole public API so callers import only '@/lib/ai/router':
//   router-shared.ts  — AiError/AiRole, error classification, model quirks
//   router-config.ts  — providers, targets, client construction (+ test seam)
//   router-state.ts   — penalty box, per-provider daily map, health/event log
//   router-monitor.ts — admin snapshot, probes, per-model detail
//   router-lanes.ts   — per-role failover order + the reasoning behind it
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
// sunset-model 404s, empty generations, and Groq's json_validate_failed (its
// own strict-schema generation failing, not our request being malformed) all
// advance to the next target — provider incidents are exactly what a
// multi-target lane exists to survive. Only a genuine misconfiguration-shaped
// error (400 / 401 / 403, everything else) is thrown immediately so a real bug
// surfaces instead of being retried at full price four times.
// Latency: every attempt carries a per-role timeout and the chain a shared,
// per-role deadline (ATTEMPT_TIMEOUT_MS / CHAIN_DEADLINE_MS) so one slow-but-
// alive provider cannot eat that role's route's entire serverless budget
// (30s for most AI routes; 60s for the reasoning pipeline's swarm/synthesis,
// see CHAIN_DEADLINE_MS below).

import type OpenAI from 'openai'
import { z } from 'zod'
import { log } from '@/lib/log'
import {
  AiError,
  errorText,
  estimateTokens,
  isContextOverflow,
  isDailyQuota,
  isGroqJsonValidateFailed,
  mapUpstream,
  reasoningEffortFor,
  statusOf,
  supportsJsonSchema,
  TOKEN_SAFETY_MARGIN,
  type AiRole,
  type AiEffort,
} from './router-shared'
import { clientFor, TARGETS, targetName, __resetClients, type Target } from './router-config'
import {
  clearGroqRecovering,
  markDailyExhausted,
  openGroqPenalty,
  providerDailyExhausted,
  record,
  __resetRoutingState,
} from './router-state'
import { ATTEMPT_TIMEOUT_MS, attemptsForRole, type Attempt } from './router-lanes'

// Fail loudly if this module is ever pulled into a client bundle — the API keys
// must never ship to the browser.
if (typeof window !== 'undefined') {
  throw new Error('lib/ai/router.ts is server-only and must not run in the browser')
}

// ── Public facade re-exports ──────────────────────────────────────────────────

export { AiError, type AiRole, type AiEffort } from './router-shared'
export { __setClientFactory } from './router-config'
export {
  dailyLimitsExhausted,
  dailyExhaustedProviders,
  drafterLaneStress,
  type DrafterLaneStress,
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
// One slow-but-alive target must not eat the whole serverless budget. A
// timed-out attempt surfaces as a no-status error and cascades like any
// transient failure — so the penalty box and health log still see it, unlike
// a platform kill. The chain-wide deadline is shared across completeJSON's
// parse-retry too. Per-role attempt budgets (ATTEMPT_TIMEOUT_MS) and the
// failover order itself (attemptsForRole/Attempt) live in router-lanes.ts.
//
// Keyed per-role, not one flat number (2026-08-10, Samir) — because each
// role's ROUTE has its own maxDuration, and this deadline must stay under
// whatever that specific route can actually honor. Raising it for one role
// without raising THAT role's route's maxDuration to match just trades a
// graceful self-cutoff (still returns a clean error) for a hard platform
// kill mid-response (no error, connection just dies). swarm/synthesis are
// the reasoning pipeline's roles, both served ONLY by
// app/api/admin/reasoning/route.ts (maxDuration=60 as of this change) — they
// get ~5s headroom under that. Every other role's route is still
// maxDuration=30, so they keep the original ~4s headroom under that.
const CHAIN_DEADLINE_MS: Record<AiRole, number> = {
  suggestor: 26_000,
  coach: 26_000,
  critic: 26_000,
  drafter: 26_000,
  swarm: 55_000,
  synthesis: 55_000,
}

// ── Execution ─────────────────────────────────────────────────────────────────

interface ExecuteOpts {
  system: string
  user: string
  jsonSchema: Record<string, unknown>
  schemaName: string
  effort: AiEffort
  // Opt-in past gpt-oss/qwen's 'high' floor — see reasoningEffortFor
  // (router-shared.ts) for what this actually does and why it's gated.
  allowHighReasoning?: boolean
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
async function execute(role: AiRole, opts: ExecuteOpts): Promise<{ content: string; target: Target }> {
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
    // attempt.timeoutMs overrides the role's default when a specific target
    // needs more (or less) room — see Attempt.timeoutMs (router-lanes.ts).
    const timeoutMs = Math.max(
      1_000,
      Math.min(attempt.timeoutMs ?? ATTEMPT_TIMEOUT_MS[role], opts.deadlineAt - Date.now())
    )
    try {
      const content = await callProvider(client, attempt, opts, timeoutMs)
      if (attempt.provider === 'groq') clearGroqRecovering() // healthy again
      record(attempt, 'ok', undefined, Date.now() - started)
      return { content, target: attempt }
    } catch (err) {
      const latencyMs = Date.now() - started
      // An empty generation is provider flakiness, not caller error — cascade past it.
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
      // Groq's json_validate_failed (see isGroqJsonValidateFailed, router-shared.ts):
      // a 400, but the model's OWN generation failing Groq's strict json_schema
      // validation — not a bad request from us. Confirmed live producing fully
      // coherent, on-topic content that just missed a closing quote or a required
      // field — worth another attempt, not a hard stop. Check BEFORE the generic
      // 400 = terminal rule below.
      if (isGroqJsonValidateFailed(err)) {
        laneAllDaily = false
        lastTransient = mapUpstream(err, attempt.provider)
        record(attempt, 'error', 'json-validate-failed', latencyMs)
        continue
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
        return { content, target: TARGETS.openrouterFree }
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

// supportsJsonSchema() matches on 'gpt-oss' model name, not provider — Groq's
// and Cerebras's gpt-oss targets both get strict response_format: json_schema.
// Confirmed live (2026-08-02, plans/active/reasoning-pipeline/14): Cerebras's
// enforcement of that shape is weaker than Groq's — Groq 400s as
// json_validate_failed when its own generation doesn't conform (cascades
// cleanly, see isGroqJsonValidateFailed above); Cerebras returned a 200 with
// the correct object wrapped in a one-element array, which only our own zod
// parse below catches. This costs nothing on providers that already enforce
// the shape strictly, so it's unconditional rather than gated per-provider.
const JSON_SHAPE_GUARDRAIL =
  'Respond with exactly one JSON object matching the schema — do not wrap it in an array or add any extra nesting.'

async function callProvider(
  client: OpenAI,
  attempt: Attempt,
  opts: ExecuteOpts,
  timeoutMs: number
): Promise<string> {
  const useJsonSchema = supportsJsonSchema(attempt.model)
  const systemContent = useJsonSchema
    ? `${opts.system}\n\n${JSON_SHAPE_GUARDRAIL}`
    : `${opts.system}\n\nRespond with a single JSON object and nothing else. It must conform to this JSON Schema:\n${JSON.stringify(opts.jsonSchema)}`
  const response_format = useJsonSchema
    ? ({
        type: 'json_schema' as const,
        json_schema: { name: opts.schemaName, schema: opts.jsonSchema },
      })
    : ({ type: 'json_object' as const })
  const reasoning_effort = reasoningEffortFor(attempt.model, opts.effort, opts.allowHighReasoning)

  let completion: OpenAI.Chat.Completions.ChatCompletion
  try {
    completion = (await client.chat.completions.create(
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
    )) as OpenAI.Chat.Completions.ChatCompletion
  } catch (err) {
    // Full request-context diagnostic on ANY upstream failure (2026-07-31):
    // mapUpstream's downstream log has provider+status but not WHICH call this
    // was or the request params that shaped it — the exact fields needed to
    // root-cause a reproducible failure (e.g. Groq's json_validate_failed
    // recurring across models). Logs once here with everything in scope, then
    // re-throws untouched so execute()'s cascade/classification is unchanged.
    log.error('ai/router', 'upstream call failed', {
      provider: attempt.provider,
      model: attempt.model,
      status: statusOf(err) ?? 'unknown',
      schemaName: opts.schemaName,
      effort: opts.effort,
      reasoningEffort: reasoning_effort ?? '(omitted)',
      useJsonSchema,
      maxTokens: opts.maxTokens,
      neededTokens: opts.neededTokens,
      detail: errorText(err),
    })
    throw err
  }

  const content = completion.choices[0]?.message?.content
  if (!content) {
    // An empty 200 (distinct from the thrown errors above) — log the request
    // context here too, since ai-empty-output otherwise cascades silently.
    log.error('ai/router', 'upstream empty output', {
      provider: attempt.provider,
      model: attempt.model,
      schemaName: opts.schemaName,
      effort: opts.effort,
      reasoningEffort: reasoning_effort ?? '(omitted)',
      useJsonSchema,
      maxTokens: opts.maxTokens,
      finishReason: completion.choices[0]?.finish_reason ?? '(none)',
    })
    throw new AiError(502, 'ai-empty-output')
  }
  return content
}

// ── Public facade ─────────────────────────────────────────────────────────────

export async function completeJSON<T>(opts: {
  role: AiRole // decides the failover lane
  system: string
  user: string
  schema: z.ZodType<T> // zod schema; also converted to JSON Schema below
  schemaName: string // response_format json_schema name (a-z, 0-9, _, -)
  effort: AiEffort // maps to reasoning_effort where the model accepts it
  // Opt-in past gpt-oss/qwen's 'high' floor — see reasoningEffortFor
  // (router-shared.ts). Only meaningful when effort: 'high'; ignored otherwise.
  allowHighReasoning?: boolean
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
    allowHighReasoning: opts.allowHighReasoning,
    maxTokens: opts.maxTokens,
    neededTokens,
    // One deadline covers the first chain AND the parse-retry chain, so the
    // whole completeJSON call stays inside its role's route's function budget.
    deadlineAt: Date.now() + CHAIN_DEADLINE_MS[opts.role],
  }

  function tryParse(raw: string): { ok: true; value: T } | { ok: false; error: string } {
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      return { ok: false, error: 'response was not valid JSON' }
    }
    let result = opts.schema.safeParse(parsed)
    // Defensive unwrap (2026-08-02, plans/active/reasoning-pipeline/14):
    // Cerebras's gpt-oss-120b, live, wrapped an otherwise-correct object in a
    // one-element array despite strict json_schema mode (see
    // JSON_SHAPE_GUARDRAIL above — a prompt-level ask, not a guarantee).
    // Retried only on this exact observed shape, not a general JSON repair
    // tool: if the array-of-one doesn't ALSO satisfy the schema, the original
    // error is what's reported.
    if (!result.success && Array.isArray(parsed) && parsed.length === 1) {
      const unwrapped = opts.schema.safeParse(parsed[0])
      if (unwrapped.success) result = unwrapped
    }
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
  const firstResult = await execute(opts.role, base)
  const first = tryParse(firstResult.content)
  if (first.ok) return first.value

  const retryUser = `${opts.user}\n\nYour previous reply did not match the required schema (${first.error}). Reply again with only valid JSON that matches the schema.`
  const secondResult = await execute(opts.role, { ...base, user: retryUser })
  const second = tryParse(secondResult.content)
  if (second.ok) return second.value

  // Diagnostic only (2026-07-30): visibility into what the model actually
  // returned on a genuine ai-invalid-output — this path previously had none.
  // firstTarget/secondTarget (2026-07-31): which provider/model actually
  // served each attempt — the raw content alone couldn't say whether a
  // reproducible malformed-output pattern traces to one specific target.
  log.error('ai/router', 'completeJSON invalid output after retry', {
    schemaName: opts.schemaName,
    role: opts.role,
    firstTarget: targetName(firstResult.target),
    firstError: first.error,
    firstRaw: firstResult.content.slice(0, 500),
    secondTarget: targetName(secondResult.target),
    secondError: second.error,
    secondRaw: secondResult.content.slice(0, 500),
  })
  throw new AiError(502, 'ai-invalid-output')
}

// Test-only hook: reset module-global routing state between cases. (The client
// factory seam is separate — __setClientFactory — and survives resets.)
export function __resetRouterState(): void {
  __resetRoutingState()
  __resetClients()
}
