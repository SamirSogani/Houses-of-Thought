'use client'

// Interactive question box for a context-gather checkpoint that returned
// needs_user_input: true (Phase 3 item 1, decision 019) — the client-side
// half of "make the pipeline actually act on needs_user_input instead of
// ignoring it." Used ONLY by ReasoningPipelinePage.tsx (the live run): a
// past, already-`done` run has no one left to answer, so the read-only
// browser (ReasoningRunsBrowser.tsx, via the shared ReasoningStagesList.tsx)
// renders a resolved verdict + its answers as plain text instead — see that
// file's ContextGatherNote. This component must never be imported there.
//
// Mirrors this app's own AskUserQuestion-style UX (Samir's call,
// 2026-08-04): up to 3 quick-pick options per question, plus an always-
// available free-text "Other" fallback. One answer per question; picking an
// option and then typing "Other" text overwrites the pick, and vice versa.

import { useState } from 'react'
import type { ContextGatherVerdict } from '@/lib/ai/reasoning/contracts'

const mono: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.06em' }

const optionBtn = (selected: boolean): React.CSSProperties => ({
  fontSize: 12,
  fontWeight: selected ? 600 : 400,
  color: selected ? 'var(--ink)' : 'var(--ink-mid)',
  background: selected ? 'var(--amber-tint)' : 'var(--white)',
  border: `1px solid ${selected ? 'var(--amber)' : 'var(--rule)'}`,
  borderRadius: 999,
  padding: '4px 12px',
  cursor: 'pointer',
})

const primaryBtn: React.CSSProperties = {
  fontWeight: 600,
  fontSize: 12.5,
  color: 'var(--ink)',
  background: 'var(--amber-tint)',
  border: '1px solid var(--amber)',
  borderRadius: 8,
  padding: '7px 16px',
  cursor: 'pointer',
}

const skipBtn: React.CSSProperties = {
  fontWeight: 600,
  fontSize: 12.5,
  color: 'var(--ink-subtle)',
  background: 'var(--white)',
  border: '1px solid var(--rule)',
  borderRadius: 8,
  padding: '7px 16px',
  cursor: 'pointer',
}

function QuestionRow({
  question,
  options,
  value,
  onChange,
  disabled,
}: {
  question: string
  options: string[]
  value: string | null
  onChange: (v: string | null) => void
  disabled: boolean
}) {
  const isOtherSelected = value !== null && !options.includes(value)
  const [otherMode, setOtherMode] = useState(isOtherSelected)
  const [otherText, setOtherText] = useState(isOtherSelected ? value : '')

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 600, marginBottom: 6 }}>{question}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            disabled={disabled}
            style={optionBtn(!otherMode && value === opt)}
            onClick={() => {
              setOtherMode(false)
              onChange(opt)
            }}
          >
            {opt}
          </button>
        ))}
        <button
          type="button"
          disabled={disabled}
          style={optionBtn(otherMode)}
          onClick={() => {
            setOtherMode(true)
            onChange(otherText || null)
          }}
        >
          Other…
        </button>
      </div>
      {otherMode && (
        <input
          type="text"
          value={otherText}
          disabled={disabled}
          onChange={(e) => {
            setOtherText(e.target.value)
            onChange(e.target.value || null)
          }}
          placeholder="Type your own answer"
          style={{
            marginTop: 6,
            width: '100%',
            fontSize: 13,
            padding: '6px 10px',
            border: '1px solid var(--rule)',
            borderRadius: 7,
            background: 'var(--white)',
            color: 'var(--ink)',
            outline: 'none',
          }}
        />
      )}
    </div>
  )
}

export function ContextGatherAnswerBox({
  verdict,
  onSubmit,
  onSkip,
  submitting = false,
}: {
  verdict: ContextGatherVerdict
  onSubmit: (answers: (string | null)[]) => void
  onSkip: () => void
  submitting?: boolean
}) {
  const [answers, setAnswers] = useState<(string | null)[]>(() => verdict.questions_for_user.map(() => null))

  function setAnswer(i: number, v: string | null) {
    setAnswers((prev) => prev.map((a, idx) => (idx === i ? v : a)))
  }

  return (
    <div
      style={{
        background: 'var(--white)',
        border: '1px solid var(--amber)',
        borderRadius: 11,
        padding: '14px 16px',
        marginTop: 12,
      }}
    >
      <div style={{ ...mono, color: 'var(--amber-text)', textTransform: 'uppercase' }}>Clarification needed</div>
      <div style={{ fontSize: 13, color: 'var(--ink)', marginTop: 6, lineHeight: 1.5 }}>{verdict.reason}</div>

      {verdict.questions_for_user.map((q, i) => (
        <QuestionRow
          key={i}
          question={q.question}
          options={q.options}
          value={answers[i] ?? null}
          onChange={(v) => setAnswer(i, v)}
          disabled={submitting}
        />
      ))}

      {verdict.search_findings && (
        <details style={{ marginTop: 10 }}>
          <summary style={{ cursor: 'pointer', fontSize: 11.5, color: 'var(--ink-subtle)' }}>Search findings</summary>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 10.5, marginTop: 4 }}>{verdict.search_findings}</pre>
        </details>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14 }}>
        <button type="button" style={primaryBtn} disabled={submitting} onClick={() => onSubmit(answers)}>
          {submitting ? 'Submitting…' : 'Submit answers'}
        </button>
        <button type="button" style={skipBtn} disabled={submitting} onClick={onSkip}>
          Skip
        </button>
      </div>
    </div>
  )
}
