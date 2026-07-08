'use client'

// Context-intake interviewer, mounted at the top of the co-pilot tab. Asks a few
// questions, then distills the answers into aiContext (summary + facts) that every
// other AI call reads. The transcript is deliberately ephemeral local state — only
// the distilled context is dispatched (SET_AI_CONTEXT) and persisted.
// See plans/active/ai/05-interviewer.md.

import { useRef, useState } from 'react'
import type { Action, State } from '@/lib/build/types'
import { serializeContent } from '@/lib/build/persistence'
import { RATE_LIMITED_CODE, RATE_LIMITED_COPY } from '@/lib/ai/findings'

type Turn = { role: 'user' | 'assistant'; content: string }

// After this many user answers the client stops asking and forces a summary.
const HARD_STOP_TURNS = 6

export function InterviewCard({ state, dispatch }: { state: State; dispatch: React.Dispatch<Action> }) {
  const [active, setActive] = useState(false)
  const [transcript, setTranscript] = useState<Turn[]>([])
  const [input, setInput] = useState('')
  const [inFlight, setInFlight] = useState(false)
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const userTurns = transcript.filter((t) => t.role === 'user').length

  async function runInterview(sendTranscript: Turn[], forceSummary: boolean) {
    setInFlight(true)
    setErrorCode(null)
    try {
      const res = await fetch('/api/ai/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          house: JSON.parse(serializeContent(state)),
          transcript: sendTranscript,
          forceSummary,
        }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        setErrorCode(body.error ?? 'generic')
        return
      }
      const data = (await res.json()) as {
        reply: string
        done: boolean
        context: { summary: string; facts: string[] } | null
      }
      if (data.done && data.context) {
        dispatch({ type: 'SET_AI_CONTEXT', context: data.context })
        setActive(false)
        setTranscript([])
      } else {
        setTranscript([...sendTranscript, { role: 'assistant', content: data.reply }])
        // Scroll the newest bubble into view next paint.
        requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }))
      }
    } catch {
      setErrorCode('generic')
    } finally {
      setInFlight(false)
    }
  }

  function start() {
    setActive(true)
    setTranscript([])
    setErrorCode(null)
    runInterview([], false)
  }

  function send() {
    const text = input.trim()
    if (!text || inFlight) return
    const next: Turn[] = [...transcript, { role: 'user', content: text }]
    setTranscript(next)
    setInput('')
    // Once the person has given HARD_STOP_TURNS answers, force the wrap-up.
    runInterview(next, userTurns + 1 >= HARD_STOP_TURNS)
  }

  function retry() {
    runInterview(transcript, userTurns >= HARD_STOP_TURNS)
  }

  const cardStyle: React.CSSProperties = {
    background: 'var(--parchment)',
    border: '1px solid var(--rule)',
    borderRadius: 11,
    padding: 13,
    marginBottom: 16,
  }

  // Active interview view (takes precedence over the chip, so Redo works).
  if (active) {
    return (
      <div style={cardStyle} className="fade-in">
        <div ref={scrollRef} style={{ maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {transcript.map((t, i) => (
            <div
              key={i}
              style={{
                alignSelf: t.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                fontSize: 12.5,
                lineHeight: 1.45,
                color: 'var(--ink)',
                background: t.role === 'user' ? 'var(--amber-tint)' : 'var(--white)',
                border: '1px solid var(--rule)',
                borderRadius: 10,
                padding: '8px 10px',
              }}
            >
              {t.content}
            </div>
          ))}
          {inFlight && (
            <div style={{ alignSelf: 'flex-start', fontSize: 12, color: 'var(--ink-subtle)', padding: '4px 2px' }}>…</div>
          )}
        </div>

        {errorCode === RATE_LIMITED_CODE ? (
          <div style={{ fontSize: 12, color: 'var(--ink)', marginTop: 8, lineHeight: 1.45 }}>{RATE_LIMITED_COPY}</div>
        ) : errorCode ? (
          <div style={{ fontSize: 12, color: 'var(--ink)', marginTop: 8 }}>
            Couldn&apos;t reach the co-pilot.{' '}
            <button type="button" onClick={retry} style={linkBtn}>Retry</button>
          </div>
        ) : null}

        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          <input
            aria-label="Your answer"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') send() }}
            placeholder="Type your answer…"
            disabled={inFlight}
            style={{ flex: 1, minWidth: 0, fontSize: 12.5, padding: '7px 9px', border: '1px solid var(--rule)', borderRadius: 7, background: 'var(--white)', color: 'var(--ink)', outline: 'none' }}
          />
          <button
            type="button"
            onClick={send}
            disabled={inFlight || !input.trim()}
            style={{ fontWeight: 600, fontSize: 12, color: 'var(--ink)', background: 'var(--amber-tint)', border: '1px solid var(--amber)', borderRadius: 7, padding: '0 12px', cursor: inFlight || !input.trim() ? 'not-allowed' : 'pointer', opacity: inFlight || !input.trim() ? 0.6 : 1 }}
          >
            Send
          </button>
        </div>

        {transcript.length > 0 && !inFlight && (
          <button type="button" onClick={() => runInterview(transcript, true)} className="mono" style={{ ...linkBtn, fontSize: 10, marginTop: 8 }}>
            Finish early
          </button>
        )}
      </div>
    )
  }

  // Collapsed chip once context exists.
  if (state.aiContext) {
    return (
      <div style={cardStyle} className="fade-in">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontWeight: 600, fontSize: 12.5, color: 'var(--ink)' }}>Context set ✓</span>
          <button type="button" onClick={start} className="mono" style={{ ...linkBtn, fontSize: 10 }}>Redo</button>
        </div>
        <div
          style={{
            fontSize: 12,
            color: 'var(--ink-subtle)',
            lineHeight: 1.45,
            marginTop: 5,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {state.aiContext.summary}
        </div>
      </div>
    )
  }

  // Intro: no context yet.
  return (
    <div style={cardStyle} className="fade-in">
      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>Give the co-pilot context</div>
      <div style={{ fontSize: 12, color: 'var(--ink-subtle)', marginTop: 3, lineHeight: 1.45 }}>
        It asks a few questions so suggestions fit your house.
      </div>
      <button
        type="button"
        onClick={start}
        style={{ marginTop: 10, fontWeight: 600, fontSize: 12, color: 'var(--ink)', background: 'var(--white)', border: '1px solid var(--ink)', borderRadius: 7, padding: '6px 13px', cursor: 'pointer' }}
      >
        Start
      </button>
    </div>
  )
}

const linkBtn: React.CSSProperties = {
  color: 'var(--blueprint)',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: 0,
  font: 'inherit',
  textDecoration: 'underline',
}
