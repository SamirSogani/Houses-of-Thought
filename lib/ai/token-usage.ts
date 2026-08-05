// Per-call token usage + cost ledger for the admin "Token usage" panel
// (`ai_token_usage`, 0033_ai_token_usage.sql; decision 020). Fire-and-forget
// write from lib/ai/router.ts's execute(), right after callProvider returns a
// successful completion — same service-role client + VITEST hard-gate +
// never-throws contract as lib/ai/reasoning/persistence.ts's persistRunStep.
// A lost write just means that one call is missing from the ledger; never a
// functional regression to the co-pilot.

import { createClient as createServiceClient, type SupabaseClient } from '@supabase/supabase-js'
import { log } from '@/lib/log'
import type { ProviderId } from './router-config'
import type { AiRole } from './router-shared'

if (typeof window !== 'undefined') {
  throw new Error('lib/ai/token-usage.ts is server-only and must not run in the browser')
}

// ── Pricing (USD per 1,000,000 tokens) ────────────────────────────────────────
// Hand-maintained — none of these providers exposes a pricing API. Sourced
// 2026-08-04 from each provider's own pricing page; re-check before trusting
// these for real invoice reconciliation, and update whenever TARGETS
// (router-config.ts) changes model or a provider reprices. Keyed by the exact
// `${provider}/${model}` string a call actually used (matches
// router-monitor.ts's targetName()) — NOT by the TARGETS slot name, so an
// env-overridden model (router-config.ts documents per-target env vars for
// this) is priced correctly if it's listed here, or flagged unpriced (see
// `priceFor` below) rather than silently reusing the wrong row's price.
const PRICING: Record<string, { inputPer1M: number; outputPer1M: number }> = {
  'mistral/ministral-8b-latest': { inputPer1M: 0.15, outputPer1M: 0.15 },
  // Groq doesn't list "qwen3.6-27b" as its own line item; priced at Groq's
  // published qwen3-32b rate, the nearest same-class equivalent — verify
  // against https://groq.com/pricing before relying on this figure.
  'groq/qwen/qwen3.6-27b': { inputPer1M: 0.29, outputPer1M: 0.59 },
  'groq/openai/gpt-oss-20b': { inputPer1M: 0.075, outputPer1M: 0.3 },
  // Google AI Studio direct pricing (the endpoint router-config.ts's default
  // GEMINI_BASE_URL actually hits) — cheaper than the OpenRouter-listed rate
  // for the same model.
  'google/gemini-2.5-flash': { inputPer1M: 0.15, outputPer1M: 1.25 },
  'cerebras/gpt-oss-120b': { inputPer1M: 0.35, outputPer1M: 0.75 },
  'openrouter/qwen/qwen3-coder:free': { inputPer1M: 0, outputPer1M: 0 },
}

// De-dupes the "no price entry" warning per unknown target name so a hot
// misconfigured target doesn't spam the log once per call.
const unpricedWarned = new Set<string>()

function priceFor(name: string): { inputPer1M: number; outputPer1M: number } | null {
  const p = PRICING[name]
  if (p) return p
  if (!unpricedWarned.has(name)) {
    unpricedWarned.add(name)
    log.warn('ai/token-usage', 'no price entry for target — cost recorded as unpriced', { name })
  }
  return null
}

// Same test/config gating as reasoning/persistence.ts's serviceClient(): hard-
// gated on VITEST so a test can never write to real shared state, and skips
// cleanly if the service-role key isn't configured (e.g. a contributor's
// local .env without it).
function testEnv(): boolean {
  return Boolean(process.env.VITEST)
}

let service: SupabaseClient | null = null
function serviceClient(): SupabaseClient | null {
  if (testEnv()) return null
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null
  if (!service) {
    service = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return service
}

export interface CallUsage {
  provider: ProviderId
  model: string
  role: AiRole
  inputTokens: number
  outputTokens: number
}

// Fire-and-forget: never awaited by the caller, never throws. Mirrors
// persistRunStep's contract exactly.
export function recordTokenUsage(usage: CallUsage): void {
  const client = serviceClient()
  if (!client) return
  const name = `${usage.provider}/${usage.model}`
  const price = priceFor(name)
  const costUsd = price
    ? (usage.inputTokens / 1_000_000) * price.inputPer1M + (usage.outputTokens / 1_000_000) * price.outputPer1M
    : 0
  void client
    .from('ai_token_usage')
    .insert({
      day: new Date().toISOString().slice(0, 10),
      provider: usage.provider,
      model: usage.model,
      role: usage.role,
      input_tokens: usage.inputTokens,
      output_tokens: usage.outputTokens,
      total_tokens: usage.inputTokens + usage.outputTokens,
      cost_usd: Number(costUsd.toFixed(6)),
      priced: Boolean(price),
    })
    .then(({ error }: { error: { message: string } | null }) => {
      if (error) {
        log.error('ai/token-usage', 'failed to record token usage (non-fatal)', { name, error: error.message })
      }
    })
}

// ── Read side (admin "Token usage" panel, /admin/usage) ───────────────────────
// Same service-role client as the write side above, same never-throws / null-
// on-failure contract as reasoning/persistence.ts's read side (and
// limits.ts's getAiUsageSummary) — the panel must render "unavailable"
// instead of a 500.

export type UsageRange = 'today' | '7d' | '30d' | 'all'

// null ('all') matches 0033's 90-day retention window, not a true forever
// total — rows older than that are already pruned weekly.
function sinceDate(range: UsageRange): string | null {
  const d = new Date()
  if (range === 'today') return d.toISOString().slice(0, 10)
  if (range === '7d') {
    d.setUTCDate(d.getUTCDate() - 6)
    return d.toISOString().slice(0, 10)
  }
  if (range === '30d') {
    d.setUTCDate(d.getUTCDate() - 29)
    return d.toISOString().slice(0, 10)
  }
  return null
}

export interface ModelUsage {
  provider: string
  model: string
  calls: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  costUsd: number
  unpricedCalls: number // subset of `calls` with no pricing entry; costUsd excludes these
}

export interface TokenUsageSummary {
  range: UsageRange
  since: string | null
  models: ModelUsage[]
  totals: {
    calls: number
    inputTokens: number
    outputTokens: number
    totalTokens: number
    costUsd: number
    unpricedCalls: number
  }
}

interface SummaryRow {
  provider: string
  model: string
  calls: number
  input_tokens: number
  output_tokens: number
  total_tokens: number
  cost_usd: number
  unpriced_calls: number
}

// Delegates the group-by to Postgres (ai_token_usage_summary RPC) so this
// scales with the number of distinct models, not the number of logged calls.
export async function getTokenUsageSummary(range: UsageRange): Promise<TokenUsageSummary | null> {
  const client = serviceClient()
  if (!client) return null
  const since = sinceDate(range)
  try {
    const { data, error } = await client.rpc('ai_token_usage_summary', { since_day: since })
    if (error) throw error
    const rows = (data ?? []) as SummaryRow[]
    const models: ModelUsage[] = rows
      .map((r) => ({
        provider: r.provider,
        model: r.model,
        calls: Number(r.calls),
        inputTokens: Number(r.input_tokens),
        outputTokens: Number(r.output_tokens),
        totalTokens: Number(r.total_tokens),
        costUsd: Number(r.cost_usd),
        unpricedCalls: Number(r.unpriced_calls),
      }))
      .sort((a, b) => b.totalTokens - a.totalTokens)
    const totals = models.reduce(
      (acc, m) => ({
        calls: acc.calls + m.calls,
        inputTokens: acc.inputTokens + m.inputTokens,
        outputTokens: acc.outputTokens + m.outputTokens,
        totalTokens: acc.totalTokens + m.totalTokens,
        costUsd: acc.costUsd + m.costUsd,
        unpricedCalls: acc.unpricedCalls + m.unpricedCalls,
      }),
      { calls: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: 0, unpricedCalls: 0 }
    )
    return { range, since, models, totals: { ...totals, costUsd: Number(totals.costUsd.toFixed(6)) } }
  } catch (err) {
    log.error('ai/token-usage', 'failed to summarize token usage (non-fatal)', {
      range,
      error: (err as Error)?.message,
    })
    return null
  }
}

// Test-only: drop the cached client so a test can force a fresh env re-read.
export function __resetTokenUsageClient(): void {
  service = null
}
