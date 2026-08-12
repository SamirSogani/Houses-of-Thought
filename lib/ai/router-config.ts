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
  // 131K covers either DeepInfra model this has run (see TARGETS.deepinfra
  // below): gpt-oss-20b's 131,072 max, and Llama-3.1-8B-Instruct's published
  // window if ever reverted to.
  deepinfra: Number(process.env.DEEPINFRA_CONTEXT ?? 131_000),
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
  // Active default: 'openai/gpt-oss-20b' — swapped from Llama-3.1-8B-Instruct
  // (2026-08-10, Samir's call): real review-panel runs showed Llama wasn't
  // reliably incorporating the panel's regeneration feedback, repeatedly
  // re-failing the same standards instead of converging. Same model id this
  // codebase already runs successfully on Groq (TARGETS.groqGptOss20b) and
  // Cerebras, Apache-2.0/OpenAI-released so unlikely to be dropped, and it
  // matches supportsJsonSchema()/reasoningEffortFor()'s 'gpt-oss' check
  // (router-shared.ts) — gets the strict json_schema path already proven
  // reliable elsewhere, instead of the looser json_object path Llama got.
  // NOT cheaper (~$0.04/$0.15 per 1M vs Llama's ~$0.02-0.03/$0.05) — this
  // swap is for reliability, not price. Llama-3.1-8B-Instruct is the
  // fallback if gpt-oss-20b doesn't hold up on some area either — swap the
  // string below (or DEEPINFRA_MODEL env) back to switch again.
  deepinfra: {
    provider: 'deepinfra',
    model: process.env.DEEPINFRA_MODEL ?? 'openai/gpt-oss-20b',
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
