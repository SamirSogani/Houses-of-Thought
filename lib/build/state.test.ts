// Reducer invariants (frontend plan Phase 1, tests 6–12): the Draft Mode stage
// machine and claim gate, purity, id semantics, and applyAiAction provenance.

import { describe, expect, it } from 'vitest'
import { initialState, reducer } from './state'
import { aiActionApplicable, applyAiAction } from './aiActions'
import { blankState, serializeContent } from './persistence'
import type { PersistedContent } from './persistence'
import { draftGateLocked, emptyDraft, type DraftState } from '@/lib/ai/draft'
import type { Action, State } from './types'

function deepFreeze<T>(obj: T): T {
  if (obj && typeof obj === 'object') {
    Object.getOwnPropertyNames(obj).forEach((k) => deepFreeze((obj as never)[k]))
    Object.freeze(obj)
  }
  return obj
}

function withDraft(stage: DraftState['stage'], drafted: string[] = [], claimed: string[] = []): State {
  const s = blankState()
  const d = emptyDraft()
  d.stage = stage
  for (const k of drafted) d.drafted[k as keyof DraftState['drafted']] = true
  for (const k of claimed) d.claimed[k as keyof DraftState['claimed']] = true
  s.draft = d
  return s
}

describe('draft stage machine', () => {
  it('APPLY_DRAFT_STAGE with a mismatched stage no-ops identically (idempotence guard)', () => {
    const s = withDraft('perspectives')
    const out = reducer(s, {
      type: 'APPLY_DRAFT_STAGE',
      stage: 'concepts', // stale response for an earlier stage
      actions: [{ kind: 'add_concept', term: 't', definition: 'd' }],
    })
    expect(out).toBe(s) // same reference — nothing applied
  })

  it('advances the stage; drafted is true iff at least one action applied', () => {
    const s = withDraft('concepts')
    const applied = reducer(s, {
      type: 'APPLY_DRAFT_STAGE',
      stage: 'concepts',
      actions: [{ kind: 'add_concept', term: 't', definition: 'd' }],
    })
    expect(applied.draft!.stage).toBe('perspectives')
    expect(applied.draft!.drafted.concepts).toBe(true)
    expect(applied.concepts).toHaveLength(1)
    expect(applied.step).toBe(1) // canvas follows the build

    const empty = reducer(s, { type: 'APPLY_DRAFT_STAGE', stage: 'concepts', actions: [] })
    expect(empty.draft!.stage).toBe('perspectives') // still advances
    expect(empty.draft!.drafted.concepts).toBe(false)
  })

  it('CLAIM_DRAFT_LAYER rejects undrafted and already-claimed layers', () => {
    const undrafted = withDraft('done')
    expect(reducer(undrafted, { type: 'CLAIM_DRAFT_LAYER', stage: 'concepts' })).toBe(undrafted)

    const claimed = withDraft('done', ['concepts'], ['concepts'])
    expect(reducer(claimed, { type: 'CLAIM_DRAFT_LAYER', stage: 'concepts' })).toBe(claimed)

    const claimable = withDraft('done', ['concepts'])
    const out = reducer(claimable, { type: 'CLAIM_DRAFT_LAYER', stage: 'concepts' })
    expect(out.draft!.claimed.concepts).toBe(true)
    expect(out.toast).toContain('yours to write') // settled — all drafted layers claimed
  })

  it('draftGateLocked truth table', () => {
    expect(draftGateLocked(null)).toBe(false)
    expect(draftGateLocked(withDraft('evidence').draft)).toBe(true) // mid-run
    expect(draftGateLocked(withDraft('done', ['concepts']).draft)).toBe(true) // unclaimed
    expect(draftGateLocked(withDraft('done', ['concepts'], ['concepts']).draft)).toBe(false)
  })

  it('STOP_DRAFT settles the stage machine; START_DRAFT never re-seeds', () => {
    const midRun = withDraft('evidence', ['concepts'])
    const stopped = reducer(midRun, { type: 'STOP_DRAFT' })
    expect(stopped.draft!.stage).toBe('done')
    expect(reducer(stopped, { type: 'START_DRAFT' })).toBe(stopped) // idempotent
  })
})

describe('reducer purity', () => {
  it('never mutates the input state for any action', () => {
    const frozen = deepFreeze(structuredClone(initialState))
    const restore = JSON.parse(serializeContent(initialState)) as PersistedContent
    const actions: Action[] = [
      { type: 'GO_STEP', n: 3 },
      { type: 'SET_TITLE', value: 'x' },
      { type: 'SET_MODE', mode: 'learn' },
      { type: 'ADD_CONCEPT' },
      { type: 'EDIT_CONCEPT', idx: 0, field: 'term', value: 'x' },
      { type: 'REMOVE_CONCEPT', idx: 0 },
      { type: 'ADD_PERSPECTIVE' },
      { type: 'EDIT_PERSPECTIVE', id: 1, field: 'name', value: 'x' },
      { type: 'REMOVE_PERSPECTIVE', id: 1 },
      { type: 'ADD_SUBQUESTION', pid: 1 },
      { type: 'EDIT_SUBQUESTION', pid: 1, idx: 0, field: 'q', value: 'x' },
      { type: 'ADD_EVIDENCE' },
      { type: 'REMOVE_EVIDENCE', id: 1 },
      { type: 'ADD_ASSUMPTION' },
      { type: 'ADD_IMPLICATION', kind: 'pos' },
      { type: 'TOGGLE_IMPLICATION_HORIZON', kind: 'pos', id: 1 },
      { type: 'REMOVE_IMPLICATION', kind: 'neg', id: 1 },
      { type: 'ADD_WATCHPOINT' },
      { type: 'EDIT_WATCHPOINT', idx: 0, value: 'x' },
      { type: 'APPLY_AI_ACTION', action: { kind: 'add_concept', term: 't', definition: 'd' } },
      { type: 'RESTORE_CONTENT', content: restore },
      { type: 'START_DRAFT' },
      { type: 'SET_TOAST', value: 'x' },
    ]
    for (const action of actions) {
      expect(() => reducer(frozen, action)).not.toThrow()
    }
  })
})

describe('id and navigation semantics', () => {
  it('GO_STEP clamps to 1–7', () => {
    expect(reducer(initialState, { type: 'GO_STEP', n: 0 }).step).toBe(1)
    expect(reducer(initialState, { type: 'GO_STEP', n: 99 }).step).toBe(7)
  })

  it('REMOVE_PERSPECTIVE clears a matching activePerspective', () => {
    const open = { ...initialState, activePerspective: 2 }
    expect(reducer(open, { type: 'REMOVE_PERSPECTIVE', id: 2 }).activePerspective).toBeNull()
    expect(reducer(open, { type: 'REMOVE_PERSPECTIVE', id: 1 }).activePerspective).toBe(2)
  })

  it('nextId reuses the max id after removing it (fe-L1 canary — change alerts a fix)', () => {
    const removed = reducer(initialState, { type: 'REMOVE_PERSPECTIVE', id: 6 })
    const added = reducer(removed, { type: 'ADD_PERSPECTIVE' })
    expect(added.perspectives.at(-1)!.id).toBe(6) // recycled — documented hazard
  })
})

describe('draft batch ordering and dedupe', () => {
  it('applies add_perspective before its add_subquestion within one stage batch (bl-L5)', () => {
    const s = withDraft('perspectives')
    const out = reducer(s, {
      type: 'APPLY_DRAFT_STAGE',
      stage: 'perspectives',
      actions: [
        // Emitted out of order by the model — the reducer must not drop the
        // sub-question just because its perspective comes later in the batch.
        { kind: 'add_subquestion', perspectiveName: 'Parents', q: 'What do they fear?' },
        { kind: 'add_perspective', name: 'Parents', summary: 's', stance: 'st' },
      ],
    })
    expect(out.perspectives).toHaveLength(1)
    expect(out.perspectives[0].subQuestions).toHaveLength(1)
  })

  it('applyAiAction dedupes same-text adds, case/whitespace-insensitive (bl-M1/M2)', () => {
    const draft = { ...blankState() }
    expect(applyAiAction(draft, { kind: 'add_concept', term: 'Equity', definition: 'd' })).not.toBeNull()
    expect(applyAiAction(draft, { kind: 'add_concept', term: '  equity ', definition: 'x' })).toBeNull()
    expect(draft.concepts).toHaveLength(1)
    expect(aiActionApplicable(draft, { kind: 'add_concept', term: 'EQUITY', definition: '' })).toBe(false)
    expect(aiActionApplicable(draft, { kind: 'add_concept', term: 'Fairness', definition: '' })).toBe(true)
  })
})

describe('applyAiAction provenance (invariant 5)', () => {
  it('AI evidence carries owner ai + byAI; perspectives/assumptions owner ai', () => {
    const draft = { ...blankState() }
    applyAiAction(draft, { kind: 'add_evidence', text: 't', source: 's', url: 'https://x.test' })
    expect(draft.evidence[0]).toMatchObject({ owner: 'ai', byAI: true })

    applyAiAction(draft, { kind: 'add_perspective', name: 'P', summary: 's', stance: 'st' })
    expect(draft.perspectives[0].owner).toBe('ai')

    applyAiAction(draft, { kind: 'add_assumption', text: 'a' })
    expect(draft.assumptions[0].owner).toBe('ai')
  })

  it('add_subquestion to an unknown perspective returns null and changes nothing', () => {
    const draft = { ...blankState() }
    const result = applyAiAction(draft, {
      kind: 'add_subquestion',
      perspectiveName: 'Nobody',
      q: 'q?',
    })
    expect(result).toBeNull()
    expect(serializeContent(draft)).toBe(serializeContent(blankState()))
  })
})
