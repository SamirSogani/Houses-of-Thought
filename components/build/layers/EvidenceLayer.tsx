// Layer 3 — Evidence as a numbered list (builder-workspace-redesign plan §3,
// phase 3): E.01, the claim, its source in italics beneath. Research Mode
// (Brave-grounded, Decide-only — decision 007 / doc 04) is the "Find more
// evidence" affordance and mounts ResearchResults inline above the list,
// exactly as before.

'use client'

import { useState } from 'react'
import type { Action, State } from '@/lib/build/types'
import { Avatar } from '../Avatar'
import { SearchIcon } from '../buildIcons'
import { people } from '@/lib/build/people'
import { InlineText, RemoveButton } from '../Editable'
import { ResearchResults } from './ResearchResults'
import { safeHttpUrl } from '@/lib/safeUrl'
import { AddRow } from './PerspectiveDetail'

export function EvidenceLayer({ state, dispatch }: { state: State; dispatch: React.Dispatch<Action> }) {
  const [researchOpen, setResearchOpen] = useState(false)
  // Research Mode is a Decide-only capability (decision 007 / doc 04).
  const researchEnabled = state.mode === 'decide'

  return (
    <div className="fade-in" style={{ marginTop: 18 }}>
      {researchOpen && researchEnabled && (
        <div style={{ marginBottom: 14 }}>
          <ResearchResults state={state} dispatch={dispatch} />
        </div>
      )}

      {/* List */}
      <ol style={{ listStyle: 'none', margin: 0, padding: 0, background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 12, overflow: 'hidden' }}>
        {state.evidence.length === 0 && (
          <li style={{ padding: '16px', fontSize: 13, color: 'var(--ink-subtle)', lineHeight: 1.5 }}>
            Nothing sourced yet. Find evidence with Research Mode, or add a claim and cite it.
          </li>
        )}
        {state.evidence.map((e, i) => {
          const href = safeHttpUrl(e.url)
          return (
            <li key={e.id} className="pop" style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 14px', borderTop: i === 0 ? 'none' : '1px solid var(--rule-soft)' }}>
              <span className="mono" style={{ fontSize: 10, color: 'var(--blueprint)', paddingTop: 4, flex: '0 0 auto', minWidth: 30 }}>
                E.{String(i + 1).padStart(2, '0')}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.5 }}>
                  <InlineText
                    ariaLabel="Evidence claim"
                    multiline
                    value={e.text}
                    placeholder="A claim to support with a citation."
                    onChange={(value) => dispatch({ type: 'EDIT_EVIDENCE', id: e.id, field: 'text', value })}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4, fontSize: 12, fontStyle: 'italic', color: 'var(--ink-subtle)', minWidth: 0 }}>
                  {href ? (
                    // Cited evidence (Research Mode): the source is a real link, not
                    // editable. Gated on safeHttpUrl so a non-http(s) URL can never
                    // render as an href.
                    <a href={href} target="_blank" rel="noreferrer" style={{ color: 'var(--blueprint)', textDecoration: 'underline', overflowWrap: 'anywhere' }}>
                      {e.source || e.url}
                    </a>
                  ) : (
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <InlineText
                        ariaLabel="Evidence source"
                        value={e.source}
                        placeholder="Add source"
                        onChange={(value) => dispatch({ type: 'EDIT_EVIDENCE', id: e.id, field: 'source', value })}
                      />
                    </span>
                  )}
                  {e.byAI && <span className="mono" style={{ fontSize: 9, fontStyle: 'normal', color: 'var(--amber-text)', flex: '0 0 auto' }}>via Research Mode</span>}
                </div>
              </div>
              <Avatar who={e.owner} size={22} title={people[e.owner].name} />
              <RemoveButton title="Remove evidence" onClick={() => dispatch({ type: 'REMOVE_EVIDENCE', id: e.id })} />
            </li>
          )
        })}
      </ol>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          type="button"
          onClick={() => setResearchOpen((o) => !o)}
          disabled={!researchEnabled}
          aria-pressed={researchOpen}
          title={researchEnabled ? 'Find cited sources with Brave Search' : 'Research runs in Decide mode'}
          className="mono"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10, color: researchEnabled ? 'var(--ink)' : 'var(--ink-subtle)', background: researchOpen ? 'var(--amber)' : 'var(--amber-tint)', border: '1px solid var(--amber)', borderRadius: 8, padding: '7px 12px', cursor: researchEnabled ? 'pointer' : 'not-allowed', opacity: researchEnabled ? 1 : 0.6 }}
        >
          <SearchIcon size={12} />
          {researchOpen ? 'Close Research Mode' : 'Find more evidence'}
        </button>
        <AddRow label="+ Add a claim manually" onClick={() => dispatch({ type: 'ADD_EVIDENCE' })} />
      </div>
    </div>
  )
}
