// Persistence boundary between the Build reducer (integer ids, ephemeral view
// state) and the normalized Supabase schema (uuid ids, one child table per
// layer). The reducer and lib/build/types.ts are deliberately untouched — all
// row↔state mapping lives here. See plans/active/persistence/phase-3-builder.md
// and decisions/002-house-schema.md.

import type { Concept, Perspective, State } from './types'
import { doneCount } from './strength'

// Normalize stored concepts into { term, definition } objects. Tolerates the
// pre-definitions shape (a bare string[]) so older saved houses still load.
function toConcepts(raw: unknown): Concept[] {
  if (!Array.isArray(raw)) return []
  return raw.map((c) =>
    typeof c === 'string'
      ? { term: c, definition: '' }
      : { term: (c?.term as string) ?? '', definition: (c?.definition as string) ?? '' }
  )
}

// Normalize stored perspectives, filling the detail fields (stance, sub-questions,
// supporting evidence, counters) so pre-detail saved houses still load.
function toPerspectives(raw: unknown): Perspective[] {
  if (!Array.isArray(raw)) return []
  return raw.map((p, i) => ({
    id: typeof p?.id === 'number' ? p.id : i + 1,
    name: p?.name ?? '',
    summary: p?.summary ?? '',
    stance: p?.stance ?? '',
    subQuestions: Array.isArray(p?.subQuestions) ? p.subQuestions : [],
    supportingEvidence: Array.isArray(p?.supportingEvidence) ? p.supportingEvidence : [],
    counters: Array.isArray(p?.counters) ? p.counters : [],
    strength: typeof p?.strength === 'number' ? p.strength : 0,
    owner: p?.owner ?? 'you',
  }))
}
import type { HouseStatus } from '@/lib/dashboard/houses'

type Supabase = ReturnType<typeof import('@/lib/supabase/client').createClient>

// A real, empty house: the initialState shape with no content and default view
// state. Never write lib/build/state.ts's initialState to a real house — that is
// demo content. New houses load blank.
export function blankState(): State {
  return {
    step: 1,
    title: '',
    purpose: '',
    question: '',
    conclusion: '',
    reasoning: '',
    rightTab: 'copilot',
    inviteOpen: false,
    inviteInput: '',
    copied: false,
    notesOpen: false,
    toast: '',
    concepts: [],
    perspectives: [],
    evidence: [],
    assumptions: [],
    pos: [],
    neg: [],
    unc: [],
    watchpoints: [],
    accepted: {},
    activePerspective: null,
  }
}

// empty → no content at all; complete → all 7 layers done; else in-progress.
export function deriveStatus(state: State): HouseStatus {
  if (doneCount(state) === 7) return 'complete'
  const hasContent =
    state.concepts.length > 0 ||
    state.perspectives.length > 0 ||
    state.evidence.length > 0 ||
    state.assumptions.length > 0 ||
    state.pos.length > 0 ||
    state.neg.length > 0 ||
    state.unc.length > 0 ||
    state.watchpoints.length > 0
  if (hasContent || state.title.trim().length > 0) return 'in-progress'
  return 'empty'
}

// Local (no-login) persistence, backing the /house builder and the planned /try
// surface. Stores only the persistable subset (serializeContent's shape) in
// localStorage under one generic key, so any no-login builder shares the adapter.
// Deliberately no Supabase / auth / RLS — the counterpart to save/loadHouse below.
export const LOCAL_HOUSE_KEY = 'hot:house:draft'

export function saveLocalHouse(state: State): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LOCAL_HOUSE_KEY, serializeContent(state))
  } catch {
    // Quota exceeded or storage disabled (private mode): drop the write rather
    // than crash the editor. The in-memory reducer keeps working.
  }
}

export function loadLocalHouse(): State | null {
  if (typeof window === 'undefined') return null
  let raw: string | null
  try {
    raw = window.localStorage.getItem(LOCAL_HOUSE_KEY)
  } catch {
    return null
  }
  if (!raw) return null

  try {
    // serializeContent stores full reducer objects, so fields map straight back
    // onto a blank house — no row↔state remapping needed (unlike loadHouse).
    const c = JSON.parse(raw) as Partial<State>
    const state = blankState()
    state.title = c.title ?? ''
    state.purpose = c.purpose ?? ''
    state.question = c.question ?? ''
    state.conclusion = c.conclusion ?? ''
    state.reasoning = c.reasoning ?? ''
    state.concepts = toConcepts(c.concepts)
    state.perspectives = toPerspectives(c.perspectives)
    state.evidence = c.evidence ?? []
    state.assumptions = c.assumptions ?? []
    state.pos = c.pos ?? []
    state.neg = c.neg ?? []
    state.unc = c.unc ?? []
    state.watchpoints = c.watchpoints ?? []
    state.accepted = c.accepted ?? {}
    return state
  } catch {
    return null
  }
}

// JSON of just the persistable subset — used as the autosave effect's dependency
// so ephemeral changes (step, tabs, toast, invite) never trigger a save.
export function serializeContent(state: State): string {
  return JSON.stringify({
    title: state.title,
    purpose: state.purpose,
    question: state.question,
    conclusion: state.conclusion,
    reasoning: state.reasoning,
    concepts: state.concepts,
    perspectives: state.perspectives,
    evidence: state.evidence,
    assumptions: state.assumptions,
    pos: state.pos,
    neg: state.neg,
    unc: state.unc,
    watchpoints: state.watchpoints,
    accepted: state.accepted,
  })
}

// Load a specific house into a reducer State, or null when the row does not exist
// or is not the caller's (RLS makes both look empty). Integer ids are re-assigned
// sequentially per list by DB position, so nextId() keeps working for later adds.
export async function loadHouse(supabase: Supabase, id: string): Promise<State | null> {
  const { data: house, error } = await supabase
    .from('houses')
    .select('title, question, purpose, conclusion, reasoning, concepts, concept_definitions, watchpoints, accepted')
    .eq('id', id)
    .maybeSingle()
  if (error || !house) return null

  const [persp, evid, assum, implic] = await Promise.all([
    supabase.from('house_perspectives').select('*').eq('house_id', id).order('position'),
    supabase.from('house_evidence').select('*').eq('house_id', id).order('position'),
    supabase.from('house_assumptions').select('*').eq('house_id', id).order('position'),
    supabase.from('house_implications').select('*').eq('house_id', id).order('position'),
  ])

  const state = blankState()
  state.title = house.title ?? ''
  state.question = house.question ?? ''
  state.purpose = house.purpose ?? ''
  state.conclusion = house.conclusion ?? ''
  state.reasoning = house.reasoning ?? ''
  const conceptTerms = (house.concepts as string[] | null) ?? []
  const conceptDefs = (house.concept_definitions as string[] | null) ?? []
  state.concepts = conceptTerms.map((term, i) => ({ term, definition: conceptDefs[i] ?? '' }))
  state.watchpoints = house.watchpoints ?? []
  state.accepted = (house.accepted as Record<number, number[]>) ?? {}

  state.perspectives = (persp.data ?? []).map((r, i) => ({
    id: i + 1,
    name: r.name,
    summary: r.summary ?? '',
    stance: (r.stance as string | null) ?? '',
    subQuestions: (r.sub_questions as Perspective['subQuestions'] | null) ?? [],
    supportingEvidence: (r.supporting_evidence as Perspective['supportingEvidence'] | null) ?? [],
    counters: (r.counters as string[] | null) ?? [],
    strength: r.strength,
    owner: r.owner_key,
  }))

  state.evidence = (evid.data ?? []).map((r, i) => ({
    id: i + 1,
    text: r.text,
    source: r.source ?? '',
    owner: r.owner_key,
    byAI: r.by_ai,
  }))

  state.assumptions = (assum.data ?? []).map((r, i) => ({
    id: i + 1,
    text: r.text,
    owner: r.owner_key,
  }))

  const rows = implic.data ?? []
  const byKind = (kind: string) =>
    rows
      .filter((r) => r.kind === kind)
      .map((r, i) => ({ id: i + 1, text: r.text, horizon: r.horizon, who: r.who ?? '' }))
  state.pos = byKind('pos')
  state.neg = byKind('neg')
  state.unc = byKind('unc')

  return state
}

// Whole-house replace: update the parent scalar/array columns, then for each
// child table delete the house's rows and bulk-insert the current arrays with
// position = index. Simplest correct v1. NOT atomic — a failed insert after a
// delete could drop a layer; acceptable for single-user/single-tab. Hardening
// (a transactional RPC) is out of scope for Phase 3.
export async function saveHouse(supabase: Supabase, id: string, state: State): Promise<void> {
  // Parent. updated_at is bumped by the 0003 trigger on this update.
  await supabase
    .from('houses')
    .update({
      title: state.title || null,
      question: state.question || null,
      purpose: state.purpose || null,
      conclusion: state.conclusion || null,
      reasoning: state.reasoning || null,
      concepts: state.concepts.map((c) => c.term),
      concept_definitions: state.concepts.map((c) => c.definition),
      watchpoints: state.watchpoints,
      accepted: state.accepted,
      layers_complete: doneCount(state),
      status: deriveStatus(state),
    })
    .eq('id', id)

  // Perspectives.
  await supabase.from('house_perspectives').delete().eq('house_id', id)
  if (state.perspectives.length > 0) {
    await supabase.from('house_perspectives').insert(
      state.perspectives.map((p, i) => ({
        house_id: id,
        name: p.name,
        summary: p.summary,
        questions: p.subQuestions.length,
        stance: p.stance,
        sub_questions: p.subQuestions,
        supporting_evidence: p.supportingEvidence,
        counters: p.counters,
        strength: p.strength,
        owner_key: p.owner,
        position: i,
      }))
    )
  }

  // Evidence.
  await supabase.from('house_evidence').delete().eq('house_id', id)
  if (state.evidence.length > 0) {
    await supabase.from('house_evidence').insert(
      state.evidence.map((e, i) => ({
        house_id: id,
        text: e.text,
        source: e.source,
        owner_key: e.owner,
        by_ai: e.byAI,
        position: i,
      }))
    )
  }

  // Assumptions.
  await supabase.from('house_assumptions').delete().eq('house_id', id)
  if (state.assumptions.length > 0) {
    await supabase.from('house_assumptions').insert(
      state.assumptions.map((a, i) => ({
        house_id: id,
        text: a.text,
        owner_key: a.owner,
        position: i,
      }))
    )
  }

  // Implications: three reducer lists collapse into one table via `kind`,
  // positioned per kind so each list round-trips in order.
  await supabase.from('house_implications').delete().eq('house_id', id)
  const implications = [
    ...state.pos.map((x, i) => ({ kind: 'pos', text: x.text, horizon: x.horizon, who: x.who, position: i })),
    ...state.neg.map((x, i) => ({ kind: 'neg', text: x.text, horizon: x.horizon, who: x.who, position: i })),
    ...state.unc.map((x, i) => ({ kind: 'unc', text: x.text, horizon: x.horizon, who: x.who, position: i })),
  ]
  if (implications.length > 0) {
    await supabase
      .from('house_implications')
      .insert(implications.map((r) => ({ house_id: id, ...r })))
  }
}
