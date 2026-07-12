'use client'

// Admin AI-router monitor. Reads GET /api/admin/ai-status for a passive snapshot
// (lanes, penalty box, daily airbag, per-target health from live traffic) and
// POSTs the same endpoint to fire an active liveness probe at every provider.
// Server-gated: the /admin page and both API routes 403 non-admins.

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import type { RouterSnapshot, LaneStep, ProbeResult, TargetStatus } from '@/lib/ai/router'

export function modelHref(provider: string, model: string): string {
  return `/admin/model?name=${encodeURIComponent(`${provider}/${model}`)}`
}

const modelLinkStyle: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontSize: 14,
  fontWeight: 600,
  color: 'var(--ink)',
  textDecoration: 'underline',
  textDecorationColor: 'var(--rule)',
  textUnderlineOffset: 3,
}

// ── status → colour/label ─────────────────────────────────────────────────────
const OK = 'var(--green-strong)'
const DOWN = 'var(--warning)'
const WARN = 'var(--amber-hover)'
const MUTE = 'var(--ink-subtle)'

export function statusMeta(s: TargetStatus | ProbeResult['status']): { color: string; label: string } {
  switch (s) {
    case 'ok':
      return { color: OK, label: 'UP' }
    case 'rate_limited':
    case 'rate-limited':
      return { color: WARN, label: 'RATE-LIMITED' }
    case 'daily':
    case 'daily-limit':
      return { color: DOWN, label: 'DAILY LIMIT' }
    case 'error':
      return { color: DOWN, label: 'ERROR' }
    case 'unconfigured':
      return { color: MUTE, label: 'NO KEY' }
    default:
      return { color: MUTE, label: 'UNKNOWN' }
  }
}

export function ago(ms?: number): string {
  if (!ms) return '—'
  const s = Math.round((Date.now() - ms) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.round(s / 60)}m ago`
  return `${Math.round(s / 3600)}h ago`
}

export const mono: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  letterSpacing: '0.06em',
}

export function Dot({ color }: { color: string }) {
  return (
    <span
      style={{ width: 9, height: 9, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }}
    />
  )
}

export function Badge({ status }: { status: TargetStatus | ProbeResult['status'] }) {
  const { color, label } = statusMeta(status)
  return (
    <span style={{ ...mono, display: 'inline-flex', alignItems: 'center', gap: 6, color }}>
      <Dot color={color} />
      {label}
    </span>
  )
}

// ── panels ────────────────────────────────────────────────────────────────────
export function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: 'var(--white)',
        border: '1px solid var(--rule)',
        borderRadius: 'var(--radius-card)',
        padding: 20,
      }}
    >
      {children}
    </div>
  )
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ ...mono, textTransform: 'uppercase', color: 'var(--ink-subtle)', marginBottom: 12 }}>
      {children}
    </div>
  )
}

function Lane({ title, steps, probeByName }: { title: string; steps: LaneStep[]; probeByName: Map<string, ProbeResult> }) {
  return (
    <Card>
      <SectionLabel>{title}</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {steps.map((step, i) => {
          const probe = probeByName.get(`${step.provider}/${step.model}`)
          return (
            <div key={`${step.model}-${i}`}>
              {i > 0 && (
                <div style={{ ...mono, color: 'var(--rule)', margin: '2px 0 2px 4px' }}>↓</div>
              )}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 12px',
                  border: '1px solid var(--rule-soft)',
                  borderRadius: 8,
                  background: step.configured ? 'transparent' : 'var(--parchment)',
                  opacity: step.configured ? 1 : 0.7,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Link href={modelHref(step.provider, step.model)} style={modelLinkStyle}>
                    {step.provider} · {step.model}
                  </Link>
                  <div style={{ ...mono, color: 'var(--ink-subtle)', marginTop: 3 }}>
                    {step.label}
                    {step.note ? ` · ${step.note}` : ''}
                  </div>
                </div>
                {probe ? (
                  <Badge status={probe.status} />
                ) : !step.configured ? (
                  <Badge status="unconfigured" />
                ) : (
                  <span style={{ ...mono, color: 'var(--ink-subtle)' }}>key set</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

// ── main ──────────────────────────────────────────────────────────────────────
export function AiMonitor() {
  const router = useRouter()
  const [snap, setSnap] = useState<RouterSnapshot | null>(null)
  const [probe, setProbe] = useState<ProbeResult[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    setErr(null)
    try {
      const r = await fetch('/api/admin/ai-status', { cache: 'no-store' })
      if (!r.ok) throw new Error(`status ${r.status}`)
      const d = await r.json()
      setSnap(d.snapshot)
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  const runCheck = useCallback(async () => {
    setChecking(true)
    setErr(null)
    try {
      const r = await fetch('/api/admin/ai-status', { method: 'POST', cache: 'no-store' })
      if (!r.ok) throw new Error(`status ${r.status}`)
      const d = await r.json()
      setSnap(d.snapshot)
      setProbe(d.probe)
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setChecking(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const probeByName = new Map((probe ?? []).map((p) => [p.name, p]))

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

  return (
    <div style={{ minHeight: '100vh', background: 'var(--parchment)' }}>
      <DashboardHeader onSignOut={handleSignOut} active="admin" />

      <div className="container" style={{ paddingBlock: 32, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* title + actions */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 600, color: 'var(--ink)' }}>
              AI Router Monitor
            </h1>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--ink-mid)', marginTop: 4 }}>
              Multi-LLM failover engine — providers, lanes, penalty box, and daily airbag.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button style={btn} onClick={load} disabled={loading}>
              Refresh
            </button>
            <button
              style={{ ...btn, background: 'var(--amber)', borderColor: 'var(--amber)' }}
              onClick={runCheck}
              disabled={checking}
            >
              {checking ? 'Checking…' : 'Run live check'}
            </button>
          </div>
        </div>

        {err && (
          <Card>
            <span style={{ ...mono, color: 'var(--warning)' }}>Failed to load: {err}</span>
          </Card>
        )}

        {loading && !snap ? (
          <Card>
            <span style={{ ...mono, color: 'var(--ink-subtle)' }}>Loading…</span>
          </Card>
        ) : snap ? (
          <>
            {/* global state */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
              <Card>
                <SectionLabel>Daily airbag</SectionLabel>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Dot color={snap.dailyLimitsExhausted ? DOWN : OK} />
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>
                    {snap.dailyLimitsExhausted ? 'ARMED — routing to OpenRouter' : 'Clear'}
                  </span>
                </div>
                <div style={{ ...mono, color: 'var(--ink-subtle)', marginTop: 8 }}>
                  OpenRouter stays isolated until a verified daily blackout.
                </div>
              </Card>

              <Card>
                <SectionLabel>Groq penalty box</SectionLabel>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Dot color={snap.groq.coolingDown ? WARN : snap.groq.recovering ? WARN : OK} />
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>
                    {snap.groq.coolingDown
                      ? `Cooling ${Math.ceil(snap.groq.msRemaining / 1000)}s`
                      : snap.groq.recovering
                        ? 'Recovering'
                        : 'Normal'}
                  </span>
                </div>
                <div style={{ ...mono, color: 'var(--ink-subtle)', marginTop: 8 }}>
                  Current Groq model: {snap.groq.currentModel}
                </div>
              </Card>

              <Card>
                <SectionLabel>Providers configured</SectionLabel>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 600, color: 'var(--ink)' }}>
                  {snap.targets.filter((t) => t.configured).length}
                  <span style={{ ...mono, color: 'var(--ink-subtle)', fontWeight: 400 }}> / {snap.targets.length} targets</span>
                </div>
                <div style={{ ...mono, color: 'var(--ink-subtle)', marginTop: 8 }}>
                  Keys resolved from environment.
                </div>
              </Card>
            </div>

            {/* lanes */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
              <Lane title="Suggestor lane · sidebar suggestions (Cerebras-first)" steps={snap.lanes.suggestor} probeByName={probeByName} />
              <Lane title="Real-time lane · coach / critic" steps={snap.lanes.realtime} probeByName={probeByName} />
              <Lane title="Drafter lane · on-demand" steps={snap.lanes.drafter} probeByName={probeByName} />
            </div>

            {/* target health table */}
            <Card>
              <SectionLabel>Target health {probe ? '· live probe' : '· from live traffic'}</SectionLabel>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', ...mono, fontSize: 12 }}>
                  <thead>
                    <tr style={{ textAlign: 'left', color: 'var(--ink-subtle)' }}>
                      <th style={th}>Provider / Model</th>
                      <th style={th}>Key env</th>
                      <th style={th}>Status</th>
                      <th style={th}>OK / Fail</th>
                      <th style={th}>Last seen</th>
                      <th style={th}>Probe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snap.targets.map((t) => {
                      const p = probeByName.get(`${t.provider}/${t.model}`)
                      return (
                        <tr key={`${t.provider}/${t.model}`} style={{ borderTop: '1px solid var(--rule-soft)' }}>
                          <td style={td}>
                            <Link href={modelHref(t.provider, t.model)} style={{ ...modelLinkStyle, fontSize: 13 }}>
                              {t.provider} · {t.model}
                            </Link>
                          </td>
                          <td style={{ ...td, color: t.configured ? 'var(--ink-mid)' : 'var(--warning)' }}>
                            {t.keyEnv}
                            {!t.configured && ' (missing)'}
                          </td>
                          <td style={td}>
                            <Badge status={t.lastStatus} />
                            {t.lastDetail ? <span style={{ color: 'var(--ink-subtle)' }}> · {t.lastDetail}</span> : null}
                          </td>
                          <td style={td}>
                            <span style={{ color: 'var(--green-strong)' }}>{t.okCount}</span>
                            {' / '}
                            <span style={{ color: t.failCount ? 'var(--warning)' : 'var(--ink-subtle)' }}>{t.failCount}</span>
                          </td>
                          <td style={{ ...td, color: 'var(--ink-subtle)' }}>{ago(t.lastAt)}</td>
                          <td style={td}>
                            {p ? (
                              <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                                <Badge status={p.status} />
                                <span style={{ color: 'var(--ink-subtle)' }}>{p.latencyMs}ms</span>
                              </span>
                            ) : (
                              <span style={{ color: 'var(--rule)' }}>—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Card>

            <div style={{ ...mono, color: 'var(--ink-subtle)', textAlign: 'right' }}>
              Snapshot at {new Date(snap.now).toLocaleTimeString()}. “Run live check” pings every provider (spends a sliver of quota).
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}

const th: React.CSSProperties = { padding: '6px 10px', textTransform: 'uppercase', fontWeight: 500, whiteSpace: 'nowrap' }
const td: React.CSSProperties = { padding: '10px', verticalAlign: 'top' }
