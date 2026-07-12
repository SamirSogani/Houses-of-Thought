'use client'

// Per-model detail page for the admin AI monitor. Reached by clicking a model in
// the monitor. Shows the model's health, an event log (errors + successes), a
// button to run a live check on THIS model only, and its failover position — the
// model it falls back from (upstream) and the one it falls back to (downstream).
// Server-gated: the /admin/model page and the API route 403 non-admins.

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import { Card, SectionLabel, Badge, Dot, mono, ago, statusMeta, modelHref } from './AiMonitor'
import type { TargetDetail, LanePosition, LogEvent, ProbeResult } from '@/lib/ai/router'

function kindOf(e: LogEvent) {
  // Map an internal event kind onto the shared status vocabulary for the badge.
  return e.kind
}

function ChainNode({ step, current }: { step: { provider: string; model: string } | null; current?: boolean }) {
  if (!step) return null
  const label = `${step.provider} · ${step.model}`
  const inner = current ? (
    <span style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{label}</span>
  ) : (
    <Link href={modelHref(step.provider, step.model)} style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600, color: 'var(--ink-mid)', textDecoration: 'underline', textDecorationColor: 'var(--rule)', textUnderlineOffset: 3 }}>
      {label}
    </Link>
  )
  return (
    <div
      style={{
        padding: '10px 12px',
        borderRadius: 8,
        border: current ? '2px solid var(--amber)' : '1px solid var(--rule-soft)',
        background: current ? 'var(--amber-tint)' : 'transparent',
      }}
    >
      {inner}
    </div>
  )
}

function Transition({ text }: { text: string }) {
  return (
    <div style={{ ...mono, color: 'var(--ink-subtle)', padding: '4px 0 4px 8px' }}>↓ {text}</div>
  )
}

function Position({ name, pos }: { name: string; pos: LanePosition }) {
  const [provider, ...rest] = name.split('/')
  const model = rest.join('/')
  const self = { provider, model }
  const laneLabel =
    pos.lane === 'suggestor'
      ? 'Suggestor lane (sidebar suggestions)'
      : pos.lane === 'realtime'
        ? 'Real-time lane (coach / critic)'
        : 'Drafter lane (on-demand)'
  return (
    <Card>
      <SectionLabel>
        {laneLabel} · step {pos.index + 1} of {pos.total}
      </SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {pos.prev ? (
          <>
            <ChainNode step={pos.prev} />
            <Transition text={`on failure → this model (${pos.arriveVia})`} />
          </>
        ) : (
          <div style={{ ...mono, color: 'var(--ink-subtle)', paddingBottom: 4 }}>
            Entry point — primary for this lane.
          </div>
        )}

        <ChainNode step={self} current />

        {pos.next ? (
          <>
            <Transition text={`on this model's failure → next (${pos.fallsToVia})`} />
            <ChainNode step={pos.next} />
          </>
        ) : (
          <div style={{ ...mono, color: 'var(--ink-subtle)', paddingTop: 4 }}>
            Terminal — no further fallback in this lane.
          </div>
        )}
      </div>
    </Card>
  )
}

export function ModelDetail({ name }: { name: string }) {
  const router = useRouter()
  const [detail, setDetail] = useState<TargetDetail | null>(null)
  const [probe, setProbe] = useState<ProbeResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [errorsOnly, setErrorsOnly] = useState(false)

  const q = `/api/admin/ai-model?name=${encodeURIComponent(name)}`

  const load = useCallback(async () => {
    setErr(null)
    try {
      const r = await fetch(q, { cache: 'no-store' })
      if (r.status === 404) throw new Error('unknown model')
      if (!r.ok) throw new Error(`status ${r.status}`)
      setDetail((await r.json()).detail)
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [q])

  const runCheck = useCallback(async () => {
    setChecking(true)
    setErr(null)
    try {
      const r = await fetch(q, { method: 'POST', cache: 'no-store' })
      if (!r.ok) throw new Error(`status ${r.status}`)
      const d = await r.json()
      setDetail(d.detail)
      setProbe(d.probe)
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setChecking(false)
    }
  }, [q])

  useEffect(() => {
    load()
  }, [load])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const [provider, ...rest] = name.split('/')
  const model = rest.join('/')
  const h = detail?.health ?? null
  const log = (detail?.events ?? []).slice().reverse() // most recent first
  const shown = errorsOnly ? log.filter((e) => e.kind !== 'ok') : log

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
        <Link href="/admin" style={{ ...mono, color: 'var(--ink-subtle)' }}>
          ← All models
        </Link>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ ...mono, color: 'var(--ink-subtle)', textTransform: 'uppercase' }}>{provider}</div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 600, color: 'var(--ink)' }}>
              {model}
            </h1>
          </div>
          <button
            style={{ ...btn, background: 'var(--amber)', borderColor: 'var(--amber)' }}
            onClick={runCheck}
            disabled={checking || !!err}
          >
            {checking ? 'Checking…' : 'Run live check on this model'}
          </button>
        </div>

        {err && (
          <Card>
            <span style={{ ...mono, color: 'var(--warning)' }}>Failed to load: {err}</span>
          </Card>
        )}

        {loading && !detail ? (
          <Card>
            <span style={{ ...mono, color: 'var(--ink-subtle)' }}>Loading…</span>
          </Card>
        ) : detail && detail.found ? (
          <>
            {/* health + live check result */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
              <Card>
                <SectionLabel>Current health</SectionLabel>
                {h && (
                  <>
                    <div style={{ marginBottom: 8 }}>
                      <Badge status={h.lastStatus} />
                      {h.lastDetail ? <span style={{ ...mono, color: 'var(--ink-subtle)' }}> · {h.lastDetail}</span> : null}
                    </div>
                    <div style={{ ...mono, color: 'var(--ink-subtle)' }}>
                      <div>
                        Key: {h.keyEnv} {h.configured ? '' : '(missing)'}
                      </div>
                      <div style={{ marginTop: 4 }}>
                        OK <span style={{ color: 'var(--green-strong)' }}>{h.okCount}</span> · Fail{' '}
                        <span style={{ color: h.failCount ? 'var(--warning)' : 'var(--ink-subtle)' }}>{h.failCount}</span> ·
                        last {ago(h.lastAt)}
                      </div>
                    </div>
                  </>
                )}
              </Card>

              <Card>
                <SectionLabel>Live check result</SectionLabel>
                {probe ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Badge status={probe.status} />
                    <span style={{ ...mono, color: 'var(--ink-subtle)' }}>
                      {probe.latencyMs}ms {probe.detail ? `· ${probe.detail}` : ''}
                    </span>
                  </div>
                ) : (
                  <span style={{ ...mono, color: 'var(--ink-subtle)' }}>
                    Not run yet — “Run live check” pings this model once (spends a sliver of quota).
                  </span>
                )}
              </Card>
            </div>

            {/* failover position */}
            {detail.positions.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
                {detail.positions.map((p) => (
                  <Position key={p.lane} name={name} pos={p} />
                ))}
              </div>
            ) : (
              <Card>
                <span style={{ ...mono, color: 'var(--ink-subtle)' }}>
                  This model is the daily-blackout airbag — outside the normal failover lanes.
                </span>
              </Card>
            )}

            {/* event log */}
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <SectionLabel>Event log · this server instance</SectionLabel>
                <label style={{ ...mono, color: 'var(--ink-subtle)', display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
                  <input type="checkbox" checked={errorsOnly} onChange={(e) => setErrorsOnly(e.target.checked)} />
                  Errors only
                </label>
              </div>
              {shown.length === 0 ? (
                <span style={{ ...mono, color: 'var(--ink-subtle)' }}>
                  {log.length === 0
                    ? 'No events recorded yet. Run a live check, or wait for AI traffic to hit this model.'
                    : 'No error events — everything has succeeded so far.'}
                </span>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', ...mono, fontSize: 12 }}>
                    <thead>
                      <tr style={{ textAlign: 'left', color: 'var(--ink-subtle)' }}>
                        <th style={th}>When</th>
                        <th style={th}>Source</th>
                        <th style={th}>Outcome</th>
                        <th style={th}>Latency</th>
                        <th style={th}>Detail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shown.map((e, i) => (
                        <tr key={i} style={{ borderTop: '1px solid var(--rule-soft)' }}>
                          <td style={td}>{new Date(e.at).toLocaleTimeString()}</td>
                          <td style={{ ...td, color: 'var(--ink-subtle)' }}>{e.source}</td>
                          <td style={td}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: statusMeta(kindOf(e)).color }}>
                              <Dot color={statusMeta(kindOf(e)).color} />
                              {statusMeta(kindOf(e)).label}
                            </span>
                          </td>
                          <td style={{ ...td, color: 'var(--ink-subtle)' }}>{e.latencyMs != null ? `${e.latencyMs}ms` : '—'}</td>
                          <td style={{ ...td, color: 'var(--ink-mid)' }}>{e.detail ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </>
        ) : null}
      </div>
    </div>
  )
}

const th: React.CSSProperties = { padding: '6px 10px', textTransform: 'uppercase', fontWeight: 500, whiteSpace: 'nowrap' }
const td: React.CSSProperties = { padding: '10px', verticalAlign: 'top' }
