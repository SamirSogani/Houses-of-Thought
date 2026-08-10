// Shared vocabulary of the routing engine: the AiError contract, role type,
// upstream-error classification, model-capability quirks, and token estimation.
// Split from router.ts (which exceeded the repo's 600-LOC rule); imported by the
// engine (router.ts) and the monitor (router-monitor.ts). Only internal dep is
// the leaf logging helper (lib/log).

import { log } from '@/lib/log'

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

// 'swarm' and 'synthesis' are dedicated to the reasoning pipeline
// (lib/ai/reasoning/*) only — see router.ts's swarmAttempts()/
// synthesisAttempts() header comment. Every other feature in the app keeps
// using suggestor/coach/critic/drafter exactly as before.
export type AiRole = 'coach' | 'critic' | 'suggestor' | 'drafter' | 'swarm' | 'synthesis'

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

// Groq's strict json_schema mode (supportsJsonSchema, below) does server-side
// constrained-decoding validation and 400s as json_validate_failed when the
// model's OWN generation doesn't conform — confirmed live (2026-07-31) on
// frame_packet: a fully coherent, on-topic response that simply never closed
// its final string's quote before the closing brace, and separately, one
// missing a required field entirely. This is a provider-side generation
// glitch, not a client misconfiguration — unlike a genuine 400 (bad request
// shape, auth, etc.), it deserves the exact same cascade-to-next-target
// treatment as an empty generation, not an immediate throw. Groq-specific
// (the only provider routed through strict json_schema here); revisit if
// another provider's structured-output mode ever needs the same treatment.
const JSON_VALIDATE_FAILED_RE = /json_validate_failed/i
export function isGroqJsonValidateFailed(err: unknown): boolean {
  return statusOf(err) === 400 && JSON_VALIDATE_FAILED_RE.test(errorText(err))
}

// Map a non-transient (or terminal) error onto a status routes can surface.
export function mapUpstream(err: unknown, provider: string): AiError {
  const status = statusOf(err)
  log.error('ai', 'upstream error', {
    provider,
    status: status ?? 'unknown',
    detail: errorText(err),
  })
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
//
// gpt-oss/qwen are both capped at their family's floor regardless of the
// caller's requested effort (2026-07-31): confirmed live that 'high' reasoning
// on these models can consume the entire maxTokens budget on internal
// reasoning tokens before emitting any answer content — reproduced on BOTH
// qwen (Groq) and gpt-oss-20b (Groq) as an empty completion, surfaced by Groq
// as json_validate_failed with an empty failed_generation. Gemini already had
// this exact protection (below); these two didn't. qwen's vocabulary has no
// 'low' tier, so 'none' is its floor.
export function reasoningEffortFor(model: string, effort: 'low' | 'high'): string | undefined {
  if (model.includes('gpt-oss')) return 'low'
  if (model.includes('qwen') && !model.includes('coder')) return 'none'
  // Gemini 2.5's OpenAI-compat endpoint accepts reasoning_effort — and DEFAULTS
  // to dynamic thinking billed as output tokens, the priciest out-rate in the
  // fleet (~50–70% of drafter-lane cost when left on). 2.5 Flash supports 'none';
  // map 'high' to 'low' rather than passing it through — dynamic/deep thinking
  // has not earned its ~8× out-rate on these drafting tasks.
  if (model.includes('gemini')) return effort === 'high' ? 'low' : 'none'
  return undefined
}
