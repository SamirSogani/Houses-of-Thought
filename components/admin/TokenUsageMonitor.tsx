'use client'

// Token usage & cost ledger (decision 020). Reads GET /api/admin/token-usage
// for a per-model breakdown (input/output/total tokens, cost, call count)
// sourced from the durable ai_token_usage ledger (all instances, all AI
// routes pooled). Server-gated: the /admin/usage page and the API route both
// 403/404 non-admins.

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSignOut } from '@/components/useAuthedPage'
import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import { Card, SectionLabel, mono } from './AiMonitor'
// Type-only import — lib/ai/token-usage.ts is server-only at runtime.
import type { TokenUsageSummary, UsageRange } from '@/lib/ai/token-usage'

const RANGES: { value: UsageRange; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: 'all', label: 'All (90d)' },
]

function fmtInt(n: number): string {
  return n.toLocaleString('en-US')
}

function fmtUsd(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`
}

const th: React.CSSProperties = { padding: '6px 10px', textTransform: 'uppercase', fontWeight: 500, whiteSpace: 'nowrap' }
const td: React.CSSProperties = { padding: '10px', verticalAlign: 'top' }

export function TokenUsageMonitor() {
  const [range, setRange] = useState<UsageRange>('today')
  const [summary, setSummary] = useState<TokenUsageSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async (r: UsageRange) => {
    setLoading(true)
    setErr(null)
    try {
      const res = await fetch(`/api/admin/token-usage?range=${r}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { summary: TokenUsageSummary | null }
      setSummary(data.summary)
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(range)
  }, [load, range])

  const signOut = useSignOut()

  const btn: React.CSSProperties = {
    ...mono,
    textTransform: 'uppercase',
    height: 38,
    padding: '0 16px',
    borderRadius: 'var(--radius-btn)',
    border: '1px solid var(--rule)',
    background: 'var(--white)',
    color: 'var(--ink)',
    cursor: 'pointer',
  }
  const btnActive: React.CSSProperties = {
    ...btn,
    background: 'var(--amber)',
    borderColor: 'var(--amber)',
  }

  const totals = summary?.totals
  const models = summary?.models ?? []

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--parchment)' }}>
      <DashboardHeader onSignOut={() => void signOut()} active="admin" />

      <div className="container" style={{ paddingBlock: 32, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 600, color: 'var(--ink)' }}>
              Token Usage &amp; Cost
            </h1>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--ink-mid)', marginTop: 4 }}>
              Input / output tokens and spend per model, across every AI provider.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link href="/admin" style={{ ...btn, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
              AI monitor
            </Link>
            <button style={btn} onClick={() => void load(range)} disabled={loading}>
              Refresh
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {RANGES.map((r) => (
            <button key={r.value} style={r.value === range ? btnActive : btn} onClick={() => setRange(r.value)}>
              {r.label}
            </button>
          ))}
        </div>

        {err && (
          <Card>
            <span style={{ ...mono, color: 'var(--warning-text)' }}>Failed to load: {err}</span>
          </Card>
        )}

        {loading && !summary ? (
          <Card>
            <span style={{ ...mono, color: 'var(--ink-subtle)' }}>Loading…</span>
          </Card>
        ) : !summary ? (
          <Card>
            <span style={{ ...mono, color: 'var(--warning-text)' }}>
              Usage read unavailable (service-role/env not configured, or the query failed) — see server logs.
            </span>
          </Card>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
              <Card>
                <SectionLabel>Calls</SectionLabel>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: 22, fontWeight: 600, color: 'var(--ink)' }}>
                  {fmtInt(totals!.calls)}
                </div>
              </Card>
              <Card>
                <SectionLabel>Input tokens</SectionLabel>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: 22, fontWeight: 600, color: 'var(--ink)' }}>
                  {fmtInt(totals!.inputTokens)}
                </div>
              </Card>
              <Card>
                <SectionLabel>Output tokens</SectionLabel>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: 22, fontWeight: 600, color: 'var(--ink)' }}>
                  {fmtInt(totals!.outputTokens)}
                </div>
              </Card>
              <Card>
                <SectionLabel>Total tokens</SectionLabel>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: 22, fontWeight: 600, color: 'var(--ink)' }}>
                  {fmtInt(totals!.totalTokens)}
                </div>
              </Card>
              <Card>
                <SectionLabel>Total cost</SectionLabel>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: 22, fontWeight: 600, color: 'var(--ink)' }}>
                  {fmtUsd(totals!.costUsd)}
                </div>
              </Card>
            </div>

            {totals!.unpricedCalls > 0 && (
              <Card>
                <span style={{ ...mono, color: 'var(--amber-text)' }}>
                  {fmtInt(totals!.unpricedCalls)} call(s) used a model with no entry in lib/ai/token-usage.ts&apos;s
                  pricing table — their cost reads as $0 and total cost above is undercounted. Add a price row for
                  that model.
                </span>
              </Card>
            )}

            <Card>
              <SectionLabel>By model · range: {RANGES.find((r) => r.value === range)?.label}</SectionLabel>
              {models.length === 0 ? (
                <div style={{ ...mono, color: 'var(--ink-subtle)' }}>No usage recorded for this range.</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', ...mono, fontSize: 12 }}>
                    <thead>
                      <tr style={{ textAlign: 'left', color: 'var(--ink-subtle)' }}>
                        <th style={th}>Provider / Model</th>
                        <th style={{ ...th, textAlign: 'right' }}>Calls</th>
                        <th style={{ ...th, textAlign: 'right' }}>Input tokens</th>
                        <th style={{ ...th, textAlign: 'right' }}>Output tokens</th>
                        <th style={{ ...th, textAlign: 'right' }}>Total tokens</th>
                        <th style={{ ...th, textAlign: 'right' }}>Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {models.map((m) => (
                        <tr key={`${m.provider}/${m.model}`} style={{ borderTop: '1px solid var(--rule-soft)' }}>
                          <td style={{ ...td, color: 'var(--ink)', fontWeight: 600 }}>
                            {m.provider} · {m.model}
                            {m.unpricedCalls > 0 && (
                              <span style={{ color: 'var(--amber-text)' }}> (unpriced ×{m.unpricedCalls})</span>
                            )}
                          </td>
                          <td style={{ ...td, textAlign: 'right', color: 'var(--ink-mid)' }}>{fmtInt(m.calls)}</td>
                          <td style={{ ...td, textAlign: 'right', color: 'var(--ink-mid)' }}>{fmtInt(m.inputTokens)}</td>
                          <td style={{ ...td, textAlign: 'right', color: 'var(--ink-mid)' }}>{fmtInt(m.outputTokens)}</td>
                          <td style={{ ...td, textAlign: 'right', color: 'var(--ink)' }}>{fmtInt(m.totalTokens)}</td>
                          <td style={{ ...td, textAlign: 'right', color: 'var(--ink)' }}>{fmtUsd(m.costUsd)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <div style={{ ...mono, color: 'var(--ink-subtle)', textAlign: 'right' }}>
              Costs are computed from a hand-maintained price table (lib/ai/token-usage.ts) at the time each call was
              made — update it whenever a provider reprices.
            </div>
          </>
        )}
      </div>
    </div>
  )
}
