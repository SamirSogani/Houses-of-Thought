// Server-only Groq client wrapper. Every AI route calls completeJSON — one place
// that owns the model, structured-output plumbing, retry-once-on-parse-failure,
// and error mapping. See decisions/006 (GPT-OSS on Groq) and 008 (wiring).
//
// Non-streaming JSON only (decision 008): Groq is fast enough that streaming buys
// nothing in v1, and one paradigm keeps this surface small.

import Groq from 'groq-sdk'
import { z } from 'zod'

// Fail loudly if this module is ever pulled into a client bundle — the API key
// must never ship to the browser.
if (typeof window !== 'undefined') {
  throw new Error('lib/ai/groq.ts is server-only and must not run in the browser')
}

export const AI_MODEL = process.env.GROQ_MODEL ?? 'openai/gpt-oss-120b'

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

// One shared client. 25s timeout keeps us under a 30s route budget; retries are
// handled explicitly below (SDK maxRetries covers only transport-level retries).
let client: Groq | null = null
function getClient(): Groq {
  if (!process.env.GROQ_API_KEY) {
    throw new AiError(500, 'ai-not-configured')
  }
  if (!client) {
    client = new Groq({
      apiKey: process.env.GROQ_API_KEY,
      timeout: 25_000,
      maxRetries: 1,
    })
  }
  return client
}

export async function completeJSON<T>(opts: {
  system: string
  user: string
  schema: z.ZodType<T> // zod schema; also converted to JSON Schema below
  schemaName: string // response_format json_schema name (a-z, 0-9, _, -)
  effort: 'low' | 'high' // maps to Groq reasoning_effort
  maxTokens: number
}): Promise<T> {
  const groq = getClient()
  const jsonSchema = z.toJSONSchema(opts.schema, { target: 'draft-7' })

  // Ask once; on schema-parse failure, ask again with the validation error
  // appended so the model can correct itself. Then give up.
  async function ask(userMessage: string): Promise<string> {
    let completion
    try {
      completion = await groq.chat.completions.create({
        model: AI_MODEL,
        reasoning_effort: opts.effort,
        max_completion_tokens: opts.maxTokens,
        response_format: {
          type: 'json_schema',
          json_schema: { name: opts.schemaName, schema: jsonSchema },
        },
        messages: [
          { role: 'system', content: opts.system },
          { role: 'user', content: userMessage },
        ],
      })
    } catch (err) {
      const status = (err as { status?: number })?.status
      if (status === 429) throw new AiError(429, 'ai-rate-limited')
      throw new AiError(502, 'ai-upstream-error')
    }
    const content = completion.choices[0]?.message?.content
    if (!content) throw new AiError(502, 'ai-empty-output')
    return content
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

  const first = tryParse(await ask(opts.user))
  if (first.ok) return first.value

  const retryUser = `${opts.user}\n\nYour previous reply did not match the required schema (${first.error}). Reply again with only valid JSON that matches the schema.`
  const second = tryParse(await ask(retryUser))
  if (second.ok) return second.value

  throw new AiError(502, 'ai-invalid-output')
}
