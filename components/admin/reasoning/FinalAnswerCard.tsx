'use client'

// Shared between the live pipeline page (ReasoningPipelinePage) and the past-
// runs browser (ReasoningRunsBrowser) — a completed run's FinalAnswer renders
// identically whether it just finished or is being replayed from
// reasoning_runs (decision 019, Phase 2 item 1).

import type { FinalAnswer } from '@/lib/ai/reasoning/contracts'

const mono: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.06em' }

export function FinalAnswerCard({ finalAnswer }: { finalAnswer: FinalAnswer }) {
  return (
    <div style={{ background: 'var(--white)', border: '1px solid var(--amber)', borderRadius: 11, padding: '16px 18px', marginTop: 12 }}>
      <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>Final answer</div>
      <div style={{ fontSize: 13.5, color: 'var(--ink)', marginTop: 8, lineHeight: 1.55 }}>{finalAnswer.answer}</div>
      {finalAnswer.caveats.length > 0 && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--rule)' }}>
          <div style={mono}>CAVEATS</div>
          <ul style={{ marginTop: 4, paddingLeft: 18 }}>
            {finalAnswer.caveats.map((c, i) => (
              <li key={i} style={{ fontSize: 12.5, color: 'var(--ink-subtle)', lineHeight: 1.5 }}>
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
