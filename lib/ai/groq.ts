// Server-only Groq client wrapper. Every AI route calls completeJSON — one place
// that owns model selection, structured-output plumbing, retry-once-on-parse-
// failure, and error mapping. See decisions/006 (model choice) and 012 (failover).
//
// Two-tier resilient routing (replaces the single gpt-oss-120b default):
//   Tier 1  qwen/qwen3.6-27b    — the standard for everything, incl. suggestions,
//                                  when traffic is light.
//   Tier 2  openai/gpt-oss-20b  — fast fallback. Taken on a Tier-1 HTTP 429, and
//                                  also the *entry* point for low-effort work
//                                  (suggestions/strawman) under heavy traffic.
//
// High-effort work (house health, research, context) always starts on Tier 1.
// On an HTTP 429 we silently advance to the next tier so students never see a
// rate-limit error mid-critique. Any other error (401, 400, 5xx) is logged and
// surfaced — per spec we only bypass 429. Each tier authenticates with its own
// key; on a single Groq account that still buys independent buckets because
// Groq's limits are per-model.
//
// Non-streaming JSON only (decision 008): Groq is fast enough that streaming buys
// nothing in v1, and one paradigm keeps this surface small.

import Groq from 'groq-sdk'
import { z } from 'zod'

// Fail loudly if this module is ever pulled into a client bundle — the API keys
// must never ship to the browser.
if (typeof window !== 'undefined') {
  throw new Error('lib/ai/groq.ts is server-only and must not run in the browser')
}

interface Tier {
  model: string
  keyEnv: string
}

// Ordered failover chain. Model IDs are env-overridable so a model swap needs no
// code change.
const TIERS: Tier[] = [
  {
    model: process.env.GROQ_TIER1_MODEL ?? 'qwen/qwen3.6-27b',
    keyEnv: 'GROQ_QWEN_3_POINT_6_27B_API_KEY',
  },
  {
    model: process.env.GROQ_TIER2_MODEL ?? 'openai/gpt-oss-20b',
    keyEnv: 'GROQ_OPENAI_GPT_OSS_20B_API_KEY',
  },
]

// reasoning_effort's vocabulary is per-model, and a mismatch is a hard 400 (not a
// 429, so it would NOT fall through — it would surface as an error). The gpt-oss
// family takes low|medium|high; qwen reasoning models take only none|default. Map
// our two-level effort onto whatever the target model accepts.
function reasoningEffortFor(
  model: string,
  effort: 'low' | 'high'
): 'none' | 'default' | 'low' | 'high' {
  if (model.startsWith('qwen')) return effort === 'high' ? 'default' : 'none'
  return effort // gpt-oss and anything else that accepts low|high directly
}

// Groq's strict json_schema structured output is only on a subset of models (the
// gpt-oss family here); qwen3.6-27b returns a 400 for it. Everything else falls
// back to json_object (schema embedded in the prompt), the widely-supported mode.
function supportsJsonSchema(model: string): boolean {
  return model.startsWith('openai/gpt-oss')
}

// Live concurrency gauge. "<2 people" is light traffic; 2+ concurrent AI calls is
// heavy, which pushes low-effort (suggestion) work onto the faster Tier 2 to shed
// load. NOTE: this counts in-flight calls *within one server instance*; on Vercel's
// serverless runtime multiple instances each keep their own gauge, so under real
// fan-out this under-counts. That is acceptable — it degrades toward Tier 1, never
// wrongly starves the heavy model — and needs no extra infra. Swap for a shared
// counter (e.g. a windowed count off ai_usage) if a global signal is ever needed.
const HEAVY_TRAFFIC_THRESHOLD = 2
let inFlight = 0

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

// One client per tier (each holds a distinct key). 25s timeout keeps us under a
// 30s route budget; SDK maxRetries covers only transport-level retries — the 429
// fallback below is ours.
const clients = new Map<string, Groq>()
function getClient(tier: Tier): Groq {
  const apiKey = process.env[tier.keyEnv]
  if (!apiKey) {
    throw new AiError(500, 'ai-not-configured')
  }
  let client = clients.get(tier.model)
  if (!client) {
    client = new Groq({ apiKey, timeout: 25_000, maxRetries: 1 })
    clients.set(tier.model, client)
  }
  return client
}

export async function completeJSON<T>(opts: {
  system: string
  user: string
  schema: z.ZodType<T> // zod schema; also converted to JSON Schema below
  schemaName: string // response_format json_schema name (a-z, 0-9, _, -)
  effort: 'low' | 'high' // maps to Groq reasoning_effort AND (with traffic) the entry tier
  maxTokens: number
}): Promise<T> {
  inFlight++
  try {
    return await run(opts)
  } finally {
    inFlight--
  }
}

async function run<T>(opts: Parameters<typeof completeJSON<T>>[0]): Promise<T> {
  const jsonSchema = z.toJSONSchema(opts.schema, { target: 'draft-7' })

  // Entry tier: high-effort work (house health, research) always starts on the
  // Tier 1 heavy model. Low-effort work (suggestions/strawman/interview) starts
  // there too when traffic is light, but drops to the faster Tier 2 under heavy
  // concurrent load. Both then fall through the remaining tiers on 429.
  const heavy = inFlight >= HEAVY_TRAFFIC_THRESHOLD
  const startTier = opts.effort === 'high' ? 0 : heavy ? 1 : 0

  // Send one prompt down the failover chain. Returns raw content from whichever
  // tier answered; only 429s advance to the next tier.
  async function askWithFallback(userMessage: string): Promise<string> {
    let last429: AiError | null = null
    for (let i = startTier; i < TIERS.length; i++) {
      const tier = TIERS[i]
      const groq = getClient(tier)
      // response_format is per-model: gpt-oss enforces the schema natively
      // (json_schema); qwen only supports json_object, so we embed the schema in
      // the system prompt and lean on the zod validate + one-shot retry below.
      const useJsonSchema = supportsJsonSchema(tier.model)
      const systemContent = useJsonSchema
        ? opts.system
        : `${opts.system}\n\nRespond with a single JSON object and nothing else. It must conform to this JSON Schema:\n${JSON.stringify(jsonSchema)}`
      const responseFormat = useJsonSchema
        ? { type: 'json_schema' as const, json_schema: { name: opts.schemaName, schema: jsonSchema } }
        : { type: 'json_object' as const }
      let completion
      try {
        completion = await groq.chat.completions.create({
          model: tier.model,
          reasoning_effort: reasoningEffortFor(tier.model, opts.effort),
          max_completion_tokens: opts.maxTokens,
          response_format: responseFormat,
          messages: [
            { role: 'system', content: systemContent },
            { role: 'user', content: userMessage },
          ],
        })
      } catch (err) {
        const status = (err as { status?: number })?.status
        if (status === 429) {
          // Rate limited: silently try the next tier.
          last429 = new AiError(429, 'ai-rate-limited')
          continue
        }
        // 401 / 400 / 5xx: log normally and stop — we only bypass 429.
        console.error(`[ai] Groq error on ${tier.model} (status ${status ?? 'unknown'})`, err)
        throw new AiError(502, 'ai-upstream-error')
      }
      const content = completion.choices[0]?.message?.content
      if (!content) throw new AiError(502, 'ai-empty-output')
      return content
    }
    // Every tier from the entry point down returned 429.
    throw last429 ?? new AiError(429, 'ai-rate-limited')
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
  // appended so the model can correct itself. Then give up.
  const first = tryParse(await askWithFallback(opts.user))
  if (first.ok) return first.value

  const retryUser = `${opts.user}\n\nYour previous reply did not match the required schema (${first.error}). Reply again with only valid JSON that matches the schema.`
  const second = tryParse(await askWithFallback(retryUser))
  if (second.ok) return second.value

  throw new AiError(502, 'ai-invalid-output')
}
