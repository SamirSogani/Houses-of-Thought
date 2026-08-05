'use client'

// Pro/con synthesis of a finished reasoning-pipeline run + a persisted
// ask-AI sidebar (RunActions.tsx's "Pro/con synthesis" button). Generation
// is one-shot and cached server-side (the synthesis route returns the
// existing DB row instead of regenerating) — this page only ever POSTs to
// generate when the initial GET shows no cached synthesis yet.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import { useSignOut } from '@/components/useAuthedPage'
import { SynthesisAskSidebar } from './SynthesisAskSidebar'
import type { ProConSynthesis, SynthesisPoint, SynthesisChatTurn } from '@/lib/ai/reasoning/synthesis'

type Phase = 'loading' | 'generating' | 'ready' | 'error'

interface RunDetailResponse {
  originalQuery: string
  status: string
  runState: { finalAnswer?: unknown }
  synthesis: ProConSynthesis | null
  synthesisChat: SynthesisChatTurn[]
}

const mono: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.06em' }

function PointList({ label, points, accent }: { label: string; points: SynthesisPoint[]; accent: string }) {
  return (
    <div style={{ flex: '1 1 260px', minWidth: 240 }}>
      <div style={{ ...mono, textTransform: 'uppercase', color: accent }}>{label}</div>
      <ul style={{ marginTop: 8, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {points.map((p, i) => (
          <li key={i} style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.5 }}>
            {p.point}
            <div style={{ fontSize: 11.5, color: 'var(--ink-subtle)', marginTop: 2 }}>{p.basis}</div>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function SynthesisPage({ runId }: { runId: string }) {
  const signOut = useSignOut()
  const [phase, setPhase] = useState<Phase>('loading')
  const [originalQuery, setOriginalQuery] = useState('')
  const [synthesis, setSynthesis] = useState<ProConSynthesis | null>(null)
  const [chat, setChat] = useState<SynthesisChatTurn[]>([])
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [asking, setAsking] = useState(false)
  const [askError, setAskError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/admin/reasoning/runs/${runId}`, { cache: 'no-store' })
        if (cancelled) return
        if (!res.ok) {
          setErrorMsg(res.status === 403 ? 'This page is admin-only.' : 'Could not load this run.')
          setPhase('error')
          return
        }
        const data = (await res.json()) as { run: RunDetailResponse }
        setOriginalQuery(data.run.originalQuery)
        setChat(data.run.synthesisChat)

        if (data.run.status !== 'done' || data.run.runState.finalAnswer == null) {
          setErrorMsg('This run has not finished — a synthesis needs a completed run.')
          setPhase('error')
          return
        }

        // Already cached — no AI calls on this visit.
        if (data.run.synthesis) {
          setSynthesis(data.run.synthesis)
          setPhase('ready')
          return
        }

        setPhase('generating')
        const genRes = await fetch(`/api/admin/reasoning/runs/${runId}/synthesis`, { method: 'POST' })
        if (cancelled) return
        if (!genRes.ok) {
          setErrorMsg('Could not generate a synthesis for this run.')
          setPhase('error')
          return
        }
        const genData = (await genRes.json()) as { synthesis: ProConSynthesis }
        setSynthesis(genData.synthesis)
        setPhase('ready')
      } catch {
        if (!cancelled) {
          setErrorMsg('Could not reach the server.')
          setPhase('error')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [runId])

  async function handleAsk(question: string) {
    setAsking(true)
    setAskError(null)
    setChat((cur) => [...cur, { role: 'user', content: question, at: new Date().toISOString() }])
    try {
      const res = await fetch(`/api/admin/reasoning/runs/${runId}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      })
      if (!res.ok) {
        setAskError('Could not reach the co-pilot.')
        return
      }
      const data = (await res.json()) as { answer: string }
      setChat((cur) => [...cur, { role: 'assistant', content: data.answer, at: new Date().toISOString() }])
    } catch {
      setAskError('Could not reach the co-pilot.')
    } finally {
      setAsking(false)
    }
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--parchment)', display: 'flex', flexDirection: 'column' }}>
      <DashboardHeader onSignOut={() => void signOut()} active="admin" />

      <div style={{ flex: '1 1 auto', display: 'flex', minHeight: 0 }}>
        <div className="build-scroll container" style={{ flex: '1 1 auto', paddingBlock: 32, maxWidth: 820, overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 600, color: 'var(--ink)' }}>
                Pro/con synthesis
              </h1>
              {originalQuery && (
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 13.5, color: 'var(--ink-mid)', marginTop: 4 }}>
                  {originalQuery}
                </p>
              )}
            </div>
            <Link
              href={`/admin/reasoning/runs?run=${runId}`}
              style={{ ...mono, textTransform: 'uppercase', color: 'var(--ink-subtle)', textDecoration: 'underline', textUnderlineOffset: 3 }}
            >
              ← Back to run
            </Link>
          </div>

          {phase === 'loading' && <div style={{ marginTop: 24, fontSize: 13, color: 'var(--ink-subtle)' }}>Loading…</div>}
          {phase === 'generating' && (
            <div style={{ marginTop: 24, fontSize: 13, color: 'var(--ink-subtle)', lineHeight: 1.5 }}>
              Generating a synthesis — organizing the run&apos;s material through 3 parallel agents, then consolidating…
            </div>
          )}
          {phase === 'error' && <div style={{ marginTop: 24, fontSize: 13, color: 'var(--ink)' }}>{errorMsg}</div>}

          {phase === 'ready' && synthesis && (
            <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                <PointList label="Pros" points={synthesis.pros} accent="var(--amber-text)" />
                <PointList label="Cons" points={synthesis.cons} accent="var(--warning-text)" />
              </div>

              <div style={{ background: 'var(--white)', border: '1px solid var(--amber)', borderRadius: 11, padding: '16px 18px' }}>
                <div style={{ ...mono, textTransform: 'uppercase', color: 'var(--ink-subtle)' }}>Key tension</div>
                <div style={{ fontSize: 13.5, color: 'var(--ink)', marginTop: 6, lineHeight: 1.55 }}>{synthesis.key_tension}</div>
              </div>

              {synthesis.open_questions.length > 0 && (
                <div>
                  <div style={{ ...mono, textTransform: 'uppercase', color: 'var(--ink-subtle)' }}>Open questions</div>
                  <ul style={{ marginTop: 8, paddingLeft: 18 }}>
                    {synthesis.open_questions.map((q, i) => (
                      <li key={i} style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.5 }}>
                        {q}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {phase === 'ready' && (
          <SynthesisAskSidebar chat={chat} sending={asking} errorMsg={askError} onSend={(q) => void handleAsk(q)} />
        )}
      </div>
    </div>
  )
}
