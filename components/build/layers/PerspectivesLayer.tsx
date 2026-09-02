'use client'

// Layer 2 — Perspectives as inline cards (builder-workspace-redesign plan §3,
// phase 3). Each card carries the name, summary, and stance ("this
// perspective concludes"), and expands in place into its sub-questions,
// supporting evidence, and counterarguments (PerspectiveBody). Expansion is
// local UI state: the document view never dispatches OPEN_PERSPECTIVE, since
// GO_STEP clears activePerspective and the scroll-spy dispatches GO_STEP as
// you scroll — a drill-in would collapse under the reader.
//
// The prototype colours each card's top edge by a perspective *category*
// (Practical / Emotional / Long-term / Industry) that is not in the data
// model; the accent cycles by position instead, so cards stay distinguishable
// without inventing a field.

import { useState } from 'react'
import type { Action, State } from '@/lib/build/types'
import { people } from '@/lib/build/people'
import { Avatar } from '../Avatar'
import { ChevronRight } from '../buildIcons'
import { InlineText, RemoveButton } from '../Editable'
import { AddRow, PerspectiveBody } from './PerspectiveDetail'

const ACCENTS = ['var(--green-strong)', 'var(--amber)', 'var(--blueprint)', 'var(--warning)']

export function PerspectivesLayer({ state, dispatch }: { state: State; dispatch: React.Dispatch<Action> }) {
  const [open, setOpen] = useState<Set<number>>(new Set())
  const toggle = (id: number) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <div className="fade-in" style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {state.perspectives.map((p, i) => {
        const accent = ACCENTS[i % ACCENTS.length]
        const expanded = open.has(p.id)
        const detail = `${p.subQuestions.length} ${p.subQuestions.length === 1 ? 'question' : 'questions'} · ${p.supportingEvidence.length} evidence · ${p.counters.length} ${p.counters.length === 1 ? 'counter' : 'counters'}`
        return (
          <article
            key={p.id}
            className="pop"
            aria-label={p.name.trim() || 'Perspective'}
            style={{ background: 'var(--white)', border: '1px solid var(--rule)', borderTop: `3px solid ${accent}`, borderRadius: 12, padding: '14px 16px 12px' }}
          >
            {/* Header: name, owner, remove */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <span style={{ flex: 1, minWidth: 0, fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 18, color: 'var(--ink)', lineHeight: 1.3 }}>
                <InlineText
                  ariaLabel="Perspective name"
                  value={p.name}
                  placeholder="Stakeholder"
                  onChange={(value) => dispatch({ type: 'EDIT_PERSPECTIVE', id: p.id, field: 'name', value })}
                />
              </span>
              <Avatar who={p.owner} size={24} title={people[p.owner].name} />
              <RemoveButton title="Remove perspective" onClick={() => dispatch({ type: 'REMOVE_PERSPECTIVE', id: p.id })} />
            </div>

            {/* Summary */}
            <div style={{ fontSize: 13, color: 'var(--ink-mid)', lineHeight: 1.5, marginTop: 6 }}>
              <InlineText
                ariaLabel="Perspective summary"
                multiline
                value={p.summary}
                placeholder="What does this stakeholder value and fear?"
                onChange={(value) => dispatch({ type: 'EDIT_PERSPECTIVE', id: p.id, field: 'summary', value })}
              />
            </div>

            {/* Stance — "this perspective concludes" */}
            <div style={{ marginTop: 12, background: 'var(--parchment)', border: '1px solid var(--rule-soft)', borderRadius: 9, padding: '10px 12px' }}>
              <div className="mono" style={{ fontSize: 9, letterSpacing: '0.11em', textTransform: 'uppercase', color: 'var(--ink-subtle)' }}>
                This perspective concludes
              </div>
              <div style={{ fontSize: 13, fontStyle: 'italic', color: 'var(--ink-mid)', lineHeight: 1.55, marginTop: 4 }}>
                <InlineText
                  ariaLabel="Stance"
                  multiline
                  value={p.stance}
                  placeholder="Where this perspective lands, in a sentence."
                  onChange={(value) => dispatch({ type: 'EDIT_PERSPECTIVE', id: p.id, field: 'stance', value })}
                />
              </div>
            </div>

            {/* Expand into the full body */}
            <button
              type="button"
              onClick={() => toggle(p.id)}
              aria-expanded={expanded}
              className="mono"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10, fontSize: 10, letterSpacing: '0.06em', color: 'var(--blueprint)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}
            >
              <span style={{ display: 'inline-flex', transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>
                <ChevronRight size={12} stroke="var(--blueprint)" />
              </span>
              {expanded ? 'Hide details' : 'Details'} · {detail}
            </button>
            {expanded && (
              <div className="fade-in" style={{ marginTop: 4 }}>
                <PerspectiveBody perspective={p} dispatch={dispatch} showStance={false} />
              </div>
            )}
          </article>
        )
      })}
      <AddRow label="+ Add a perspective" onClick={() => dispatch({ type: 'ADD_PERSPECTIVE' })} />
    </div>
  )
}
