// DEPRECATED — replaced by the live co-pilot (plans/active/ai). Kept for the
// ACCEPT_SUGGESTION/accepted plumbing; do not extend.
//
// Co-pilot suggestion bank, per layer. Verbatim from handoff 07-COPY-DECK.md §4.
// Each suggestion's run() mutates a draft State in place (the reducer clones first).

import type { State } from './types'

export interface Suggestion {
  text: string
  tag: string
  run: (draft: State) => void
}

function nextId(items: { id: number }[]): number {
  return items.reduce((max, i) => Math.max(max, i.id), 0) + 1
}

export const suggestions: Record<number, Suggestion[]> = {
  1: [
    {
      text: 'Add "Cost of inaction" as a concept: what happens if schools opt out entirely?',
      tag: 'Concept',
      run: (d) => {
        d.concepts = [...d.concepts, { term: 'Cost of inaction', definition: '' }]
      },
    },
    {
      text: 'Sharpen the question with a scope: which grade bands and which uses?',
      tag: 'Framing',
      run: () => {},
    },
  ],
  2: [
    {
      text: 'You are missing the "IT & Security staff" perspective, who own rollout risk.',
      tag: 'Perspective',
      run: (d) => {
        d.perspectives = [
          ...d.perspectives,
          {
            id: nextId(d.perspectives),
            name: 'IT & Security',
            summary: 'Own rollout, access control, and breach risk day to day.',
            stance: '',
            subQuestions: [],
            supportingEvidence: [],
            counters: [],
            strength: 40,
            owner: 'you',
          },
        ]
      },
    },
    {
      text: 'Add "EdTech vendors" to capture the supply-side incentives shaping adoption.',
      tag: 'Perspective',
      run: (d) => {
        d.perspectives = [
          ...d.perspectives,
          {
            id: nextId(d.perspectives),
            name: 'EdTech Vendors',
            summary: 'Shape adoption through pricing and lock-in incentives.',
            stance: '',
            subQuestions: [],
            supportingEvidence: [],
            counters: [],
            strength: 38,
            owner: 'you',
          },
        ]
      },
    },
  ],
  3: [
    {
      text: 'RAND 2024: teacher-supervised AI use correlated with a 19% drop in low-level errors.',
      tag: 'Evidence',
      run: (d) => {
        d.evidence = [
          ...d.evidence,
          {
            id: nextId(d.evidence),
            text: 'Teacher-supervised AI use correlated with a 19% drop in low-level errors.',
            source: 'RAND Education (2024)',
            owner: 'ai',
            byAI: true,
          },
        ]
      },
    },
    {
      text: 'FTC 2025 guidance flags unsupervised student-data collection as a compliance risk.',
      tag: 'Evidence',
      run: (d) => {
        d.evidence = [
          ...d.evidence,
          {
            id: nextId(d.evidence),
            text: 'Unsupervised student-data collection flagged as a compliance risk.',
            source: 'FTC COPPA Guidance (2025)',
            owner: 'ai',
            byAI: true,
          },
        ]
      },
    },
  ],
  4: [
    {
      text: 'Assumption to test: teachers will actually change practice, not just add a tool.',
      tag: 'Assumption',
      run: (d) => {
        d.assumptions = [
          ...d.assumptions,
          {
            id: nextId(d.assumptions),
            text: 'Teachers will change their practice, not just layer AI on top of it.',
            owner: 'ai',
          },
        ]
      },
    },
    {
      text: 'Assumption: vendor pricing stays affordable after initial adoption.',
      tag: 'Assumption',
      run: (d) => {
        d.assumptions = [
          ...d.assumptions,
          {
            id: nextId(d.assumptions),
            text: 'Vendor pricing stays affordable after districts are locked in.',
            owner: 'ai',
          },
        ]
      },
    },
  ],
  5: [
    {
      text: 'Stress-test: does the conclusion still hold for unsupervised assessment use?',
      tag: 'Stress test',
      run: () => {},
    },
    {
      text: 'Name the strongest counter-argument so the conclusion earns its confidence.',
      tag: 'Rigor',
      run: () => {},
    },
  ],
  6: [
    {
      text: 'Add a positive implication: frees teacher time for higher-order instruction.',
      tag: 'Positive',
      run: (d) => {
        d.pos = [
          ...d.pos,
          {
            id: nextId(d.pos),
            text: 'Frees teacher time for higher-order, relational instruction',
            horizon: 'Near-term',
            who: 'Teachers',
          },
        ]
      },
    },
    {
      text: 'Flag an uncertain implication about long-term dependency effects.',
      tag: 'Uncertain',
      run: (d) => {
        d.unc = [
          ...d.unc,
          {
            id: nextId(d.unc),
            text: 'Whether early AI reliance dampens later independent problem-solving',
            horizon: 'Long-term',
            who: 'Students',
          },
        ]
      },
    },
  ],
  7: [
    {
      text: 'Add a cited source to move Evidence toward Strong.',
      tag: 'Evidence',
      run: (d) => {
        d.evidence = [
          ...d.evidence,
          {
            id: nextId(d.evidence),
            text: 'Supervised AI tutoring linked to a 12% average gain in formative scores.',
            source: 'EdWeek Research Center (2025)',
            owner: 'ai',
            byAI: true,
          },
        ]
      },
    },
    {
      text: 'Add the IT & Security perspective to lift Coverage.',
      tag: 'Coverage',
      run: (d) => {
        d.perspectives = [
          ...d.perspectives,
          {
            id: nextId(d.perspectives),
            name: 'IT & Security',
            summary: 'Own rollout, access control, and breach risk day to day.',
            stance: '',
            subQuestions: [],
            supportingEvidence: [],
            counters: [],
            strength: 40,
            owner: 'you',
          },
        ]
      },
    },
  ],
}
