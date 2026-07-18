// State model for the Build a House flow. See handoff 03-STATE-MODEL.md §1.

import type { AiAction } from '@/lib/ai/findings'
import type { DraftStage, DraftState } from '@/lib/ai/draft'

export type PersonKey = 'you' | 'maya' | 'devan' | 'ai'

export interface Person {
  key: PersonKey
  initials: string
  name: string
  role: string
  bg: string
  fg: string
}

export interface Concept {
  term: string
  definition: string
}

export interface SubQuestion {
  q: string
  note: string
}

export interface SupportingEvidence {
  text: string
  source: string
}

export interface Perspective {
  id: number
  name: string
  summary: string
  stance: string
  subQuestions: SubQuestion[]
  supportingEvidence: SupportingEvidence[]
  counters: string[]
  strength: number
  owner: PersonKey
}

export interface Evidence {
  id: number
  text: string
  source: string
  owner: PersonKey
  byAI: boolean
  // Real citation link, set by Research Mode (doc 06). Optional so pre-0010
  // evidence still loads.
  url?: string
}

export interface Assumption {
  id: number
  text: string
  owner: PersonKey
}

export type Horizon = 'Near-term' | 'Long-term'

export interface Implication {
  id: number
  text: string
  horizon: Horizon
  who: string
}

export type RightTab = 'copilot' | 'team'

// How much help the co-pilot gives (decision 007). Learn = Socratic questions
// only; Decide = concrete suggestions with Add. Persistable; default 'decide'.
export type AiMode = 'learn' | 'decide'

// Per-house AI context distilled by the interviewer (doc 05). Persistable.
export interface AiContext {
  summary: string
  facts: string[]
}

export interface State {
  step: number
  // Co-pilot posture (persistable). aiContext is written by the interviewer.
  mode: AiMode
  aiContext: AiContext | null
  // Draft Mode progress + per-layer claim map (decision 016). Persistable;
  // null on every house the AI did not draft.
  draft: DraftState | null
  title: string
  // Frame layer, user-editable prose (start empty).
  purpose: string
  question: string
  // Conclusion layer, user-editable prose (start empty).
  conclusion: string
  reasoning: string
  rightTab: RightTab
  inviteOpen: boolean
  inviteInput: string
  copied: boolean
  notesOpen: boolean
  toast: string
  concepts: Concept[]
  perspectives: Perspective[]
  evidence: Evidence[]
  assumptions: Assumption[]
  pos: Implication[]
  neg: Implication[]
  unc: Implication[]
  watchpoints: string[]
  activePerspective: number | null
}

export type ImplicationKind = 'pos' | 'neg' | 'unc'

export type Action =
  | { type: 'GO_STEP'; n: number }
  | { type: 'SET_TITLE'; value: string }
  | { type: 'SET_PURPOSE'; value: string }
  | { type: 'SET_QUESTION'; value: string }
  | { type: 'SET_CONCLUSION'; value: string }
  | { type: 'SET_REASONING'; value: string }
  | { type: 'SET_TAB'; tab: RightTab }
  | { type: 'SET_MODE'; mode: AiMode }
  | { type: 'SET_AI_CONTEXT'; context: AiContext | null }
  | { type: 'ADD_CONCEPT' }
  | { type: 'EDIT_CONCEPT'; idx: number; field: 'term' | 'definition'; value: string }
  | { type: 'REMOVE_CONCEPT'; idx: number }
  | { type: 'ADD_PERSPECTIVE' }
  | { type: 'EDIT_PERSPECTIVE'; id: number; field: 'name' | 'summary' | 'stance'; value: string }
  | { type: 'REMOVE_PERSPECTIVE'; id: number }
  | { type: 'ADD_SUBQUESTION'; pid: number }
  | { type: 'EDIT_SUBQUESTION'; pid: number; idx: number; field: 'q' | 'note'; value: string }
  | { type: 'REMOVE_SUBQUESTION'; pid: number; idx: number }
  | { type: 'ADD_PERSPECTIVE_EVIDENCE'; pid: number }
  | { type: 'EDIT_PERSPECTIVE_EVIDENCE'; pid: number; idx: number; field: 'text' | 'source'; value: string }
  | { type: 'REMOVE_PERSPECTIVE_EVIDENCE'; pid: number; idx: number }
  | { type: 'ADD_COUNTER'; pid: number }
  | { type: 'EDIT_COUNTER'; pid: number; idx: number; value: string }
  | { type: 'REMOVE_COUNTER'; pid: number; idx: number }
  | { type: 'OPEN_PERSPECTIVE'; id: number }
  | { type: 'CLOSE_PERSPECTIVE' }
  | { type: 'CYCLE_OWNER'; id: number }
  | { type: 'ADD_EVIDENCE' }
  | { type: 'EDIT_EVIDENCE'; id: number; field: 'text' | 'source'; value: string }
  | { type: 'REMOVE_EVIDENCE'; id: number }
  | { type: 'ADD_ASSUMPTION' }
  | { type: 'EDIT_ASSUMPTION'; id: number; value: string }
  | { type: 'REMOVE_ASSUMPTION'; id: number }
  | { type: 'ADD_IMPLICATION'; kind: ImplicationKind }
  | { type: 'EDIT_IMPLICATION'; kind: ImplicationKind; id: number; field: 'text' | 'who'; value: string }
  | { type: 'TOGGLE_IMPLICATION_HORIZON'; kind: ImplicationKind; id: number }
  | { type: 'REMOVE_IMPLICATION'; kind: ImplicationKind; id: number }
  | { type: 'ADD_WATCHPOINT' }
  | { type: 'EDIT_WATCHPOINT'; idx: number; value: string }
  | { type: 'REMOVE_WATCHPOINT'; idx: number }
  | { type: 'APPLY_AI_ACTION'; action: AiAction }
  // Undo: replace the persistable content subset wholesale from a snapshot
  // (BuildHousePage keeps a bounded history of serializeContent strings).
  // View state (step, tabs, toast) is deliberately untouched.
  | { type: 'RESTORE_CONTENT'; content: import('./persistence').PersistedContent }
  // Draft Mode (decision 016). START seeds State.draft; APPLY_DRAFT_STAGE bulk-
  // applies one stage's AiActions and advances; STOP finalizes early;
  // CLAIM_DRAFT_LAYER is the deferred per-layer accept.
  | { type: 'START_DRAFT' }
  | { type: 'APPLY_DRAFT_STAGE'; stage: DraftStage; actions: AiAction[] }
  | { type: 'STOP_DRAFT' }
  | { type: 'CLAIM_DRAFT_LAYER'; stage: DraftStage }
  | { type: 'OPEN_INVITE' }
  | { type: 'CLOSE_INVITE' }
  | { type: 'SET_INVITE_INPUT'; value: string }
  | { type: 'SEND_INVITE' }
  | { type: 'COPY_LINK' }
  | { type: 'OPEN_NOTES' }
  | { type: 'CLOSE_NOTES' }
  | { type: 'PUBLISH' }
  | { type: 'EXPORT' }
  | { type: 'SET_TOAST'; value: string }
