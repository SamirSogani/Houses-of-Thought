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
  rightTab: RightTab
  inviteOpen: boolean
  inviteInput: string
  copied: boolean
  notesOpen: boolean
  toast: string
  concepts: string[]
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
  | { type: 'SET_TAB'; tab: RightTab }
  | { type: 'ADD_CONCEPT' }
  | { type: 'ADD_PERSPECTIVE' }
  | { type: 'OPEN_PERSPECTIVE'; id: number }
  | { type: 'CLOSE_PERSPECTIVE' }
  | { type: 'CYCLE_OWNER'; id: number }
  | { type: 'ADD_EVIDENCE' }
  | { type: 'RESEARCH_MODE' }
  | { type: 'ADD_ASSUMPTION' }
  | { type: 'ADD_IMPLICATION'; kind: ImplicationKind }
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
