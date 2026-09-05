'use client'

// Blank-canvas CTA (plan doc 32, Phase 1 step 4): when the house is blank
// and the pipeline is idle, the canvas itself shows a prominent entry
// point — not hidden behind the copilot tab. Two paths:
//  - "Let AI reason through this" — a question input + "Build my house"
//    button. Clicking it starts the pipeline and enters the full-screen
//    pipeline view.
//  - The user can also just start typing manually — unchanged behavior.

import { useState } from 'react'
import type { Action, State } from '@/lib/build/types'
import type { ReasoningPipelineRunner } from './useReasoningPipelineRunner'
import { SparkIcon } from './buildIcons'

export function BlankCanvasCTA({
  state,
  dispatch,
  runner,
  onStartPipeline,
}: {
  state: State
  dispatch: React.Dispatch<Action>
  runner: ReasoningPipelineRunner
  onStartPipeline: () => void
}) {
  const [question, setQuestion] = useState('')
  const hasQuestion = state.question.trim().length > 0
  const ready = hasQuestion || question.trim().length > 0

  function handleStart() {
    const q = hasQuestion ? state.question : question.trim()
    if (!q) return
    if (!hasQuestion) dispatch({ type: 'SET_QUESTION', value: q })
    runner.start(q)
    onStartPipeline()
  }

  return (
    <div
      className="fade-in"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        padding: '48px 36px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 48,
          height: 48,
          borderRadius: 999,
          background: 'var(--amber-tint)',
          border: '1px solid var(--amber)',
          marginBottom: 20,
        }}
      >
        <SparkIcon size={22} fill="var(--amber)" />
      </div>

      <h2
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 500,
          fontSize: 24,
          letterSpacing: '-0.01em',
          color: 'var(--ink)',
          margin: '0 0 8px',
        }}
      >
        Build your house of thought
      </h2>
      <p style={{ fontSize: 14, color: 'var(--ink-mid)', lineHeight: 1.55, maxWidth: 420, margin: '0 0 24px' }}>
        Enter a question and let the reasoning pipeline think through it
        step by step — framing, perspectives, evidence, conclusions,
        implications — then review and refine what it builds.
      </p>

      <div style={{ width: '100%', maxWidth: 480 }}>
        {!hasQuestion && (
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && ready) {
                e.preventDefault()
                handleStart()
              }
            }}
            placeholder="What question should it reason about?"
            rows={3}
            style={{
              width: '100%',
              marginBottom: 12,
              fontSize: 14,
              padding: '12px 14px',
              border: '1px solid var(--rule)',
              borderRadius: 10,
              background: 'var(--white)',
              color: 'var(--ink)',
              outline: 'none',
              resize: 'vertical',
              fontFamily: 'inherit',
              lineHeight: 1.5,
            }}
          />
        )}
        {hasQuestion && (
          <div
            style={{
              marginBottom: 12,
              padding: '12px 14px',
              border: '1px solid var(--rule)',
              borderRadius: 10,
              background: 'var(--white)',
              fontSize: 14,
              color: 'var(--ink)',
              lineHeight: 1.5,
              textAlign: 'left',
            }}
          >
            {state.question}
          </div>
        )}
        <button
          type="button"
          onClick={handleStart}
          disabled={!ready}
          style={{
            fontWeight: 600,
            fontSize: 14,
            color: 'var(--ink)',
            background: 'var(--amber-tint)',
            border: '1px solid var(--amber)',
            borderRadius: 10,
            padding: '10px 22px',
            cursor: ready ? 'pointer' : 'not-allowed',
            opacity: ready ? 1 : 0.55,
            width: '100%',
          }}
        >
          Build my house
        </button>
        <div className="mono" style={{ fontSize: 10, color: 'var(--ink-subtle)', marginTop: 10, letterSpacing: '0.04em' }}>
          Express mode · ~30–60 seconds
        </div>
      </div>
    </div>
  )
}
