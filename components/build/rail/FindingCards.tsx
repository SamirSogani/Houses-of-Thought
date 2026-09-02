// Co-pilot suggestion cards (builder-workspace-redesign plan §3, phase 2),
// shared by the Co-pilot tab and the Overview tab. Moved out of CopilotPanel
// so both render the same card.
//
// Declutter item 3: every card shows the Socratic question AND the concrete
// observation/suggestion — the model fills all three on every finding
// regardless of mode (lib/ai/findings.ts), so this was always a rendering
// choice. The Add button follows finding.action (null when the move is
// "think", not "add") AND !restrictAuthorship — a coach-posture account
// (student, or a standard account's own assignment submission) sees the same
// text as anyone else, just never the one-click insert (decision 007,
// lib/auth/capabilities.ts's "never get author output"). Skip is always
// available: it only hides the card.

import type { Finding, FindingKind } from '@/lib/ai/findings'
import { PlusIcon } from '../buildIcons'

// snake_case finding kind → the mono tag shown on each card.
export const KIND_LABEL: Record<FindingKind, string> = {
  framing: 'Framing',
  vague_concept: 'Concept',
  missing_perspective: 'Perspective',
  weak_perspective: 'Perspective',
  missing_evidence: 'Evidence',
  single_source: 'Evidence',
  hidden_assumption: 'Assumption',
  load_bearing: 'Assumption',
  conclusion_gap: 'Conclusion',
  unexamined_implication: 'Implication',
}

export function FindingList({
  items,
  restrictAuthorship,
  onAdd,
  onSkip,
  emptyText = "No open suggestions for this layer. Refresh once you've made changes.",
}: {
  items: { finding: Finding; idx: number }[]
  restrictAuthorship: boolean
  onAdd: (finding: Finding, idx: number) => void
  onSkip: (idx: number) => void
  emptyText?: string
}) {
  if (items.length === 0) {
    return (
      <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--ink-subtle)', padding: '20px 0', lineHeight: 1.5 }}>
        {emptyText}
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map(({ finding, idx }) => (
        <FindingCard key={idx} finding={finding} restrictAuthorship={restrictAuthorship} onAdd={() => onAdd(finding, idx)} onSkip={() => onSkip(idx)} />
      ))}
    </div>
  )
}

export function FindingCard({
  finding,
  restrictAuthorship,
  onAdd,
  onSkip,
}: {
  finding: Finding
  restrictAuthorship: boolean
  onAdd: () => void
  onSkip: () => void
}) {
  const important = finding.severity === 'important'
  const canAdd = finding.action !== null && !restrictAuthorship
  return (
    <div
      className="pop"
      style={{
        background: 'var(--parchment)',
        border: '1px solid var(--rule)',
        borderLeft: important ? '3px solid var(--amber)' : '1px solid var(--rule)',
        borderRadius: 11,
        padding: '12px 13px',
      }}
    >
      <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.5 }}>{finding.observation}</div>
      <div style={{ fontSize: 13, color: 'var(--ink-mid)', lineHeight: 1.45, marginTop: 5 }}>{finding.suggestion}</div>
      <div style={{ fontSize: 12, color: 'var(--ink-subtle)', lineHeight: 1.45, marginTop: 7, fontStyle: 'italic' }}>{finding.question}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, gap: 8 }}>
        <span className="mono" style={{ fontSize: 9, color: 'var(--ink-subtle)' }}>{KIND_LABEL[finding.kind]}</span>
        <span style={{ display: 'inline-flex', gap: 6 }}>
          {canAdd && (
            <button
              type="button"
              onClick={onAdd}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 600, fontSize: 12, color: 'var(--ink)', background: 'var(--amber-tint)', border: '1px solid var(--amber)', borderRadius: 6, padding: '5px 11px', cursor: 'pointer' }}
            >
              <PlusIcon size={12} />
              Add
            </button>
          )}
          <button
            type="button"
            onClick={onSkip}
            aria-label={`Skip: ${finding.observation.slice(0, 60)}`}
            style={{ fontWeight: 500, fontSize: 12, color: 'var(--ink-subtle)', background: 'transparent', border: '1px solid var(--rule)', borderRadius: 6, padding: '5px 10px', cursor: 'pointer' }}
          >
            Skip
          </button>
        </span>
      </div>
    </div>
  )
}

export function SkeletonCards({ count = 3 }: { count?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} style={{ border: '1px solid var(--rule)', borderRadius: 11, padding: 13, opacity: 0.6 }}>
          <div style={{ height: 11, background: 'var(--rule)', borderRadius: 4, width: '92%' }} />
          <div style={{ height: 11, background: 'var(--rule)', borderRadius: 4, width: '70%', marginTop: 7 }} />
          <div style={{ height: 9, background: 'var(--parchment)', borderRadius: 4, width: '40%', marginTop: 12 }} />
        </div>
      ))}
    </div>
  )
}
