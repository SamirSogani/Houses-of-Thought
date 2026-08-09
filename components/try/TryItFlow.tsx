'use client'

import { useEffect, useRef, useState } from 'react'
import {
  ArrowIcon,
  CheckIcon,
  SparklesIcon,
  CompassIcon,
  BrainIcon,
  LightbulbIcon,
  BookOpenIcon,
} from '@/components/icons'
import {
  MINI_HOUSE_EXAMPLES,
  MINI_HOUSE_MIN_CHARS,
  MINI_HOUSE_MAX_CHARS,
  MINI_HOUSE_BUILD_STAGES,
  MINI_HOUSE_STAGE_INTERVAL_MS,
  MINI_HOUSE_MIN_LOADING_MS,
  type MiniHouse,
} from '@/lib/ai/mini-house'
import MiniHouseResult from './MiniHouseResult'

type Phase = 'input' | 'loading' | 'result' | 'error'

const STAGE_ICONS = [CompassIcon, BrainIcon, LightbulbIcon, BookOpenIcon, SparklesIcon]

const READING_MAX = 760

export default function TryItFlow({ initialQuestion = '' }: { initialQuestion?: string }) {
  const [phase, setPhase] = useState<Phase>('input')
  const [question, setQuestion] = useState(initialQuestion)
  const [activeStage, setActiveStage] = useState(0)
  const [result, setResult] = useState<MiniHouse | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [askedQuestion, setAskedQuestion] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const trimmed = question.trim()
  const canSubmit = trimmed.length >= MINI_HOUSE_MIN_CHARS && phase !== 'loading'

  // A question arriving via the Home hero's try-it box (?q=, passed down as
  // initialQuestion) should start building immediately rather than making the
  // visitor retype and resubmit what they already typed once.
  useEffect(() => {
    if (initialQuestion.trim().length >= MINI_HOUSE_MIN_CHARS) build(initialQuestion)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Advance the checklist while loading; cap at the final stage (the spinner
  // holds there until the fetch resolves or fails).
  useEffect(() => {
    if (phase !== 'loading') return
    setActiveStage(0)
    const id = setInterval(() => {
      setActiveStage((s) => (s < MINI_HOUSE_BUILD_STAGES.length - 1 ? s + 1 : s))
    }, MINI_HOUSE_STAGE_INTERVAL_MS)
    return () => clearInterval(id)
  }, [phase])

  async function build(q: string) {
    const cleaned = q.trim()
    if (cleaned.length < MINI_HOUSE_MIN_CHARS) return
    setAskedQuestion(cleaned)
    setResult(null)
    setErrorMsg('')
    setPhase('loading')

    const start = Date.now()
    if (typeof window !== 'undefined') {
      ;(window as unknown as { __miniStart?: number }).__miniStart = start
    }

    // Settle whatever the fetch returns, but never surface the loading view for
    // less than MINI_HOUSE_MIN_LOADING_MS — avoids a jarring flash on fast
    // responses and matches the recreation spec's minimum-display guarantee.
    async function settle(after: () => void) {
      const elapsed = Date.now() - start
      const remaining = Math.max(0, MINI_HOUSE_MIN_LOADING_MS - elapsed)
      if (remaining > 0) await new Promise((r) => setTimeout(r, remaining))
      after()
    }

    try {
      const res = await fetch('/api/ai/mini-house', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: cleaned }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error ?? 'Something went wrong. Please try again.')
      await settle(() => {
        setResult(data.mini_house as MiniHouse)
        setPhase('result')
        window.scrollTo({ top: 0, behavior: 'auto' })
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      await settle(() => {
        setErrorMsg(message)
        setPhase('error')
      })
    }
  }

  function newQuestion() {
    setPhase('input')
    setQuestion('')
    setResult(null)
    setErrorMsg('')
    setTimeout(() => textareaRef.current?.focus(), 0)
  }

  if (phase === 'result' && result) {
    return <MiniHouseResult miniHouse={result} originalQuestion={askedQuestion} onTryAnother={newQuestion} />
  }

  if (phase === 'loading') {
    return <LoadingView question={askedQuestion} activeStage={activeStage} />
  }

  if (phase === 'error') {
    return (
      <ErrorView message={errorMsg} onRetry={() => build(askedQuestion)} onReset={newQuestion} />
    )
  }

  return (
    <section style={{ padding: 'clamp(40px, 8vw, 88px) 0' }}>
      <div className="container">
        <div style={{ maxWidth: READING_MAX, margin: '0 auto' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              border: '1px solid var(--rule-soft)',
              borderRadius: 'var(--radius-chip)',
              padding: '6px 12px',
              background: 'var(--white)',
            }}
          >
            <span style={{ color: 'var(--amber)', display: 'flex' }}>
              <SparklesIcon size={13} />
            </span>
            <span className="eyebrow-amber">Try it instantly · no account needed</span>
          </span>

          <h1
            className="fade-in"
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 500,
              fontSize: 'clamp(38px, 6vw, 66px)',
              lineHeight: 1.04,
              letterSpacing: '-0.01em',
              marginTop: 22,
            }}
          >
            <span style={{ color: 'var(--ink)' }}>What&rsquo;s a difficult decision </span>
            <span style={{ color: 'var(--ink-subtle)' }}>you&rsquo;re trying to think through?</span>
          </h1>

          <p className="body-text" style={{ marginTop: 20, maxWidth: '62ch' }}>
            We&rsquo;ll build a <strong style={{ color: 'var(--ink)', fontWeight: 600 }}>Mini House</strong> —
            a compact, structured reasoning view of your question. Three perspectives, real
            assumptions, sourced evidence, and a final synthesis. About 20 seconds.
          </p>

          {/* Input card */}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (canSubmit) build(question)
            }}
            style={{
              marginTop: 28,
              border: '1px solid var(--rule)',
              borderRadius: 'var(--radius-card)',
              background: 'var(--white)',
              boxShadow: '0 1px 2px rgba(20,33,58,.06)',
              overflow: 'hidden',
            }}
          >
            <textarea
              ref={textareaRef}
              value={question}
              onChange={(e) => setQuestion(e.target.value.slice(0, MINI_HOUSE_MAX_CHARS))}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && canSubmit) {
                  e.preventDefault()
                  build(question)
                }
              }}
              placeholder="e.g. Should I leave my stable job to start something on my own?"
              rows={4}
              maxLength={MINI_HOUSE_MAX_CHARS}
              aria-label="Your difficult decision or question"
              style={{
                width: '100%',
                resize: 'vertical',
                border: 'none',
                outline: 'none',
                background: 'transparent',
                padding: '20px 22px',
                fontFamily: 'var(--font-body)',
                fontSize: 17,
                lineHeight: 1.6,
                color: 'var(--ink)',
                minHeight: 120,
              }}
            />
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
                padding: '12px 16px 16px',
                borderTop: '1px solid var(--rule-soft)',
              }}
            >
              <span className="mono" style={{ fontSize: 12, color: 'var(--ink-subtle)' }}>
                {question.length} / {MINI_HOUSE_MAX_CHARS}
              </span>
              <button
                type="submit"
                disabled={!canSubmit}
                className="btn-primary"
                style={{
                  height: 46,
                  opacity: canSubmit ? 1 : 0.5,
                  cursor: canSubmit ? 'pointer' : 'not-allowed',
                }}
              >
                Start Mini House
                <ArrowIcon />
              </button>
            </div>
          </form>

          {/* Example prompts */}
          <div style={{ marginTop: 30 }}>
            <p className="mono" style={{ fontSize: 12, color: 'var(--ink-subtle)' }}>
              Or try one of these
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
              {MINI_HOUSE_EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => {
                    setQuestion(ex)
                    build(ex)
                  }}
                  style={{
                    border: '1px solid var(--rule)',
                    borderRadius: 'var(--radius-btn)',
                    background: 'var(--white)',
                    padding: '9px 14px',
                    fontFamily: 'var(--font-body)',
                    fontSize: 14,
                    color: 'var(--ink-mid)',
                    transition: 'border-color 0.15s, color 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--ink)'
                    e.currentTarget.style.color = 'var(--ink)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--rule)'
                    e.currentTarget.style.color = 'var(--ink-mid)'
                  }}
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Loading view ─────────────────────────────────────────────────────────
function LoadingView({ question, activeStage }: { question: string; activeStage: number }) {
  return (
    <section style={{ padding: 'clamp(48px, 9vw, 96px) 0', minHeight: '60vh' }}>
      <div className="container">
        <div style={{ maxWidth: READING_MAX, margin: '0 auto' }}>
          <p className="mono" style={{ fontSize: 12, color: 'var(--ink-subtle)' }}>
            Building your Mini House
          </p>
          <p
            style={{
              fontFamily: 'var(--font-display)',
              fontStyle: 'italic',
              fontWeight: 500,
              fontSize: 'clamp(24px, 3.4vw, 34px)',
              lineHeight: 1.2,
              color: 'var(--ink)',
              marginTop: 10,
            }}
          >
            &ldquo;{question}&rdquo;
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 34 }}>
            {MINI_HOUSE_BUILD_STAGES.map((label, i) => {
              const done = i < activeStage
              const current = i === activeStage
              const StageIcon = STAGE_ICONS[i]
              return (
                <div
                  key={label}
                  className="fade-in"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    border: `1px solid ${current ? 'var(--ink)' : 'var(--rule-soft)'}`,
                    borderRadius: 'var(--radius-btn)',
                    background: 'var(--white)',
                    padding: '16px 18px',
                    opacity: i > activeStage ? 0.55 : 1,
                    transition: 'opacity 0.3s, border-color 0.3s',
                  }}
                >
                  <StageStatus done={done} current={current} Icon={StageIcon} />
                  <span
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: 16,
                      color: done || current ? 'var(--ink-mid)' : 'var(--ink-subtle)',
                    }}
                  >
                    {label}
                  </span>
                </div>
              )
            })}
          </div>

          <p
            className="mono"
            style={{ fontSize: 12, color: 'var(--ink-subtle)', textAlign: 'center', marginTop: 34 }}
          >
            Reasoning, not just responding
          </p>
        </div>
      </div>
    </section>
  )
}

function StageStatus({
  done,
  current,
  Icon,
}: {
  done: boolean
  current: boolean
  Icon: (props: { size?: number }) => React.JSX.Element
}) {
  const box = {
    width: 26,
    height: 26,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  } as const

  if (done) return <CheckIcon size={24} />
  if (current) {
    return (
      <span style={box}>
        <span className="mini-spinner" aria-hidden="true" />
      </span>
    )
  }
  return (
    <span style={{ ...box, color: 'var(--ink-subtle)' }}>
      <Icon size={18} />
    </span>
  )
}

// ── Error view ───────────────────────────────────────────────────────────
function ErrorView({
  message,
  onRetry,
  onReset,
}: {
  message: string
  onRetry: () => void
  onReset: () => void
}) {
  return (
    <section style={{ padding: 'clamp(72px, 14vw, 128px) 0', minHeight: '50vh' }}>
      <div className="container">
        <div style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
          <h2 className="h2">Something interrupted the reasoning.</h2>
          <p className="body-text" style={{ marginTop: 14 }}>
            {message}
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 28 }}>
            <button type="button" onClick={onRetry} className="btn-primary">
              Try again
            </button>
            <button type="button" onClick={onReset} className="btn-secondary">
              New question
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
