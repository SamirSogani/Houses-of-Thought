// Shared vocabulary of the routing engine: the AiError contract, role type,
// upstream-error classification, model-capability quirks, and token estimation.
// Split from router.ts (which exceeded the repo's 600-LOC rule); imported by the
// engine (router.ts) and the monitor (router-monitor.ts). No internal deps.

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

// ── Error classification ──────────────────────────────────────────────────────

export function statusOf(err: unknown): number | undefined {
  const s = (err as { status?: number })?.status
  return typeof s === 'number' ? s : undefined
}

// Flatten whatever the SDK gives us into searchable text.
export function errorText(err: unknown): string {
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
export function isDailyQuota(err: unknown): boolean {
  return DAILY_QUOTA_RE.test(errorText(err))
}

// A context-window overflow (usually a 400) means "this input is too big for this
// model" — unlike a plain 400, it is NOT a bug we should surface: we escalate to a
// larger-window target instead. Matches the common phrasings across providers.
const CONTEXT_OVERFLOW_RE =
  /(context[\s_]?length|context[\s_]?window|maximum context|too many tokens|reduce the (length|number of tokens)|input (is )?too long|prompt is too long|string too long|exceeds? the (maximum|context)|token limit)/i
export function isContextOverflow(err: unknown): boolean {
  const s = statusOf(err)
  if (s !== undefined && s !== 400 && s !== 413 && s !== 422) return false
  return CONTEXT_OVERFLOW_RE.test(errorText(err))
}

// Map a non-transient (or terminal) error onto a status routes can surface.
export function mapUpstream(err: unknown, provider: string): AiError {
  const status = statusOf(err)
  console.error(`[ai] ${provider} error (status ${status ?? 'unknown'})`, err)
  if (status === 401 || status === 403) return new AiError(status, 'ai-unauthorized')
  if (status === 400) return new AiError(400, 'ai-bad-request')
  return new AiError(502, 'ai-upstream-error')
}

// ── Token estimation ──────────────────────────────────────────────────────────

// Rough token estimate (~4 chars/token) with headroom for message framing and, on
// reasoning models, the reasoning budget. Deliberately conservative so we escalate
// a hair early rather than 400.
export const TOKEN_SAFETY_MARGIN = 4_000
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

// ── Model-capability quirks ───────────────────────────────────────────────────

// Groq's strict json_schema structured output is only reliable on the gpt-oss
// family here; everything else uses json_object (schema embedded in the prompt).
export function supportsJsonSchema(model: string): boolean {
  return model.includes('gpt-oss')
}

// reasoning_effort's vocabulary is per-model and a mismatch is a hard 400 (which
// would NOT fall through — it surfaces as an error). gpt-oss takes low|high; the
// qwen *reasoning* models (e.g. qwen3.6-27b) take none|default. qwen *coder*
// models (qwen3-coder / qwen-2.5-coder) accept no such field — excluding 'coder'
// is what keeps the OpenRouter airbag from 400-ing. Mistral: omit (undefined).
export function reasoningEffortFor(model: string, effort: 'low' | 'high'): string | undefined {
  if (model.includes('gpt-oss')) return effort
  if (model.includes('qwen') && !model.includes('coder')) {
    return effort === 'high' ? 'default' : 'none'
  }
  // Gemini 2.5's OpenAI-compat endpoint accepts reasoning_effort — and DEFAULTS
  // to dynamic thinking billed as output tokens, the priciest out-rate in the
  // fleet (~50–70% of drafter-lane cost when left on). 2.5 Flash supports 'none';
  // map 'high' to 'low' rather than passing it through — dynamic/deep thinking
  // has not earned its ~8× out-rate on these drafting tasks.
  if (model.includes('gemini')) return effort === 'high' ? 'low' : 'none'
  return undefined
}
