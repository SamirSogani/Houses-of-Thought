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

// 'medium' added 2026-08-11 (Samir) — see reasoningEffortFor below for what
// each tier actually does per model family.
export type AiEffort = 'low' | 'medium' | 'high'

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

// Groq's account-level TPM ceiling can reject a single REQUEST outright —
// 413 "Request too large... TPM: Limit 8000, Requested X" — before the model
// ever runs, distinct from the ordinary 429 "already used this minute" case
// (which the generic 429 branch in execute() already cascades past). Both
// share the same body shape (`code: "rate_limit_exceeded"`), just a
// different HTTP status. Real-verified live, 2026-08-12: a repair-mode call
// using REPAIR_TOKEN_HEADROOM (lib/ai/reasoning/budget.ts) can request more
// tokens in ONE call than Groq's account-level TPM ceiling allows, period —
// uncaught, this fell through every classification below to the terminal
// throw and killed the WHOLE fallback chain immediately, never even reaching
// Gemini. Unlike a 429, this must NOT open the Groq penalty box (a temporary
// cooldown fixes nothing about one request being structurally too big) —
// just cascade past Groq for this call.
const GROQ_TOKEN_LIMIT_RE = /rate_limit_exceeded/i
export function isGroqTokenLimitExceeded(err: unknown): boolean {
  return statusOf(err) === 413 && GROQ_TOKEN_LIMIT_RE.test(errorText(err))
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
// would NOT fall through — it surfaces as an error, mapUpstream treats 400 as
// terminal/misconfiguration-shaped, not cascaded). gpt-oss takes
// low|medium|high (real-verified live, 2026-08-11: DeepInfra's gpt-oss-20b
// accepts all three, 200 not 400, and 'medium' at a realistic 900-token
// budget produced genuine reasoning_content without exhausting it). qwen
// *reasoning* models (e.g. qwen3.6-27b) take none|default only — no distinct
// medium tier. qwen *coder* models (qwen3-coder / qwen-2.5-coder) accept no
// such field — excluding 'coder' is what keeps the OpenRouter airbag from
// 400-ing. Mistral: omit (undefined).
//
// gpt-oss/qwen's 'high' is capped to their family's floor by DEFAULT
// regardless of the caller's requested effort (2026-07-31): confirmed live
// that 'high' reasoning on these models can consume the entire maxTokens
// budget on internal reasoning tokens before emitting any answer content —
// reproduced on BOTH qwen (Groq) and gpt-oss-20b (Groq) as an empty
// completion, surfaced by Groq as json_validate_failed with an empty
// failed_generation. allowHighReasoning (2026-08-11, Samir) is an explicit
// per-call opt-in past that floor — only the reasoning pipeline's repair/
// regeneration calls (lib/ai/reasoning/*) set it, on the theory that
// surgical revision-under-feedback benefits from real deliberation more than
// first-pass generation does, and the empty-completion risk (rare, and
// already cascades gracefully via the ai-empty-output → next-target path,
// router.ts's execute()) is worth accepting there specifically. Every other
// caller in the app keeps the original floor untouched by default — this is
// additive, not a loosening of existing behavior. 'medium' has NO such gate:
// it was never the tier found risky, so it's unconditionally available
// wherever requested.
// Gemini already had its own version of this protection (below); these two
// didn't. qwen's vocabulary has no distinct 'medium', so both low and medium
// floor to its 'none'.
export function reasoningEffortFor(
  model: string,
  effort: AiEffort,
  // Opt-in past gpt-oss/qwen's 'high' floor — see the comment above. Ignored
  // for every other tier and every other model family.
  allowHighReasoning = false
): string | undefined {
  if (model.includes('gpt-oss')) {
    if (effort === 'high') return allowHighReasoning ? 'high' : 'low'
    return effort // 'low' or 'medium' pass straight through — both real-verified safe
  }
  if (model.includes('qwen') && !model.includes('coder')) {
    if (effort === 'high' && allowHighReasoning) return 'default'
    return 'none'
  }
  // Gemini 2.5's OpenAI-compat endpoint accepts reasoning_effort — and DEFAULTS
  // to dynamic thinking billed as output tokens, the priciest out-rate in the
  // fleet (~50–70% of drafter-lane cost when left on). 2.5 Flash supports 'none';
  // map anything above 'low' down to 'low' rather than passing 'high' through —
  // dynamic/deep thinking has not earned its ~8× out-rate on these drafting
  // tasks. allowHighReasoning does NOT override this: Gemini's cap is about
  // cost, not the empty-completion risk the flag exists for.
  if (model.includes('gemini')) return effort === 'low' ? 'none' : 'low'
  return undefined
}
