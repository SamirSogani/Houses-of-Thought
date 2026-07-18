// Provider/target configuration + client construction for the routing engine.
// Split from router.ts (600-LOC rule). Each provider contributes only a base
// URL. A routing *target* pairs a model with the exact env var holding that
// model's key — the .env vars are named after the specific keys they carry, so
// every model authenticates with its own key (Groq's two models therefore use
// two distinct keys on the same base URL). Base URLs, model IDs, and key
// env-var names are all overridable via env (.env.example documents the matrix;
// docs/operations/model-sunset-runbook.md is the playbook).

import OpenAI from 'openai'

// Fail loudly if this module is ever pulled into a client bundle — the API keys
// must never ship to the browser.
if (typeof window !== 'undefined') {
  throw new Error('lib/ai/router-config.ts is server-only and must not run in the browser')
}

export type ProviderId = 'mistral' | 'groq' | 'google' | 'cerebras' | 'openrouter'

const BASE_URLS: Record<ProviderId, string> = {
  mistral: process.env.MISTRAL_BASE_URL ?? 'https://api.mistral.ai/v1',
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
    console.error(
      `[ai] no API key at ${target.keyEnv} for ${target.provider}/${target.model} — skipping`
    )
  }
  clients.set(target.keyEnv, client)
  return client
}

export function __resetClients(): void {
  clients.clear()
}
