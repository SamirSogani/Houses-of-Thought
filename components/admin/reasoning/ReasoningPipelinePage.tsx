'use client'

// Reasoning pipeline (decision 019) — admin-only, standalone page (not wired
// into House Chat; see decision 019's Deferred/open on why). Pre-run form,
// then a client-driven loop generalizing useDraftRunner's "one fetch per
// state advance" pattern (decision 016) to the pipeline's 17 steps: one
// request per step, full run state resent each time (stateless server), the
// response's `patch` merged in, then the next step fires automatically.

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import { useSignOut } from '@/components/useAuthedPage'
import { RATE_LIMITED_CODE, RATE_LIMITED_COPY } from '@/lib/ai/findings'
import { type StepId } from '@/lib/ai/reasoning/steps'
import { estimatePipelineCost, MIN_N, MAX_N_PHASE1 } from '@/lib/ai/reasoning/budget'
import { ReasoningStagesList, type RunState } from './ReasoningStagesList'

type Phase = 'form' | 'running' | 'paused' | 'halted' | 'done'

const mono: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.06em' }

const smallBtn: React.CSSProperties = {
  fontWeight: 600,
  fontSize: 12,
  color: 'var(--ink)',
  background: 'var(--white)',
  border: '1px solid var(--ink)',
  borderRadius: 7,
  padding: '5px 12px',
  cursor: 'pointer',
}

interface StepResponse {
  step: StepId
  patch: Partial<RunState>
  nextStep: StepId | null
  halted: boolean
  haltReason?: string
}

export function ReasoningPipelinePage() {
  const signOut = useSignOut()
  const [phase, setPhase] = useState<Phase>('form')
  const [question, setQuestion] = useState('')
  const [n, setN] = useState(MIN_N)
  const [dryRun, setDryRun] = useState(true)
  const [step, setStep] = useState<StepId | null>(null)
  const [run, setRun] = useState<RunState>({ originalQuery: '' })
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [haltReason, setHaltReason] = useState<string | null>(null)
  const runRef = useRef(run)
  runRef.current = run

  useEffect(() => {
    if (phase !== 'running' || !step) return
    let cancelled = false
    const controller = new AbortController()

    ;(async () => {
      try {
        const res = await fetch('/api/admin/reasoning', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ step, capN: n, dryRun, run: runRef.current }),
          signal: controller.signal,
        })
        if (cancelled) return
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string }
          setErrorCode(body.error ?? 'ai-upstream-error')
          setPhase('paused')
          return
        }
        const data = (await res.json()) as StepResponse
        setRun((prev) => ({ ...prev, ...data.patch }))
        if (data.halted) {
          setHaltReason(data.haltReason ?? 'Pipeline halted.')
          setPhase('halted')
          return
        }
        if (data.nextStep === null) {
          setPhase('done')
          return
        }
        setStep(data.nextStep)
      } catch (err) {
        if ((err as Error)?.name === 'AbortError' || cancelled) return
        setErrorCode('ai-network-error')
        setPhase('paused')
      }
    })()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [phase, step, n, dryRun])

  function start() {
    if (!question.trim()) return
    setRun({ originalQuery: question.trim() })
    setErrorCode(null)
    setHaltReason(null)
    setStep('context-gather-pre')
    setPhase('running')
  }

  function pause() {
    setPhase('paused')
  }

  function resume() {
    setErrorCode(null)
    setPhase('running')
  }

  function reset() {
    setPhase('form')
    setStep(null)
    setRun({ originalQuery: '' })
    setErrorCode(null)
    setHaltReason(null)
  }

  const cost = estimatePipelineCost(n)
  const nOptions = Array.from({ length: MAX_N_PHASE1 - MIN_N + 1 }, (_, i) => MIN_N + i)

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--parchment)' }}>
      <DashboardHeader onSignOut={() => void signOut()} active="admin" />

      <div className="container" style={{ paddingBlock: 32, maxWidth: 820 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 600, color: 'var(--ink)' }}>
              Reasoning Pipeline
              <span style={{ ...mono, color: 'var(--ink-subtle)', textTransform: 'uppercase', marginLeft: 10, fontWeight: 400 }}>
                phase 1 · admin only
              </span>
            </h1>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--ink-mid)', marginTop: 4 }}>
              A multi-agent reasoning pipeline, reviewed by a nine-standard panel at every gate — decision 019.
            </p>
          </div>
          <Link
            href="/admin"
            style={{ ...mono, textTransform: 'uppercase', color: 'var(--ink-subtle)', textDecoration: 'underline', textUnderlineOffset: 3 }}
          >
            Monitor
          </Link>
        </div>

        {phase === 'form' && (
          <div style={{ background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 11, padding: '18px 20px', marginTop: 24 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Question</label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Should our school ban homework?"
              rows={3}
              style={{
                width: '100%',
                marginTop: 6,
                fontSize: 14,
                padding: '10px 12px',
                border: '1px solid var(--rule)',
                borderRadius: 9,
                background: 'var(--white)',
                color: 'var(--ink)',
                outline: 'none',
                resize: 'vertical',
                fontFamily: 'inherit',
              }}
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 14, flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ink)' }}>
                Perspectives (n)
                <select
                  value={n}
                  onChange={(e) => setN(Number(e.target.value))}
                  style={{
                    fontSize: 13,
                    padding: '4px 8px',
                    border: '1px solid var(--rule)',
                    borderRadius: 7,
                    background: 'var(--white)',
                    color: 'var(--ink)',
                  }}
                >
                  {nOptions.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <span style={{ ...mono, color: 'var(--ink-subtle)' }}>
                ≈ {cost.total} calls ({cost.generators} generators + {cost.reviewers} reviewers), peak ~{9 * n} concurrent
              </span>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 12, fontSize: 12.5, color: 'var(--ink-subtle)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={dryRun}
                onChange={(e) => setDryRun(e.target.checked)}
                style={{ accentColor: 'var(--amber)', margin: 0 }}
              />
              Dry run (no real AI calls — exercises the 17-step state machine and UI for free)
            </label>

            {!dryRun && (
              <div style={{ fontSize: 11.5, color: 'var(--warning-text)', marginTop: 8, lineHeight: 1.45 }}>
                Real runs share this app&apos;s AI provider quotas with every live feature — keep n small and run sparingly.
              </div>
            )}

            <button
              type="button"
              onClick={start}
              disabled={!question.trim()}
              style={{
                marginTop: 16,
                fontWeight: 600,
                fontSize: 13,
                color: 'var(--ink)',
                background: 'var(--amber-tint)',
                border: '1px solid var(--amber)',
                borderRadius: 9,
                padding: '9px 18px',
                cursor: question.trim() ? 'pointer' : 'not-allowed',
                opacity: question.trim() ? 1 : 0.6,
              }}
            >
              Run pipeline
            </button>
          </div>
        )}

        {phase !== 'form' && (
          <div style={{ marginTop: 24 }}>
            <div style={{ background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 11, padding: '14px 16px' }}>
              <div style={{ fontSize: 12.5, color: 'var(--ink-subtle)', lineHeight: 1.5 }}>{run.originalQuery}</div>
              {dryRun && <div style={{ ...mono, color: 'var(--amber-text)', marginTop: 4 }}>DRY RUN — no real AI calls</div>}
            </div>

            <div style={{ marginTop: 12 }}>
              <ReasoningStagesList run={run} currentStep={step} running={phase === 'running'} />
            </div>

            {errorCode && (
              <div style={{ fontSize: 12.5, color: 'var(--ink)', marginTop: 12, lineHeight: 1.45 }}>
                {errorCode === RATE_LIMITED_CODE
                  ? RATE_LIMITED_COPY
                  : errorCode === 'ai-network-error'
                    ? 'Network hiccup — check your connection and retry.'
                    : 'Could not reach a stage of the pipeline.'}
              </div>
            )}

            {haltReason && (
              <div style={{ background: 'var(--white)', border: '1px solid var(--warning)', borderRadius: 11, padding: '14px 16px', marginTop: 12 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>Pipeline halted</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-subtle)', marginTop: 4, lineHeight: 1.5 }}>{haltReason}</div>
              </div>
            )}

            {phase === 'done' && run.finalAnswer && (
              <div style={{ background: 'var(--white)', border: '1px solid var(--amber)', borderRadius: 11, padding: '16px 18px', marginTop: 12 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>Final answer</div>
                <div style={{ fontSize: 13.5, color: 'var(--ink)', marginTop: 8, lineHeight: 1.55 }}>{run.finalAnswer.answer}</div>
                {run.finalAnswer.caveats.length > 0 && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--rule)' }}>
                    <div style={mono}>CAVEATS</div>
                    <ul style={{ marginTop: 4, paddingLeft: 18 }}>
                      {run.finalAnswer.caveats.map((c, i) => (
                        <li key={i} style={{ fontSize: 12.5, color: 'var(--ink-subtle)', lineHeight: 1.5 }}>
                          {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14 }}>
              {phase === 'running' && (
                <button type="button" onClick={pause} style={smallBtn}>
                  Pause
                </button>
              )}
              {phase === 'paused' && (
                <button type="button" onClick={resume} style={smallBtn}>
                  {errorCode ? 'Retry' : 'Resume'}
                </button>
              )}
              {(phase === 'halted' || phase === 'done' || phase === 'paused') && (
                <button type="button" onClick={reset} style={{ ...smallBtn, borderColor: 'var(--rule)', color: 'var(--ink-subtle)' }}>
                  New question
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
