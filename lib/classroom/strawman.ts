// Strawman content shape (from /api/ai/strawman) + its mapping into a house
// State. Used by the teacher's authoring flow (components/classroom/StrawmanAuthor)
// to persist the generated argument via saveHouse. Kept out of the components so
// the mapping is easy to reuse/test.

import { blankState } from '@/lib/build/persistence'
import type { State } from '@/lib/build/types'

export interface StrawmanContent {
  title?: string
  conclusion?: string
  reasoning?: string
  perspectives?: { name: string; summary: string; stance: string }[]
  evidence?: { text: string; source: string }[]
  assumptions?: string[]
}

// Map an AI strawman payload into a house State, attributed to the AI ('ai' owner
// / byAI) and pinned to Learn. saveHouse then persists it into the flagged
// strawman house that students will attack.
export function strawmanToState(question: string, c: StrawmanContent): State {
  const s = blankState()
  s.mode = 'learn'
  s.title = c.title || 'AI Strawman'
  s.question = question
  s.conclusion = c.conclusion ?? ''
  s.reasoning = c.reasoning ?? ''
  s.perspectives = (c.perspectives ?? []).map((p, i) => ({
    id: i + 1,
    name: p.name,
    summary: p.summary ?? '',
    stance: p.stance ?? '',
    subQuestions: [],
    supportingEvidence: [],
    counters: [],
    strength: 0,
    owner: 'ai',
  }))
  s.evidence = (c.evidence ?? []).map((e, i) => ({ id: i + 1, text: e.text, source: e.source ?? '', owner: 'ai', byAI: true }))
  s.assumptions = (c.assumptions ?? []).map((a, i) => ({ id: i + 1, text: a, owner: 'ai' }))
  return s
}
