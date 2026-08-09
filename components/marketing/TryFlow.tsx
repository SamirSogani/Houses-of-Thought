'use client'

// The redesigned /try: this is explicitly a placeholder (real-pipeline brief)
// — a short animated beat, then a STATIC confirmation of what a full run
// would have done. No AI call, no generated output, no email capture.
//
// This replaces components/try/TryItFlow.tsx on this route only. That file
// (and MiniHouseResult.tsx, which it renders) is left in place, untouched —
// it called a real endpoint (/api/ai/mini-house) that produced actual
// generated perspectives/evidence/synthesis using the OLD three-fixed-
// perspective model, which no longer matches the ground-truth methodology
// this redesign markets everywhere else (Frame → Breadth Scoping →
// Perspectives → Global Assumptions → Global Evidence → Conclusions →
// Implications, each panel-reviewed). Shipping both would show visitors two
// different products under one name.

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Constellation from './Constellation'
import { ArrowIcon } from '@/components/icons'

type Phase = 'input' | 'sweep' | 'confirmation'

const WHAT_A_FULL_RUN_DOES = [
  {
    title: 'Frame it',
    body: 'Pin down exactly what’s being decided, define the terms that matter, and set the scope, before arguing anything.',
  },
  {
    title: 'Build real perspectives',
    body: 'Independent stances, each with its own claims, sub-questions, assumptions, evidence, and a genuine counterargument against itself.',
  },
  {
    title: 'Stress-test the assumptions and evidence',
    body: 'Everything is checked by a review panel of nine independent standards (clarity, accuracy, precision, relevance, depth, breadth, logic, significance, fairness) before it counts.',
  },
  {
    title: 'Show what follows',
    body: 'A conclusion that actually follows from what passed review, plus its implications: positive, negative, and uncertain, who’s affected, and on what timeline.',
  },
]

function TryFlowInner() {
  const params = useSearchParams()
  const initialQ = params.get('q') ?? ''
  const [question, setQuestion] = useState(initialQ)
  const [phase, setPhase] = useState<Phase>(initialQ.trim().length > 0 ? 'sweep' : 'input')
  const [confirmedQuestion, setConfirmedQuestion] = useState(initialQ)

  function startSweep(q: string) {
    const trimmed = q.trim()
    if (trimmed.length < 5) return
    setConfirmedQuestion(trimmed)
    setPhase('sweep')
  }

  if (phase === 'input') {
    return (
      <section style={{ paddingBlock: 'clamp(48px, 9vw, 96px)' }}>
        <div className="container" style={{ maxWidth: 720, margin: '0 auto' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--amber)' }}>
            Try it · no account needed
          </p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 'clamp(34px, 5vw, 54px)', lineHeight: 1.08, letterSpacing: '-0.015em', marginTop: 16, color: 'var(--dusk-ink)' }}>
            What&rsquo;s a difficult decision you&rsquo;re trying to think through?
          </h1>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              startSweep(question)
            }}
            className="dusk-card"
            style={{ marginTop: 28, overflow: 'hidden' }}
          >
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value.slice(0, 600))}
              placeholder="e.g. Should I leave my stable job to start something on my own?"
              rows={4}
              aria-label="Your difficult decision or question"
              style={{ width: '100%', resize: 'vertical', border: 'none', outline: 'none', background: 'transparent', padding: '20px 22px', fontFamily: 'var(--font-body)', fontSize: 17, lineHeight: 1.6, color: 'var(--dusk-ink)', minHeight: 120 }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 16px 16px', borderTop: '1px solid var(--dusk-rule)' }}>
              <button type="submit" className="btn-primary" disabled={question.trim().length < 5} style={{ opacity: question.trim().length < 5 ? 0.5 : 1 }}>
                Start <ArrowIcon />
              </button>
            </div>
          </form>
        </div>
      </section>
    )
  }

  if (phase === 'sweep') {
    return (
      <section style={{ paddingBlock: 'clamp(56px, 10vw, 108px)', minHeight: '55vh', display: 'flex', alignItems: 'center' }}>
        <div className="container" style={{ maxWidth: 760, margin: '0 auto', textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--dusk-ink-subtle)' }}>Walking the seven layers</p>
          <p style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 500, fontSize: 'clamp(22px, 3vw, 30px)', color: 'var(--dusk-ink)', marginTop: 10 }}>
            &ldquo;{confirmedQuestion}&rdquo;
          </p>
          <div style={{ marginTop: 32 }}>
            <Constellation variant="sweep" onSweepComplete={() => setPhase('confirmation')} />
          </div>
        </div>
      </section>
    )
  }

  return (
    <section style={{ paddingBlock: 'clamp(48px, 9vw, 96px)' }}>
      <div className="container" style={{ maxWidth: 760, margin: '0 auto' }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--amber)' }}>
          Your question, framed
        </p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 'clamp(30px, 4.4vw, 46px)', lineHeight: 1.12, letterSpacing: '-0.01em', color: 'var(--dusk-ink)', marginTop: 14 }}>
          &ldquo;{confirmedQuestion}&rdquo;
        </h1>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 17, lineHeight: 1.6, color: 'var(--dusk-ink-mid)', marginTop: 16, maxWidth: '60ch' }}>
          That&rsquo;s a real question worth reasoning through properly. Wiring your
          question into the live reasoning pipeline is coming in a future
          update. Here&rsquo;s exactly what a full run does with it.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginTop: 32 }}>
          {WHAT_A_FULL_RUN_DOES.map((step, i) => (
            <div key={step.title} className="dusk-card" style={{ padding: '20px 22px' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--standard-cool)' }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <p style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 18, color: 'var(--dusk-ink)', marginTop: 8 }}>{step.title}</p>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 14.5, lineHeight: 1.55, color: 'var(--dusk-ink-mid)', marginTop: 8 }}>{step.body}</p>
            </div>
          ))}
        </div>

        <div className="dusk-card" style={{ marginTop: 40, padding: 'clamp(24px, 4vw, 36px)', textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 24, color: 'var(--dusk-ink)' }}>
            Free, and it stays that way.
          </p>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 15.5, lineHeight: 1.6, color: 'var(--dusk-ink-mid)', marginTop: 10, maxWidth: '52ch', marginInline: 'auto' }}>
            Create a free account and we&rsquo;ll let you know the moment full
            reasoning runs are live.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 22 }}>
            <Link href={`/login?mode=signup&q=${encodeURIComponent(confirmedQuestion)}`} className="btn-primary">
              Create free account <ArrowIcon />
            </Link>
            <button
              type="button"
              onClick={() => {
                setPhase('input')
                setQuestion('')
              }}
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: 52, padding: '0 24px', border: '1px solid var(--dusk-rule)', color: 'var(--dusk-ink)', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 16, borderRadius: 'var(--radius-btn)' }}
            >
              Try another question
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

// useSearchParams requires a Suspense boundary (matches app/welcome/page.tsx's
// existing pattern).
export default function TryFlow() {
  return (
    <Suspense fallback={null}>
      <TryFlowInner />
    </Suspense>
  )
}
