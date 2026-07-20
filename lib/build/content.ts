// Static copy for the Build a House flow. Verbatim from handoff 02 §1 and 07-COPY-DECK.md.
// No em-dashes in user-facing copy (en-dashes in K-12 / 1-2 / Paul-Elder are intentional).

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
  evidence: { text: string; source: string; url?: string }[]
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
        text: 'Intelligent tutoring systems raised test scores by a median of 0.66 standard deviations across 50 controlled evaluations.',
        source: 'Kulik & Fletcher, Review of Educational Research (2016)',
        url: 'https://journals.sagepub.com/doi/10.3102/0034654315581420',
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
        text: '25 percent of U.S. K-12 teachers used AI tools for instructional planning or teaching in the 2023-24 school year.',
        source: 'RAND, Uneven Adoption of AI Tools (2025)',
        url: 'https://www.rand.org/pubs/research_reports/RRA134-25.html',
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
        text: "The FTC's 2025 COPPA Rule amendments require separate parental consent before children's data can be used for targeted advertising or shared with third parties.",
        source: 'FTC COPPA Rule amendments (2025)',
        url: 'https://www.ftc.gov/news-events/news/press-releases/2025/01/ftc-finalizes-changes-childrens-privacy-rule-limiting-companies-ability-monetize-kids-data',
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
        text: 'Fewer than 10 percent of schools and universities surveyed worldwide have formal guidance on using generative AI.',
        source: 'UNESCO global survey (2023)',
        url: 'https://www.unesco.org/en/articles/unesco-survey-less-10-schools-and-universities-have-formal-guidance-ai',
      },
    ],
    counters: ['A policy vacuum tends to hit low-resource districts hardest.'],
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
        source: 'World Economic Forum, Future of Jobs Report (2025)',
        url: 'https://www.weforum.org/publications/the-future-of-jobs-report-2025/',
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
        text: "Districts must meet the updated COPPA Rule's consent, retention, and security obligations by April 2026, adding real compliance lift to procurement.",
        source: 'FTC COPPA Rule amendments (2025)',
        url: 'https://www.ftc.gov/news-events/news/press-releases/2025/01/ftc-finalizes-changes-childrens-privacy-rule-limiting-companies-ability-monetize-kids-data',
      },
    ],
    counters: ['Measurable outcomes tend to lag adoption by several years.'],
  },
}

