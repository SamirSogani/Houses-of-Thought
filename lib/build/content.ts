// Static copy for the Build a House flow. Verbatim from handoff 02 §1 and 07-COPY-DECK.md.
// No em-dashes in user-facing copy (en-dashes in K-12 / 1-2 / Paul-Elder are intentional).

import type { Perspective } from './types'

export interface LayerMeta {
  step: number
  key: string
  kicker: string
  title: string
  blurb: string
}

// 07 §2. Layer headers (kicker / title / blurb), keyed by step 1-7.
export const layers: LayerMeta[] = [
  {
    step: 1,
    key: 'Frame',
    kicker: 'Concepts & question',
    title: 'Frame the question',
    blurb:
      'Set the purpose, the question worth reasoning about, and the concepts the whole house rests on.',
  },
  {
    step: 2,
    key: 'Perspectives',
    kicker: 'Stakeholders',
    title: 'Build the perspectives',
    blurb:
      'Reason from each stakeholder in turn. Assign perspectives to co-builders so the work divides cleanly.',
  },
  {
    step: 3,
    key: 'Evidence',
    kicker: 'Sourced facts',
    title: 'Ground it in evidence',
    blurb:
      'Add facts with citations. Research Mode finds sources for you, and every claim links back to something checkable.',
  },
  {
    step: 4,
    key: 'Assumptions',
    kicker: 'Foundations',
    title: 'Surface the assumptions',
    blurb:
      'Name what has to be true for the reasoning to hold. Weak footings show up here first.',
  },
  {
    step: 5,
    key: 'Conclusion',
    kicker: 'Where it lands',
    title: 'Draw the conclusion',
    blurb:
      'State the central conclusion and the reasoning that carries the perspectives into it.',
  },
  {
    step: 6,
    key: 'Implications',
    kicker: 'Consequences',
    title: 'Trace the implications',
    blurb:
      'Map what follows if the conclusion holds, sorted by how positive, negative, or uncertain each consequence is.',
  },
  {
    step: 7,
    key: 'Review',
    kicker: 'Score & publish',
    title: 'Review house strength',
    blurb:
      'See how the house scores across evidence, logic, and coverage, what is driving each number, and what would raise it.',
  },
]

export const layerKey = (step: number): string => layers[step - 1]?.key ?? ''

// 07 §6.1 Frame prose.
export const framePurpose =
  'Decide whether K-12 schools should adopt AI tools, and under what guardrails, so the reasoning holds up to teachers, parents, and administrators.'
export const frameQuestion = 'Should AI be used in schools?'

// 03 §8 / 04 §3. Concept rotation for "+ Concept", cycled by concepts.length % 4.
export const conceptRotation = ['Teacher agency', 'Assessment validity', 'Access gap', 'Vendor lock-in']

// 07 §6.2 Conclusion prose.
export const conclusionBullets = [
  'AI is a net benefit in schools when strong guardrails exist: teacher supervision, ongoing training, and FERPA-compliant procurement.',
  'Equity safeguards and opt-outs are essential to prevent widening gaps between high- and low-funding districts.',
]
export const reasoningSummary =
  'Across all six perspectives, evidence converges on net benefit when guardrails are present. Where guardrails are absent, risks of dependency, inequity, and privacy breaches grow quickly enough to erase the gains. The conclusion holds most strongly for supervised tutoring use, and weakens for unsupervised assessment.'

// Axis "measures" copy (07 §6.4).
export const axisMeasures = {
  Evidence: 'How well each claim is backed by a cited, checkable source.',
  Logic: 'Whether assumptions are surfaced and the conclusion follows from them.',
  Coverage: 'The range of stakeholder perspectives the house accounts for.',
}

// 07 §3. Per-perspective detail content, keyed by perspective id 1-6.
export interface PerspectiveDetail {
  stance: string
  questions: { q: string; note: string }[]
  evidence: { text: string; source: string }[]
  counters: string[]
}

export const perspectiveDetails: Record<number, PerspectiveDetail> = {
  1: {
    stance:
      'Students benefit most when AI acts as a tutor that explains its steps, not an answer key that finishes the work for them.',
    questions: [
      {
        q: 'Does AI help students learn, or help them avoid learning?',
        note: 'Splits on supervision. Guided, worked-example use raises outcomes; unsupervised use rewards shortcutting.',
      },
      {
        q: 'Who gets left behind when tools cost money?',
        note: 'Access gaps widen unless districts fund equal access, so equity has to be designed in from the start.',
      },
      {
        q: 'How do students with disabilities and ELLs fare?',
        note: 'Strongest-gain group. Scaffolding, read-aloud, and translation lower long-standing barriers.',
      },
    ],
    evidence: [
      {
        text: 'Average effect size of AI tutoring on learning outcomes: d = 0.34 (moderate).',
        source: 'Stanford GSE Meta-Analysis (2024)',
      },
      {
        text: 'Largest measured gains occurred among students with disabilities and English learners.',
        source: 'RAND Education (2024)',
      },
    ],
    counters: [
      'Over-reliance may erode independent writing and problem-solving over a 1-2 year horizon.',
      'Self-reported engagement can mask shallow, test-brittle learning.',
    ],
  },
  2: {
    stance:
      'Teachers gain real prep and feedback leverage, but inherit new assessment-design and oversight responsibilities.',
    questions: [
      {
        q: 'Does AI save teacher time or add oversight burden?',
        note: 'Net time saved on prep and first-draft feedback; time added on verifying authorship and integrity.',
      },
      {
        q: 'Can teachers reliably detect AI-assisted work?',
        note: 'Detection alone is unreliable. Redesigning tasks for process and defense matters more than catching output.',
      },
      {
        q: 'What training does this actually require?',
        note: 'Ongoing professional development, not a one-time rollout, or the tool adds load instead of removing it.',
      },
    ],
    evidence: [
      {
        text: 'Teacher-supervised AI use correlated with a 19% drop in low-level student errors.',
        source: 'RAND Education (2024)',
      },
    ],
    counters: [
      'Without sustained training, tools add workload rather than removing it.',
      'Assessment validity is threatened unless tasks are redesigned around reasoning.',
    ],
  },
  3: {
    stance:
      'Parents are cautiously supportive when given transparency about data use and a low-friction opt-out.',
    questions: [
      {
        q: "What happens to my child's data?",
        note: 'Concern centers on third-party sharing and retention windows, not the tutoring itself.',
      },
      {
        q: 'Can I opt my child out without penalty?',
        note: 'Opt-outs are essential to trust and must not create a second-class classroom experience.',
      },
    ],
    evidence: [
      {
        text: '76% of OECD countries now have a national AI-in-schools policy or draft framework.',
        source: 'OECD Education Digest (2025)',
      },
    ],
    counters: [
      'Opt-outs can quietly create a two-tier classroom.',
      'Transparency promises are hard for a parent to verify in practice.',
    ],
  },
  4: {
    stance:
      'Societal benefits are plausible but, today, distributed unevenly by district funding and geography.',
    questions: [
      {
        q: 'Does AI in schools widen or close gaps?',
        note: 'Either outcome is possible depending on funding equity and procurement terms.',
      },
      {
        q: 'What is the civic risk of AI-shaped learning?',
        note: 'Homogenization of reasoning if every classroom leans on a few converging models.',
      },
    ],
    evidence: [
      {
        text: 'Global K-12 AI-in-education market projected to reach $32B by 2027.',
        source: 'HolonIQ Global Education Outlook (2025)',
      },
    ],
    counters: ['Market growth does not equal equitable access.'],
  },
  5: {
    stance:
      'Employers strongly value AI-fluent graduates and are already re-bundling entry-level roles around oversight.',
    questions: [
      {
        q: 'Which skills do employers actually want?',
        note: 'Judgment, verification, and framing over raw generation.',
      },
      {
        q: 'Are entry-level roles disappearing?',
        note: 'Shifting rather than vanishing. Tasks are re-bundled toward review and quality control.',
      },
    ],
    evidence: [
      {
        text: 'Entry-level task composition is shifting toward oversight and review of AI output.',
        source: 'World Economic Forum Future of Jobs (2025)',
      },
    ],
    counters: ['Employer demand may outpace how fast curricula can change.'],
  },
  6: {
    stance:
      'Administrators face a hard balance of cost, liability, and measurable outcomes on a district budget.',
    questions: [
      {
        q: 'What is the true total cost of ownership?',
        note: 'Licenses plus training plus compliance and support, not the sticker license price.',
      },
      {
        q: 'Who is liable when the AI is wrong?',
        note: 'Unsettled. Procurement contract terms carry most of the real risk allocation.',
      },
    ],
    evidence: [
      {
        text: 'Compliance and procurement complexity flagged as a top adoption barrier.',
        source: 'FTC COPPA Guidance (2025)',
      },
    ],
    counters: ['Measurable outcomes tend to lag adoption by several years.'],
  },
}

// Generic fallback for runtime-added perspectives (03 §6, 07 §3).
export function genericDetail(p: Perspective): PerspectiveDetail {
  return {
    stance:
      p.summary +
      ' Flesh this out with the sub-questions it raises, the evidence behind it, and the objections it has to answer.',
    questions: [
      {
        q: 'What is the core question this group is asking?',
        note: 'Not answered yet. Ask the co-pilot for a starting point.',
      },
    ],
    evidence: [],
    counters: [],
  }
}

export const emptyEvidenceLine =
  'No evidence linked yet. Add it in the Evidence layer or with Research Mode.'
export const emptyCountersLine =
  'No counterarguments captured yet. Strong houses name the best objection to each perspective.'

// 07 §5. What's-new drawer change cards.
export const changeCards: { title: string; old: string; next: string }[] = [
  {
    title: 'A guided build sequence, not a finished scroll',
    old: 'You landed in a fully-populated house and scrolled one long document. No sense of where to start or what was done.',
    next: 'Seven ordered layers, foundation to roof, in a blueprint rail. Each is a focused step with a clear state: done, active, or ahead.',
  },
  {
    title: 'Real human co-builders',
    old: 'Collaboration was you and the AI in one chat. No way to bring people in, divide work, or see who did what.',
    next: 'Invite co-builders, assign perspectives, see live presence, and attribute every item to the person or co-pilot who added it.',
  },
  {
    title: 'A contextual co-pilot, not a firehose chat',
    old: 'One linear chat carried everything, untethered from the part of the house you were working on.',
    next: 'The AI is one teammate on the right rail, suggesting only for the active layer. You accept items into the house on your terms.',
  },
  {
    title: 'House Strength gets its own section',
    old: 'Strength was a static 72 pinned to the bottom of the page, tucked under implications.',
    next: 'A dedicated Review layer explains each score, what is driving it, and what to do next. Evidence, logic, and coverage recompute live as you build.',
  },
  {
    title: 'The house metaphor made literal',
    old: 'The "house" was rendered as a scrolling text document.',
    next: 'The left rail is the house itself, built layer by layer with a roof and foundation, doubling as navigation and progress.',
  },
]
