// State model for the Build a House flow. See handoff 03-STATE-MODEL.md §1.

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

export interface Perspective {
  id: number
  name: string
  summary: string
  questions: number
  strength: number
  owner: PersonKey
}

export interface Evidence {
  id: number
  text: string
  source: string
  owner: PersonKey
  byAI: boolean
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

export interface State {
  step: number
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
  accepted: Record<number, number[]>
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
  | { type: 'ADD_CONCEPT' }
  | { type: 'EDIT_CONCEPT'; idx: number; field: 'term' | 'definition'; value: string }
  | { type: 'REMOVE_CONCEPT'; idx: number }
  | { type: 'ADD_PERSPECTIVE' }
  | { type: 'EDIT_PERSPECTIVE'; id: number; field: 'name' | 'summary'; value: string }
  | { type: 'REMOVE_PERSPECTIVE'; id: number }
  | { type: 'OPEN_PERSPECTIVE'; id: number }
  | { type: 'CLOSE_PERSPECTIVE' }
  | { type: 'CYCLE_OWNER'; id: number }
  | { type: 'ADD_EVIDENCE' }
  | { type: 'EDIT_EVIDENCE'; id: number; field: 'text' | 'source'; value: string }
  | { type: 'REMOVE_EVIDENCE'; id: number }
  | { type: 'RESEARCH_MODE' }
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
  | { type: 'ACCEPT_SUGGESTION'; step: number; idx: number }
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
