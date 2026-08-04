'use client'

// Browse past reasoning-pipeline runs (decision 019, Phase 2 item 1 —
// plans/active/reasoning-pipeline/15-persistence.md). Single-page
// master/detail, matching AiMonitor's dense-single-page convention rather
// than a separate [id] route: the list and the selected run's full
// packets/verdicts (reused via ReasoningStagesList — the same component the
// live pipeline page renders progress with) both live on this one page.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import { useSignOut } from '@/components/useAuthedPage'
import { ReasoningStagesList, type RunState } from './ReasoningStagesList'
import { FinalAnswerCard } from './FinalAnswerCard'
import type { StepId } from '@/lib/ai/reasoning/steps'
import type { ReasoningRunStatus } from '@/lib/ai/reasoning/persistence'

interface RunSummary {
  id: string
  originalQuery: string
  status: ReasoningRunStatus
  lastStep: StepId
  haltReason: string | null
  panelsOff: boolean
  createdAt: string
  updatedAt: string
}

interface RunDetail extends RunSummary {
  runState: RunState
}

const mono: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.06em' }

const statusPill: Record<ReasoningRunStatus, React.CSSProperties> = {
  done: { color: 'var(--amber-text)', background: 'var(--amber-tint)', border: '1px solid var(--amber)' },
  halted: { color: 'var(--warning-text)', background: 'var(--white)', border: '1px solid var(--warning)' },
  running: { color: 'var(--ink-subtle)', background: 'var(--white)', border: '1px solid var(--rule)' },
}

function StatusPill({ status }: { status: ReasoningRunStatus }) {
  return (
    <span
      style={{
        ...mono,
        ...statusPill[status],
        textTransform: 'uppercase',
        borderRadius: 999,
        padding: '2px 8px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
      }}
    >
      {status === 'running' && <span className="mini-spinner" aria-hidden="true" />}
      {status}
    </span>
  )
}

// Deliberately not styled like StatusPill's amber "done" scheme (would read
// as a second status) — plain mono text, matching the "PANELS OFF" /
// "DRY RUN" run-state badges on the live pipeline page (ReasoningPipelinePage.tsx).
function PanelsOffTag() {
  return (
    <span style={{ ...mono, color: 'var(--amber-text)', textTransform: 'uppercase', flex: '0 0 auto' }}>panels off</span>
  )
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

export function ReasoningRunsBrowser() {
  const signOut = useSignOut()
  const [runs, setRuns] = useState<RunSummary[] | null>(null)
  const [listError, setListError] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<RunDetail | null>(null)
  const [detailError, setDetailError] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/admin/reasoning/runs', { cache: 'no-store' })
        if (cancelled) return
        if (!res.ok) {
          setListError(true)
          return
        }
        const data = (await res.json()) as { runs: RunSummary[] }
        setRuns(data.runs)
      } catch {
        if (!cancelled) setListError(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!selectedId) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/admin/reasoning/runs/${selectedId}`, { cache: 'no-store' })
        if (cancelled) return
        if (!res.ok) {
          setDetailError(true)
          return
        }
        const data = (await res.json()) as { run: RunDetail }
        setDetail(data.run)
      } catch {
        if (!cancelled) setDetailError(true)
      } finally {
        if (!cancelled) setDetailLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selectedId])

  // Resets belong in the event handler that changes `selectedId`, not the
  // effect above — synchronously setting state in an effect body triggers an
  // extra cascading render (react-hooks/set-state-in-effect).
  function selectRun(id: string): void {
    setSelectedId(id)
    setDetail(null)
    setDetailError(false)
    setDetailLoading(true)
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--parchment)' }}>
      <DashboardHeader onSignOut={() => void signOut()} active="admin" />

      <div className="container" style={{ paddingBlock: 32, maxWidth: 820 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 600, color: 'var(--ink)' }}>
              Past Runs
              <span style={{ ...mono, color: 'var(--ink-subtle)', textTransform: 'uppercase', marginLeft: 10, fontWeight: 400 }}>
                reasoning pipeline · admin only
              </span>
            </h1>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--ink-mid)', marginTop: 4 }}>
              Persisted packets/verdicts from real (non-dry-run) reasoning pipeline runs — decision 019, Phase 2 item 1.
            </p>
          </div>
          <Link
            href="/admin/reasoning"
            style={{ ...mono, textTransform: 'uppercase', color: 'var(--ink-subtle)', textDecoration: 'underline', textUnderlineOffset: 3 }}
          >
            Pipeline
          </Link>
        </div>

        {listError && (
          <div style={{ fontSize: 12.5, color: 'var(--ink)', marginTop: 24, lineHeight: 1.45 }}>
            Could not load past runs — the persistence read is unavailable right now.
          </div>
        )}

        {!listError && runs && runs.length === 0 && (
          <div style={{ fontSize: 12.5, color: 'var(--ink-subtle)', marginTop: 24, lineHeight: 1.45 }}>
            No runs yet. Real (non-dry-run) pipeline runs are persisted here after their first step.
          </div>
        )}

        {!listError && runs && runs.length > 0 && (
          <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {runs.map((r) => {
              const selected = r.id === selectedId
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => selectRun(r.id)}
                  style={{
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    background: selected ? 'var(--amber-tint)' : 'var(--white)',
                    border: `1px solid ${selected ? 'var(--amber)' : 'var(--rule)'}`,
                    borderRadius: 9,
                    padding: '10px 14px',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  <StatusPill status={r.status} />
                  {r.panelsOff && <PanelsOffTag />}
                  <span style={{ flex: 1, fontSize: 13, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.originalQuery}
                  </span>
                  <span style={{ ...mono, color: 'var(--ink-subtle)', flex: '0 0 auto' }}>{formatTime(r.updatedAt)}</span>
                </button>
              )
            })}
          </div>
        )}

        {selectedId && (
          <div style={{ marginTop: 24, borderTop: '1px solid var(--rule)', paddingTop: 20 }}>
            {detailLoading && <div style={{ fontSize: 12.5, color: 'var(--ink-subtle)' }}>Loading…</div>}
            {detailError && (
              <div style={{ fontSize: 12.5, color: 'var(--ink)' }}>Could not load this run — it may have been removed.</div>
            )}
            {detail && (
              <>
                <div style={{ background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 11, padding: '14px 16px' }}>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-subtle)', lineHeight: 1.5 }}>{detail.originalQuery}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                    <StatusPill status={detail.status} />
                    {detail.panelsOff && <PanelsOffTag />}
                    <span style={{ ...mono, color: 'var(--ink-subtle)' }}>
                      created {formatTime(detail.createdAt)} · updated {formatTime(detail.updatedAt)}
                    </span>
                  </div>
                  {detail.status === 'running' && (
                    <div style={{ fontSize: 11.5, color: 'var(--ink-subtle)', marginTop: 8, lineHeight: 1.4 }}>
                      Still shows &quot;running&quot; as of its last recorded step — this may be a genuinely in-progress
                      run, or one whose browser tab was closed before it finished. There is no separate liveness signal.
                    </div>
                  )}
                </div>

                {detail.haltReason && (
                  <div style={{ background: 'var(--white)', border: '1px solid var(--warning)', borderRadius: 11, padding: '14px 16px', marginTop: 12 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>Pipeline halted</div>
                    <div style={{ fontSize: 12.5, color: 'var(--ink-subtle)', marginTop: 4, lineHeight: 1.5 }}>{detail.haltReason}</div>
                  </div>
                )}

                <div style={{ marginTop: 12 }}>
                  <ReasoningStagesList run={detail.runState} currentStep={detail.lastStep} running={false} />
                </div>

                {detail.runState.finalAnswer && <FinalAnswerCard finalAnswer={detail.runState.finalAnswer} />}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
