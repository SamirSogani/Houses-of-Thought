// Applies an AI-proposed action to an already-cloned reducer draft. This is the
// ONLY place an AiAction becomes house state — routes return proposals, the user
// clicks Add, the reducer dispatches APPLY_AI_ACTION, and this runs. Mirrors the
// in-place mutation mechanics of lib/build/suggestions.ts run().
//
// Returns a toast string on success, or null when the action is inapplicable
// (e.g. add_subquestion naming a perspective that no longer exists) — then no-op.
//
// Provenance (invariant 5): AI-accepted perspectives/assumptions get owner 'ai';
// evidence gets owner 'ai' + byAI true. Concepts/implications/watchpoints have no
// owner field — an accepted gap for v1.

import type { State } from './types'
import type { AiAction } from '@/lib/ai/findings'

function nextId(items: { id: number }[]): number {
  return items.reduce((max, i) => Math.max(max, i.id), 0) + 1
}

const norm = (s: string) => s.trim().toLowerCase()

// Whether an action would actually change the house: the target still exists
// (add_subquestion names a live perspective) and the item isn't already there
// (same-text dedupe — a cached suggestion clicked twice, or a re-served card
// after a step revisit, must not double-insert; bl-M1/M2). applyAiAction calls
// this internally; the co-pilot panel calls it BEFORE consuming a card so an
// inapplicable Add can say so instead of vanishing silently.
export function aiActionApplicable(state: State, action: AiAction): boolean {
  switch (action.kind) {
    case 'add_concept':
      return !state.concepts.some((c) => norm(c.term) === norm(action.term))
    case 'add_perspective':
      return !state.perspectives.some((p) => norm(p.name) === norm(action.name))
    case 'add_subquestion': {
      const target = state.perspectives.find((p) => norm(p.name) === norm(action.perspectiveName))
      if (!target) return false
      return !target.subQuestions.some((sq) => norm(sq.q) === norm(action.q))
    }
    case 'add_perspective_evidence': {
      const target = state.perspectives.find((p) => norm(p.name) === norm(action.perspectiveName))
      if (!target) return false
      return !target.supportingEvidence.some((e) => norm(e.text) === norm(action.text))
    }
    case 'add_counter': {
      const target = state.perspectives.find((p) => norm(p.name) === norm(action.perspectiveName))
      if (!target) return false
      return !target.counters.some((c) => norm(c) === norm(action.text))
    }
    case 'add_assumption':
      return !state.assumptions.some((a) => norm(a.text) === norm(action.text))
    case 'add_implication':
      return !state[action.ikind].some((it) => norm(it.text) === norm(action.text))
    case 'add_watchpoint':
      return !state.watchpoints.some((w) => norm(w) === norm(action.text))
    case 'add_evidence':
      return !state.evidence.some((e) => norm(e.text) === norm(action.text))
    default:
      return false
  }
}

export function applyAiAction(draft: State, action: AiAction): string | null {
  if (!aiActionApplicable(draft, action)) return null
  switch (action.kind) {
    case 'add_concept':
      draft.concepts = [...draft.concepts, { term: action.term, definition: action.definition }]
      return 'Concept added'

    case 'add_perspective':
      draft.perspectives = [
        ...draft.perspectives,
        {
          id: nextId(draft.perspectives),
          name: action.name,
          summary: action.summary,
          stance: action.stance,
          subQuestions: [],
          supportingEvidence: [],
          counters: [],
          strength: 0,
          owner: 'ai',
        },
      ]
      return 'Perspective added'

    case 'add_subquestion': {
      // aiActionApplicable already verified the target exists.
      const match = draft.perspectives.find((p) => norm(p.name) === norm(action.perspectiveName))
      if (!match) return null
      draft.perspectives = draft.perspectives.map((p) =>
        p.id === match.id ? { ...p, subQuestions: [...p.subQuestions, { q: action.q, note: '' }] } : p
      )
      return `Sub-question added to ${match.name}`
    }

    case 'add_perspective_evidence': {
      const match = draft.perspectives.find((p) => norm(p.name) === norm(action.perspectiveName))
      if (!match) return null
      draft.perspectives = draft.perspectives.map((p) =>
        p.id === match.id ? { ...p, supportingEvidence: [...p.supportingEvidence, { text: action.text, source: action.source }] } : p
      )
      return `Evidence added to ${match.name}`
    }

    case 'add_counter': {
      const match = draft.perspectives.find((p) => norm(p.name) === norm(action.perspectiveName))
      if (!match) return null
      draft.perspectives = draft.perspectives.map((p) =>
        p.id === match.id ? { ...p, counters: [...p.counters, action.text] } : p
      )
      return `Counter added to ${match.name}`
    }

    case 'add_assumption':
      draft.assumptions = [
        ...draft.assumptions,
        { id: nextId(draft.assumptions), text: action.text, owner: 'ai' },
      ]
      return 'Assumption added'

    case 'add_implication': {
      const list = draft[action.ikind]
      draft[action.ikind] = [
        ...list,
        { id: nextId(list), text: action.text, horizon: action.horizon, who: action.who },
      ]
      return 'Implication added'
    }

    case 'add_watchpoint':
      draft.watchpoints = [...draft.watchpoints, action.text]
      return 'Watchpoint added'

    case 'add_evidence':
      draft.evidence = [
        ...draft.evidence,
        {
          id: nextId(draft.evidence),
          text: action.text,
          source: action.source,
          url: action.url,
          owner: 'ai',
          byAI: true,
        },
      ]
      return 'Evidence added'

    default:
      return null
  }
}
