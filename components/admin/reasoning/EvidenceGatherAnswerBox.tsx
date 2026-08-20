'use client'

// Interactive question box for an evidence-strategy checkpoint that asked
// the person something (2026-08-13, Samir) — the client-side half of
// evidence generation's own "decide whether to ask the user for more
// evidence" step. Sibling of ContextGatherAnswerBox.tsx, same UX
// conventions (up to 3 quick-pick options per question, plus a free-text
// "Other"), but handles MULTIPLE independent units at once: perspectives-
// evidence-strategy can have up to n perspectives each ask something in the
// same pause, whereas global-evidence-strategy is always exactly one unit.
// Used ONLY by ReasoningPipelinePage.tsx (the live run) — a past, already-
// `done` run has no one left to answer; ReasoningStagesList.tsx's
// EvidenceGatherNote renders a resolved unit + its answers as plain text
// instead. This component must never be imported there.

import { useState } from 'react'
import type { EvidenceGatherUnit } from '@/lib/ai/reasoning/contracts'

const mono: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.06em' }

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

// Free-text-only, no quick-pick options — evidence-strategy's own
// questions_for_user (EvidenceStrategySchema, contracts.ts) don't carry an
// `options` list the way ContextGatherQuestionSchema's do (the strategy
// call is deliberately simple, Samir's scoping — see prompts.ts's
// PERSPECTIVE_EVIDENCE_STRATEGY_BLOCK), so this row is a single input, not
// ContextGatherAnswerBox's option-buttons-plus-"Other" pattern.
function QuestionRow({
  question,
  value,
  onChange,
  disabled,
}: {
  question: string
  value: string | null
  onChange: (v: string | null) => void
  disabled: boolean
}) {
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 12.5, color: 'var(--ink)', marginBottom: 4 }}>{question}</div>
      <input
        type="text"
        value={value ?? ''}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value || null)}
        placeholder="Type an answer, or leave blank to skip"
        style={{
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
    </div>
  )
}

function UnitBlock({
  unit,
  answers,
  onChange,
  disabled,
}: {
  unit: EvidenceGatherUnit
  answers: (string | null)[]
  onChange: (qi: number, v: string | null) => void
  disabled: boolean
}) {
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>{unit.unitLabel}</div>
      <div style={{ fontSize: 11.5, color: 'var(--ink-subtle)', marginTop: 2 }}>{unit.reason}</div>
      {unit.questions.map((q, qi) => (
        <QuestionRow key={qi} question={q.question} value={answers[qi] ?? null} onChange={(v) => onChange(qi, v)} disabled={disabled} />
      ))}
    </div>
  )
}

export function EvidenceGatherAnswerBox({
  units,
  onSubmit,
  onSkip,
  submitting = false,
}: {
  units: EvidenceGatherUnit[]
  onSubmit: (answersPerUnit: (string | null)[][]) => void
  onSkip: () => void
  submitting?: boolean
}) {
  const [answers, setAnswers] = useState<(string | null)[][]>(() => units.map((u) => u.questions.map(() => null)))

  function setAnswer(unitIndex: number, questionIndex: number, v: string | null) {
    setAnswers((prev) =>
      prev.map((unitAnswers, ui) => (ui === unitIndex ? unitAnswers.map((a, qi) => (qi === questionIndex ? v : a)) : unitAnswers))
    )
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
      <div style={{ ...mono, color: 'var(--amber-text)', textTransform: 'uppercase' }}>Evidence — clarification needed</div>
      {units.map((unit, ui) => (
        <UnitBlock
          key={unit.unitId}
          unit={unit}
          answers={answers[ui]}
          onChange={(qi, v) => setAnswer(ui, qi, v)}
          disabled={submitting}
        />
      ))}

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
