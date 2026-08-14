// Provider/target configuration + client construction for the routing engine.
// Split from router.ts (600-LOC rule). Each provider contributes only a base
// URL. A routing *target* pairs a model with the exact env var holding that
// model's key — the .env vars are named after the specific keys they carry, so
// every model authenticates with its own key (Groq's two models therefore use
// two distinct keys on the same base URL). Base URLs, model IDs, and key
// env-var names are all overridable via env (.env.example documents the matrix;
// docs/operations/model-sunset-runbook.md is the playbook).

import OpenAI from 'openai'
import { log } from '@/lib/log'

// Fail loudly if this module is ever pulled into a client bundle — the API keys
// must never ship to the browser.
if (typeof window !== 'undefined') {
  throw new Error('lib/ai/router-config.ts is server-only and must not run in the browser')
}

export type ProviderId = 'mistral' | 'deepinfra' | 'groq' | 'google' | 'cerebras' | 'openrouter'

const BASE_URLS: Record<ProviderId, string> = {
  mistral: process.env.MISTRAL_BASE_URL ?? 'https://api.mistral.ai/v1',
  // Paid, self-serve, OpenAI-compatible — added as a cheap relief valve on the
  // realtime lane (router.ts realtimeAttempts()) after free-tier Mistral/Groq
  // couldn't sustain even n=2 reasoning-pipeline test runs (Samir, 2026-08-10).
  deepinfra: process.env.DEEPINFRA_BASE_URL ?? 'https://api.deepinfra.com/v1/openai',
  groq: process.env.GROQ_BASE_URL ?? 'https://api.groq.com/openai/v1',
  google:
    process.env.GEMINI_BASE_URL ??
    'https://generativelanguage.googleapis.com/v1beta/openai/',
  cerebras: process.env.CEREBRAS_BASE_URL ?? 'https://api.cerebras.ai/v1',
  openrouter: process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1',
}

// A concrete place to send a request: which provider, which model, the env var
// holding that model's key, and its context window (tokens). The window drives
// size-aware routing: a request whose estimated input exceeds a target's window
// skips it, so large context automatically lands on the 1M-token Gemini target.
export interface Target {
  provider: ProviderId
  model: string
  keyEnv: string
  contextWindow: number
}

// Env-overridable per-target context windows. Conservative defaults; Gemini is the
// deliberate large-context escape hatch (~1M tokens).
const CTX = {
  mistral8b: Number(process.env.MISTRAL_CONTEXT ?? 128_000),
  // 128K matches DeepSeek-V3's real ceiling (see TARGETS.deepinfra below) —
  // slightly under gpt-oss-20b's 131,072 and Llama-3.1-8B-Instruct's, the two
  // earlier models this target ran; kept at the tightest of the three so
  // size-aware routing never assumes headroom the active model doesn't have.
  // Llama-3.3-70B-Instruct-Turbo (2026-08-13 swap, see TARGETS.deepinfra) is
  // ALSO 131,072 (confirmed on its DeepInfra model/API-reference pages) — same
  // as gpt-oss-20b, still above DeepSeek-V3's 128,000. 128K therefore remains
  // the tightest ceiling across every model this target has ever run, so no
  // change was needed here — kept at 128_000 for the same reason as before.
  // Qwen/Qwen3-235B-A22B-Instruct-2507 (2026-08-13, same session, swapped in
  // after Llama-3.3-70B failed real verification — see TARGETS.deepinfra) is
  // 262,144 natively (confirmed directly on
  // deepinfra.com/Qwen/Qwen3-235B-A22B-Instruct-2507) — more than double any
  // prior model's window on this target. 128K therefore remains the tightest
  // ceiling across all four models this target has now run; still no change
  // needed, still kept at 128_000 for the same conservative reason as before.
  deepinfra: Number(process.env.DEEPINFRA_CONTEXT ?? 128_000),
  groq: Number(process.env.GROQ_CONTEXT ?? 128_000),
  gemini: Number(process.env.GEMINI_CONTEXT ?? 1_000_000),
  cerebras: Number(process.env.CEREBRAS_CONTEXT ?? 128_000),
  openrouter: Number(process.env.OPENROUTER_CONTEXT ?? 128_000),
}

export const TARGETS = {
  mistral8b: {
    provider: 'mistral',
    model: process.env.MISTRAL_MODEL ?? 'ministral-8b-latest',
    keyEnv: process.env.MISTRAL_KEY_ENV ?? 'MISTRAL_MINISTRAL_8B_API_KEY',
    contextWindow: CTX.mistral8b,
  },
  // Paid provider used across the realtime lane (relief valve) and the
  // reasoning pipeline's swarm/synthesis lanes — see router-lanes.ts.
  //
  // Key name and TARGETS key are deliberately model-agnostic ('deepinfra',
  // not e.g. 'deepinfraLlama8b'/'deepinfraGptOss20b') — 2026-08-10, Samir's
  // call, after the model got swapped once already and had to be renamed
  // across 4 files each time. Switching models now should be exactly ONE
  // line: the `model` default below (or set DEEPINFRA_MODEL in env, no code
  // change at all). There is only one DeepInfra target, so unlike Groq's two
  // models there is no need for a second key — DEEP_INFRA_API_KEY covers
  // whichever model is active. (Underscore between DEEP and INFRA — matches
  // how the real key was actually named in .env, 2026-08-10; every other
  // DeepInfra override var below stays DEEPINFRA_* with no underscore, since
  // only the literal secret name needed to match what's really configured.)
  //
  // Active default: 'Qwen/Qwen3-235B-A22B-Instruct-2507' — swapped from
  // 'meta-llama/Llama-3.3-70B-Instruct-Turbo' (2026-08-13, same live
  // debugging session as the Llama swap directly below, later the same
  // evening once Llama's real-verification results came back). Llama's
  // failure was NOT a capability problem: DeepInfra doesn't confirm strict
  // json_schema support for Llama-3.3-70B (see the supportsJsonSchema()
  // decision in the Llama section below), so it ran on the json_object
  // fallback path, and on 4/4 real attempts the model wrapped its JSON output
  // in a markdown code fence (```json ... ```) that the app's own JSON.parse
  // choked on ("response was not valid JSON") — the content INSIDE the fence
  // was fine every time. Pure formatting failure, not a quality or capability
  // one. Full history in the Llama-3.3-70B-Instruct-Turbo section below.
  //
  // Qwen3-235B-A22B-Instruct-2507 is the next thing to try, on two
  // independent grounds:
  //   1. MoE, 235B total / 22B active — smaller and cheaper than DeepSeek-V3's
  //      671B, so it should land somewhere between DeepSeek-V3's proven
  //      quality and Llama-3.3-70B's proven (if ultimately fence-broken)
  //      speed.
  //   2. Its own DeepInfra model page states it "supports only non-thinking
  //      mode and does not generate <think></think> blocks" — a STRUCTURAL
  //      guarantee (this model variant has no hidden reasoning channel to
  //      begin with), not a documented off-switch a caller has to remember to
  //      flip. That makes it categorically safer against gpt-oss-20b's
  //      failure class (a hidden Harmony reasoning phase that sometimes never
  //      hands off to the visible answer) than a model that merely defaults
  //      to non-thinking but still has a thinking mode to accidentally
  //      trigger.
  //
  // Sanity-checked live (2026-08-13) before this swap, per this session's own
  // rule not to trust a model id without checking the literal DeepInfra page
  // for it — learned the hard way on the Llama swap below: fetched
  // https://deepinfra.com/Qwen/Qwen3-235B-A22B-Instruct-2507 directly and
  // confirmed it resolves to a real, live model page, not a 404. That page
  // also states a 262,144-token native context window (see CTX.deepinfra
  // above — well inside the existing 128K ceiling, no change needed) and
  // shows "Supports" badges for both JSON and function calling — but this
  // session already established that DeepInfra's "JSON" capability badge is
  // NOT a reliable signal of real constrained-decoding support: Llama-3.3-70B
  // carried the identical badge and still failed under the json_object
  // fallback, never mind strict json_schema. Its strict-json_schema support
  // on DeepInfra is therefore genuinely UNCONFIRMED — supportsJsonSchema()
  // (router-shared.ts) was deliberately NOT extended to include it, same
  // discipline as every model on this target except DeepSeek-V3 (see that
  // function's own comment). This swap has NOT yet been real-verified.
  //
  // Paired with a new defensive fix the same session (router.ts, completeJSON
  // / tryParse, via stripMarkdownFence): a helper now strips a leading/
  // trailing markdown code fence from ANY completion before JSON.parse ever
  // sees it, unconditionally — a direct response to the Llama fence-wrapping
  // failure above, and cheap insurance in case Qwen (or any future model on
  // this fallback path) does the same thing. It is a robustness net, not a
  // substitute for actually real-verifying Qwen's own output quality and
  // schema conformance.
  //
  // ── Llama-3.3-70B-Instruct-Turbo swap (2026-08-13, real-verified live —
  // 4/4 real attempts FAILED) — kept here for history, swapped from
  // 'deepseek-ai/DeepSeek-V3'. DeepSeek-V3 did what it was brought in to do —
  // real-verified live, TWICE: Frame passed 9/9 first try both runs, both
  // Perspectives bundles passed review first try with zero regenerations, so
  // its non-reasoning (no hidden channel) design genuinely avoids
  // gpt-oss-20b's empty-output bug. But it turned out very slow for a
  // 671B-param MoE model: perspectives-generate-details (6 parallel/staggered
  // calls) took 2.3 minutes real wall-clock time for that one step alone, and
  // the whole Perspectives layer took over 8 minutes — DEEPINFRA_SWARM_TIMEOUT_MS
  // (router-lanes.ts) had to be temporarily bumped 60s→200s just to let it
  // finish, and that bump has NOT been right-sized back down. Llama-3.3-70B
  // was tried next on the theory that it would keep DeepSeek-V3's win (dense,
  // plain instruction-tuned model, no hidden reasoning phase — same reason it
  // can't hit gpt-oss-20b's Harmony empty-output bug) while being meaningfully
  // smaller — 70B dense vs. DeepSeek-V3's 671B — and therefore faster, while
  // still being "smart enough." That theory was never actually tested: all 4
  // real attempts failed before quality could even be assessed, on a THIRD
  // failure mode distinct from either other model's known risk (gpt-oss-20b's
  // empty output, DeepSeek-V3's speed, or Llama-3.1-8B's poor feedback
  // incorporation below) — see the Qwen swap note above for exactly what that
  // failure was (markdown-fence-wrapped JSON breaking JSON.parse) and why
  // it's a formatting bug, not evidence Llama-3.3-70B is a "dumb" model.
  //
  // Exact id, NOT the plain Hugging Face id — confirmed 2026-08-13 against
  // DeepInfra's own model/demo/API-reference pages (deepinfra.com/meta-llama/
  // Llama-3.3-70B-Instruct-Turbo and its /api subpage's curl example, plus
  // api.deepinfra.com/models/meta-llama/Llama-3.3-70B-Instruct-Turbo):
  // DeepInfra only serves the FP8-quantized "-Turbo" variant — the bare
  // 'meta-llama/Llama-3.3-70B-Instruct' id 404s on DeepInfra's own site.
  // Context window 131,072 (same pages, consistently) — see CTX.deepinfra
  // above for why the 128_000 default didn't need to change for this. Caveat
  // worth flagging: DeepInfra's own bulk /v1/openai/models catalog listing
  // truncates before reaching this entry (150+ models), so its presence
  // there specifically could not be confirmed the same way; the per-model
  // pages were consistent across four independent fetches, which is the
  // basis for this swap. Pricing (informational): ~$0.10/1M input, ~$0.32/1M
  // output (standard tier) — meaningfully cheaper than DeepSeek-V3 too,
  // though cost was not the reason for this swap.
  //
  // supportsJsonSchema() (router-shared.ts) was deliberately NOT extended to
  // match Llama here: docs.deepinfra.com/chat/structured-outputs, re-checked
  // 2026-08-13, names only DeepSeek-V3 explicitly (in its code examples) and
  // links out to a general "many of our models" JSON list without enumerating
  // Llama — not the explicit per-model confirmation this codebase requires
  // before granting strict json_schema mode (see that function's own comment
  // for why: Cerebras's weaker enforcement burned this once already). Llama
  // therefore ran on the existing json_object fallback path, same as every
  // other unconfirmed model — this is NOT the regression the DeepSeek-V3
  // comment below warns about (that was Llama-3.1-8B silently falling back
  // without anyone deciding it should); this was a deliberate, documented
  // choice to stay on the conservative path pending real confirmation. That
  // conservative path is exactly where the fence-wrapping failure happened:
  // the model itself chose to prose-wrap its JSON in markdown, precisely what
  // strict json_schema mode is designed to prevent. Whether strict mode would
  // have avoided this is unconfirmed (Llama was never granted it) but is a
  // reasonable hypothesis if this model id is ever revisited.
  //
  // ── DeepSeek-V3 swap (2026-08-13, real-time incident review with Samir and
  // a senior engineer, both watching the deployed pipeline fail live), kept
  // here for history — swapped from 'openai/gpt-oss-20b'. gpt-oss-20b's
  // Harmony response format has a hidden internal reasoning phase before it
  // writes the visible answer; real production traffic that same evening
  // showed it sometimes never hands off — 5 consecutive real failures on
  // global-assumptions-generate (up to 3 same-target retries each, so ~15
  // real underlying calls, all empty) — see
  // plans/active/reasoning-pipeline/23 and 24. DeepSeek-V3 is a plain
  // non-reasoning chat model — no hidden channel, so it can't fail this
  // specific way by construction, which was the actual point of that swap
  // (not a quality upgrade). Confirmed via DeepInfra's own docs
  // (docs.deepinfra.com/chat/structured-outputs) as one of the models they
  // explicitly support strict json_schema structured output for — see
  // supportsJsonSchema()'s 'deepseek-v3' branch (router-shared.ts), added
  // alongside that swap so DeepInfra calls don't silently fall back to the
  // looser json_object mode the way Llama-3.1-8B did during this target's
  // PREVIOUS model swap (below) — that regression is exactly what this
  // comment warns the next swap not to repeat. (It wasn't: see above.)
  //
  // Prior history: this target started on Llama-3.1-8B-Instruct, moved to
  // gpt-oss-20b (2026-08-10, Samir's call) because real review-panel runs
  // showed Llama wasn't reliably incorporating the panel's regeneration
  // feedback — repeatedly re-failing the same standards instead of
  // converging. That's a genuinely different failure mode than gpt-oss's
  // (content quality vs. empty output), DeepSeek-V3's (speed), or
  // Llama-3.3-70B's (JSON formatting) — the current Qwen3-235B-A22B-2507
  // default has NOT been real-verified against ANY of these four prior risks
  // yet; watch early real runs for all of them the same way this whole
  // session has watched for everything else. Swap the string below (or
  // DEEPINFRA_MODEL env) to revert or try something else again.
  deepinfra: {
    provider: 'deepinfra',
    model: process.env.DEEPINFRA_MODEL ?? 'Qwen/Qwen3-235B-A22B-Instruct-2507',
    keyEnv: process.env.DEEPINFRA_KEY_ENV ?? 'DEEP_INFRA_API_KEY',
    contextWindow: CTX.deepinfra,
  },
  groqQwen: {
    provider: 'groq',
    model: process.env.GROQ_QWEN_MODEL ?? 'qwen/qwen3.6-27b',
    keyEnv: process.env.GROQ_QWEN_KEY_ENV ?? 'GROQ_QWEN_3_POINT_6_27B_API_KEY',
    contextWindow: CTX.groq,
  },
  groqGptOss20b: {
    provider: 'groq',
    model: process.env.GROQ_GPT_OSS_MODEL ?? 'openai/gpt-oss-20b',
    keyEnv: process.env.GROQ_GPT_OSS_KEY_ENV ?? 'GROQ_OPENAI_GPT_OSS_20B_API_KEY',
    contextWindow: CTX.groq,
  },
  geminiFlash: {
    provider: 'google',
    model: process.env.GEMINI_FLASH_MODEL ?? 'gemini-2.5-flash',
    keyEnv: process.env.GEMINI_KEY_ENV ?? 'GEMINI_FLASH_2_POINT_5_API_KEY',
    contextWindow: CTX.gemini,
  },
  cerebrasGptOss120b: {
    provider: 'cerebras',
    model: process.env.CEREBRAS_GPT_OSS_MODEL ?? 'gpt-oss-120b',
    keyEnv: process.env.CEREBRAS_KEY_ENV ?? 'CEREBRAS_GPT_OSS_120B_API_KEY',
    contextWindow: CTX.cerebras,
  },
  openrouterFree: {
    provider: 'openrouter',
    // Free qwen coder. NB: the spec's 'qwen/qwen-2.5-coder-32b:free' is not a real
    // OpenRouter model id (it 400s); the live free coder is 'qwen/qwen3-coder:free'.
    model: process.env.OPENROUTER_FREE_MODEL ?? 'qwen/qwen3-coder:free',
    keyEnv: process.env.OPENROUTER_KEY_ENV ?? 'OPENROUTER_API_KEY',
    contextWindow: CTX.openrouter,
  },
} satisfies Record<string, Target>

export function targetName(t: Target): string {
  return `${t.provider}/${t.model}`
}

// Test seam: injects a fake OpenAI client per target so the failover state
// machine is testable without keys or network; pass null to restore the real
// client cache. Deliberately NOT cleared by __resetRouterState.
let testClientFactory: ((t: Target) => OpenAI | null) | null = null
export function __setClientFactory(
  fn: ((t: { provider: string; model: string; keyEnv: string }) => unknown) | null
): void {
  testClientFactory = fn as ((t: Target) => OpenAI | null) | null
}

// Lazily built, cached one-per-key. Returns null when the target's key is not
// configured so that target is *skipped* (not treated as a fatal upstream error).
const clients = new Map<string, OpenAI | null>()
export function clientFor(target: Target): OpenAI | null {
  if (testClientFactory) return testClientFactory(target)
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
    log.error('ai', 'no API key for target — skipping', {
      keyEnv: target.keyEnv,
      provider: target.provider,
      model: target.model,
    })
  }
  clients.set(target.keyEnv, client)
  return client
}

export function __resetClients(): void {
  clients.clear()
}
