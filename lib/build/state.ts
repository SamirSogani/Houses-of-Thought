// Initial seed (03 §2) + reducer for every action (03 §8, 04-INTERACTIONS.md).
// Toast auto-dismiss timing lives in the view; the reducer only sets the string.

import type { Action, ImplicationKind, PersonKey, Perspective, State } from './types'
import { people, ownerCycle } from './people'
import { layerKey, framePurpose, frameQuestion, conclusionBullets, reasoningSummary, perspectiveDetails } from './content'

// Seed the demo house's perspectives with their rich detail (stance, sub-questions,
// supporting evidence, counterarguments) from content.ts, so initialState carries
// the same editable detail a user would build by hand.
const perspectiveSeed: { id: number; name: string; summary: string; strength: number; owner: PersonKey }[] = [
  { id: 1, name: 'Students', summary: 'Benefit most when AI tutors rather than answers.', strength: 78, owner: 'maya' },
  { id: 2, name: 'Teachers', summary: 'Gain prep leverage but face new oversight duties.', strength: 64, owner: 'maya' },
  { id: 3, name: 'Parents', summary: 'Supportive when given transparency and opt-outs.', strength: 55, owner: 'devan' },
  { id: 4, name: 'Society', summary: 'Benefits are real but unevenly distributed today.', strength: 60, owner: 'devan' },
  { id: 5, name: 'Employers', summary: 'Value AI-fluent graduates, reshaping entry roles.', strength: 72, owner: 'you' },
  { id: 6, name: 'Administrators', summary: 'Balance cost, liability, and measurable outcomes.', strength: 58, owner: 'you' },
]

const seededPerspectives: Perspective[] = perspectiveSeed.map((p) => {
  const d = perspectiveDetails[p.id]
  return {
    ...p,
    stance: d.stance,
    subQuestions: d.questions,
    supportingEvidence: d.evidence,
    counters: d.counters,
  }
})
import { suggestions } from './suggestions'
import { applyAiAction } from './aiActions'
import { computeStrength } from './strength'

export const initialState: State = {
  step: 1,
  title: 'Should AI be used in schools?',
  purpose: framePurpose,
  question: frameQuestion,
  conclusion: conclusionBullets.join('\n\n'),
  reasoning: reasoningSummary,
  rightTab: 'copilot',
  inviteOpen: false,
  inviteInput: '',
  copied: false,
  notesOpen: false,
  toast: '',

  concepts: [
    { term: 'Academic integrity', definition: '' },
    { term: 'Equity', definition: '' },
    { term: 'Supervision', definition: '' },
    { term: 'Data privacy', definition: '' },
  ],

  perspectives: seededPerspectives,

  evidence: [
    { id: 1, text: 'Global K-12 AI-in-education market projected to reach $32B by 2027.', source: 'HolonIQ Global Education Outlook (2025)', owner: 'devan', byAI: false },
    { id: 2, text: 'Average effect size of AI tutoring on learning outcomes: d = 0.34 (moderate).', source: 'Stanford GSE Meta-Analysis (2024)', owner: 'maya', byAI: false },
    { id: 3, text: '76% of OECD countries now have a national AI-in-schools policy or draft framework.', source: 'OECD Education Digest (2025)', owner: 'you', byAI: false },
  ],

  assumptions: [
    { id: 1, text: 'AI systems are accurate enough for educational use under teacher supervision.', owner: 'you' },
    { id: 2, text: 'Technology adoption in schools will continue to expand over the next decade.', owner: 'devan' },
    { id: 3, text: 'Districts can fund ongoing teacher training, not just one-time rollouts.', owner: 'maya' },
    { id: 4, text: 'Student-data privacy frameworks will mature alongside the technology.', owner: 'you' },
  ],

  pos: [
    { id: 1, text: 'Personalized tutoring at scale, especially for students with disabilities and ELLs', horizon: 'Near-term', who: 'Students' },
    { id: 2, text: 'Meaningful reduction in teacher prep and feedback time', horizon: 'Near-term', who: 'Teachers' },
    { id: 3, text: 'Stronger workforce readiness for AI-fluent roles', horizon: 'Long-term', who: 'Society' },
  ],
  neg: [
    { id: 1, text: 'Erosion of independent writing and reasoning if unsupervised', horizon: 'Long-term', who: 'Students' },
    { id: 2, text: 'Widening divide between high- and low-funding districts', horizon: 'Long-term', who: 'Society' },
    { id: 3, text: 'Compliance and liability exposure under student-privacy laws', horizon: 'Near-term', who: 'Districts' },
  ],
  unc: [
    { id: 1, text: 'Long-term impact on critical-thinking habits beyond a 1-2 year horizon', horizon: 'Long-term', who: 'Students' },
    { id: 2, text: 'Whether free AI tools will close or widen the access gap', horizon: 'Long-term', who: 'Society' },
  ],

  watchpoints: [
    'Unsupervised assessment use rising faster than teacher training can keep pace.',
    'Vendor pricing climbing sharply once districts are locked in.',
    'Early evidence that heavy AI reliance dampens independent problem-solving.',
  ],

  accepted: {},
  activePerspective: null,
}

function nextId(items: { id: number }[]): number {
  return items.reduce((max, i) => Math.max(max, i.id), 0) + 1
}

// Replace the perspective with id `pid` by applying `fn`. Keeps the detail-edit
// cases below terse.
function mapPerspective(state: State, pid: number, fn: (p: Perspective) => Perspective): State {
  return { ...state, perspectives: state.perspectives.map((p) => (p.id === pid ? fn(p) : p)) }
}

const implicationHorizon: Record<ImplicationKind, 'Near-term' | 'Long-term'> = {
  pos: 'Near-term',
  neg: 'Near-term',
  unc: 'Long-term',
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'GO_STEP':
      return { ...state, step: Math.max(1, Math.min(7, action.n)), activePerspective: null }

    case 'SET_TITLE':
      return { ...state, title: action.value }

    case 'SET_PURPOSE':
      return { ...state, purpose: action.value }

    case 'SET_QUESTION':
      return { ...state, question: action.value }

    case 'SET_CONCLUSION':
      return { ...state, conclusion: action.value }

    case 'SET_REASONING':
      return { ...state, reasoning: action.value }

    case 'SET_TAB':
      return { ...state, rightTab: action.tab }

    case 'ADD_CONCEPT':
      return { ...state, concepts: [...state.concepts, { term: '', definition: '' }] }

    case 'EDIT_CONCEPT':
      return {
        ...state,
        concepts: state.concepts.map((c, i) =>
          i === action.idx ? { ...c, [action.field]: action.value } : c
        ),
      }

    case 'REMOVE_CONCEPT':
      return { ...state, concepts: state.concepts.filter((_, i) => i !== action.idx) }

    case 'ADD_PERSPECTIVE':
      return {
        ...state,
        perspectives: [
          ...state.perspectives,
          {
            id: nextId(state.perspectives),
            name: '',
            summary: '',
            stance: '',
            subQuestions: [],
            supportingEvidence: [],
            counters: [],
            strength: 0,
            owner: 'you',
          },
        ],
        toast: 'Perspective added',
      }

    case 'EDIT_PERSPECTIVE':
      return {
        ...state,
        perspectives: state.perspectives.map((p) =>
          p.id === action.id ? { ...p, [action.field]: action.value } : p
        ),
      }

    case 'REMOVE_PERSPECTIVE':
      return {
        ...state,
        perspectives: state.perspectives.filter((p) => p.id !== action.id),
        activePerspective: state.activePerspective === action.id ? null : state.activePerspective,
      }

    case 'ADD_SUBQUESTION':
      return mapPerspective(state, action.pid, (p) => ({ ...p, subQuestions: [...p.subQuestions, { q: '', note: '' }] }))

    case 'EDIT_SUBQUESTION':
      return mapPerspective(state, action.pid, (p) => ({
        ...p,
        subQuestions: p.subQuestions.map((sq, i) => (i === action.idx ? { ...sq, [action.field]: action.value } : sq)),
      }))

    case 'REMOVE_SUBQUESTION':
      return mapPerspective(state, action.pid, (p) => ({ ...p, subQuestions: p.subQuestions.filter((_, i) => i !== action.idx) }))

    case 'ADD_PERSPECTIVE_EVIDENCE':
      return mapPerspective(state, action.pid, (p) => ({ ...p, supportingEvidence: [...p.supportingEvidence, { text: '', source: '' }] }))

    case 'EDIT_PERSPECTIVE_EVIDENCE':
      return mapPerspective(state, action.pid, (p) => ({
        ...p,
        supportingEvidence: p.supportingEvidence.map((e, i) => (i === action.idx ? { ...e, [action.field]: action.value } : e)),
      }))

    case 'REMOVE_PERSPECTIVE_EVIDENCE':
      return mapPerspective(state, action.pid, (p) => ({ ...p, supportingEvidence: p.supportingEvidence.filter((_, i) => i !== action.idx) }))

    case 'ADD_COUNTER':
      return mapPerspective(state, action.pid, (p) => ({ ...p, counters: [...p.counters, ''] }))

    case 'EDIT_COUNTER':
      return mapPerspective(state, action.pid, (p) => ({ ...p, counters: p.counters.map((c, i) => (i === action.idx ? action.value : c)) }))

    case 'REMOVE_COUNTER':
      return mapPerspective(state, action.pid, (p) => ({ ...p, counters: p.counters.filter((_, i) => i !== action.idx) }))

    case 'OPEN_PERSPECTIVE':
      return { ...state, activePerspective: action.id }

    case 'CLOSE_PERSPECTIVE':
      return { ...state, activePerspective: null }

    case 'CYCLE_OWNER': {
      let name = ''
      const perspectives = state.perspectives.map((p) => {
        if (p.id !== action.id) return p
        const idx = ownerCycle.indexOf(p.owner)
        const owner = ownerCycle[(idx + 1) % ownerCycle.length]
        name = people[owner].name
        return { ...p, owner }
      })
      const p = state.perspectives.find((x) => x.id === action.id)
      return { ...state, perspectives, toast: `${name} now owns ${p?.name ?? ''}` }
    }

    case 'ADD_EVIDENCE':
      return {
        ...state,
        evidence: [
          ...state.evidence,
          {
            id: nextId(state.evidence),
            text: '',
            source: '',
            owner: 'you',
            byAI: false,
          },
        ],
        toast: 'Evidence added',
      }

    case 'EDIT_EVIDENCE':
      return {
        ...state,
        evidence: state.evidence.map((e) =>
          e.id === action.id ? { ...e, [action.field]: action.value } : e
        ),
      }

    case 'REMOVE_EVIDENCE':
      return { ...state, evidence: state.evidence.filter((e) => e.id !== action.id) }

    case 'RESEARCH_MODE':
      return {
        ...state,
        evidence: [
          ...state.evidence,
          {
            id: nextId(state.evidence),
            text: 'Districts using supervised AI tutoring reported a 12% average gain in formative scores.',
            source: 'EdWeek Research Center (2025)',
            owner: 'ai',
            byAI: true,
          },
        ],
        toast: 'Research Mode found a cited source',
      }

    case 'ADD_ASSUMPTION':
      return {
        ...state,
        assumptions: [
          ...state.assumptions,
          {
            id: nextId(state.assumptions),
            text: '',
            owner: 'you',
          },
        ],
        toast: 'Assumption added',
      }

    case 'EDIT_ASSUMPTION':
      return {
        ...state,
        assumptions: state.assumptions.map((a) =>
          a.id === action.id ? { ...a, text: action.value } : a
        ),
      }

    case 'REMOVE_ASSUMPTION':
      return { ...state, assumptions: state.assumptions.filter((a) => a.id !== action.id) }

    case 'ADD_IMPLICATION': {
      const { kind } = action
      const list = state[kind]
      const item = { id: nextId(list), text: '', horizon: implicationHorizon[kind], who: '' }
      return { ...state, [kind]: [...list, item] }
    }

    case 'EDIT_IMPLICATION': {
      const { kind, id, field, value } = action
      return {
        ...state,
        [kind]: state[kind].map((it) => (it.id === id ? { ...it, [field]: value } : it)),
      }
    }

    case 'TOGGLE_IMPLICATION_HORIZON': {
      const { kind, id } = action
      return {
        ...state,
        [kind]: state[kind].map((it) =>
          it.id === id
            ? { ...it, horizon: it.horizon === 'Near-term' ? 'Long-term' : 'Near-term' }
            : it
        ),
      }
    }

    case 'REMOVE_IMPLICATION': {
      const { kind, id } = action
      return { ...state, [kind]: state[kind].filter((it) => it.id !== id) }
    }

    case 'ADD_WATCHPOINT':
      return { ...state, watchpoints: [...state.watchpoints, ''] }

    case 'EDIT_WATCHPOINT':
      return {
        ...state,
        watchpoints: state.watchpoints.map((w, i) => (i === action.idx ? action.value : w)),
      }

    case 'REMOVE_WATCHPOINT':
      return { ...state, watchpoints: state.watchpoints.filter((_, i) => i !== action.idx) }

    case 'ACCEPT_SUGGESTION': {
      const bank = suggestions[action.step] ?? []
      const suggestion = bank[action.idx]
      if (!suggestion) return state
      const draft: State = { ...state }
      suggestion.run(draft)
      const priorAccepted = state.accepted[action.step] ?? []
      draft.accepted = { ...state.accepted, [action.step]: [...priorAccepted, action.idx] }
      draft.toast = `Added to ${layerKey(action.step)}`
      return draft
    }

    case 'APPLY_AI_ACTION': {
      const draft: State = { ...state }
      const toast = applyAiAction(draft, action.action)
      if (toast === null) return state
      draft.toast = toast
      return draft
    }

    case 'OPEN_INVITE':
      return { ...state, inviteOpen: true, inviteInput: '', copied: false }

    case 'CLOSE_INVITE':
      return { ...state, inviteOpen: false }

    case 'SET_INVITE_INPUT':
      return { ...state, inviteInput: action.value }

    case 'SEND_INVITE': {
      const name = state.inviteInput.trim()
      return {
        ...state,
        inviteOpen: false,
        toast: name ? `Invite sent to ${name}` : 'Invite sent',
      }
    }

    case 'COPY_LINK':
      return { ...state, copied: true, toast: 'Invite link copied' }

    case 'OPEN_NOTES':
      return { ...state, notesOpen: true }

    case 'CLOSE_NOTES':
      return { ...state, notesOpen: false }

    case 'PUBLISH':
      return { ...state, toast: `House published · strength ${computeStrength(state).overall}` }

    case 'EXPORT':
      return { ...state, toast: 'Exported as PDF' }

    case 'SET_TOAST':
      return { ...state, toast: action.value }

    default:
      return state
  }
}
