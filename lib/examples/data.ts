// Static fixtures for the pre-login Examples pages (/examples, /examples/[slug]).
// These are curated, finished Houses of Thought shown as proof to visitors, with
// no auth and no DB. Content reuses the Build reducer's State shape (lib/build/
// types.ts) so the real strength model and layer render just work.
//
// The "Should AI be used in schools?" house is the canonical demo: its structured
// content is the Build seed (lib/build/state.ts) and its prose (purpose, per-
// perspective detail, conclusion, reasoning) is the stored copy in
// lib/build/content.ts. It is rendered verbatim, not re-authored.

import type { PersonKey, State } from '@/lib/build/types'
import { blankState } from '@/lib/build/persistence'
import { initialState } from '@/lib/build/state'
import {
  framePurpose,
  perspectiveDetails,
  conclusionBullets,
  reasoningSummary,
  type PerspectiveDetail,
} from '@/lib/build/content'

export type ExampleDomain = 'Decisions' | 'Debate' | 'Classroom' | 'Ethics' | 'Policy'

// Domain filter order for the gallery chips (kept at five categories).
export const exampleDomains: ExampleDomain[] = [
  'Decisions',
  'Debate',
  'Classroom',
  'Ethics',
  'Policy',
]

export interface ExampleHouse {
  slug: string
  domain: ExampleDomain
  summary: string // one-line card description
  purpose: string // Frame layer: the purpose statement
  house: State // structured content; drives strength + the layer render
  conclusion: string[] // Conclusion layer: central conclusion bullets
  reasoning: string // Conclusion layer: reasoning summary
  // Per-perspective drill-in detail, keyed by perspective id. Present only for
  // the canonical demo house; other houses render at the perspective-card level.
  detail?: Record<number, PerspectiveDetail>
}

// Perspectives here are authored at the card level (no drill-in detail), so the
// detail fields normalize to empty. `questions` in the source data is ignored.
type SeedPerspective = { id: number; name: string; summary: string; questions?: number; strength: number; owner: PersonKey }

// Fill the ephemeral/default State fields, override only real content. Concepts
// are authored as plain term strings and normalized to { term, definition }.
function mkHouse({
  concepts,
  perspectives,
  ...content
}: Omit<Partial<State>, 'concepts' | 'perspectives'> & { concepts?: string[]; perspectives?: SeedPerspective[] }): State {
  return {
    ...blankState(),
    ...content,
    concepts: (concepts ?? []).map((term) => ({ term, definition: '' })),
    perspectives: (perspectives ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      summary: p.summary,
      stance: '',
      subQuestions: [],
      supportingEvidence: [],
      counters: [],
      strength: p.strength,
      owner: p.owner,
    })),
  }
}

export const examples: ExampleHouse[] = [
  {
    slug: 'should-ai-be-used-in-schools',
    domain: 'Classroom',
    summary:
      'A net benefit for schools when teacher supervision, ongoing training, and privacy safeguards are in place.',
    purpose: framePurpose,
    house: initialState,
    detail: perspectiveDetails,
    conclusion: conclusionBullets,
    reasoning: reasoningSummary,
  },
  {
    slug: 'should-salary-caps-exist-in-pro-sports',
    domain: 'Debate',
    summary:
      'Defensible when paired with revenue sharing, though the cap alone balances less than fans assume.',
    purpose:
      'Decide whether professional leagues should impose a salary cap, and on what terms, so the case holds up to players, owners, and fans.',
    conclusion: [
      'A salary cap is worth adopting when it runs alongside revenue sharing, so small-market teams stay viable and title races stay open.',
      'The case should be made honestly, because capped and uncapped leagues both produce a wide field of champions.',
    ],
    reasoning:
      'Championship records in capped and uncapped leagues look similar, which means the cap explains less of competitive balance than fans assume. It does stabilize small-market franchises, and it moves a measurable share of revenue from players to owners. The strongest version of the argument treats revenue sharing as the real balancing mechanism and states the cost to players plainly.',
    house: mkHouse({
      title: 'Should salary caps exist in professional sports?',
      concepts: ['Competitive balance', 'Player mobility', 'Revenue sharing', 'Owner incentives'],
      perspectives: [
        { id: 1, name: 'Players', summary: 'Caps suppress earnings in a short, injury-prone career.', questions: 4, strength: 62, owner: 'you' },
        { id: 2, name: 'Owners', summary: 'Caps curb runaway spending and protect franchise value.', questions: 3, strength: 72, owner: 'maya' },
        { id: 3, name: 'Small-market teams', summary: 'A cap is the way they stay competitive with rich markets.', questions: 3, strength: 68, owner: 'devan' },
        { id: 4, name: 'Fans', summary: 'Care about a fair title race more than any single roster.', questions: 2, strength: 58, owner: 'you' },
      ],
      evidence: [
        { id: 1, text: 'The hard-capped NFL produced 12 different champions over 20 years, and the uncapped MLB produced 11.', source: 'League championship records (2004-2024)', owner: 'maya', byAI: false },
        { id: 2, text: 'Payroll-to-wins correlation is weaker in capped leagues than in uncapped ones.', source: 'Illustrative demo evidence, not a citation', owner: 'devan', byAI: false },
        { id: 3, text: 'Union analyses estimate a cap shifts a mid-single-digit share of league revenue from labor to ownership.', source: 'Illustrative demo evidence, not a citation', owner: 'you', byAI: false },
      ],
      assumptions: [
        { id: 1, text: 'Fans value competitive balance and reward it with attention.', owner: 'you' },
        { id: 2, text: 'Owners reinvest the savings from a cap rather than pocketing them.', owner: 'devan' },
        { id: 3, text: 'Leagues can enforce a cap without large-scale circumvention.', owner: 'maya' },
      ],
      pos: [
        { id: 1, text: 'Tighter title races and more watchable regular seasons.', horizon: 'Long-term', who: 'Fans' },
        { id: 2, text: 'Financial stability for small-market franchises.', horizon: 'Near-term', who: 'Small-market teams' },
      ],
      neg: [
        { id: 1, text: 'Suppressed pay in careers that average under four years.', horizon: 'Near-term', who: 'Players' },
      ],
      unc: [
        { id: 1, text: 'Whether the cap or revenue sharing does the real balancing.', horizon: 'Long-term', who: 'The league' },
      ],
      watchpoints: [
        'Luxury-tax thresholds quietly replacing a hard cap.',
        'Superstar movement concentrating talent in a few large markets.',
      ],
    }),
  },
  {
    slug: 'should-i-take-the-startup-offer',
    domain: 'Decisions',
    summary: 'Worth taking once a six-month cash cushion is in place and the Series A is on track.',
    purpose:
      'Weigh leaving a stable job for an early-stage startup, so the choice accounts for family finances, career growth, and the odds the company makes it.',
    conclusion: [
      'Accept the offer once there is a six-month cash cushion and the Series A is closing on schedule.',
      'Without those two conditions, the learning upside does not cover the loss of stable income the family depends on.',
    ],
    reasoning:
      'The upside is concrete: faster skill growth, wider ownership, and equity with real potential. Two conditions carry the decision, the round closing and the family absorbing lower cash comp, and both can be checked today. Treating them as gates turns a gut call into a conditional yes with clear tripwires.',
    house: mkHouse({
      title: 'Should I take the startup offer or stay at my current job?',
      concepts: ['Upside vs stability', 'Learning rate', 'Runway', 'Reversibility'],
      perspectives: [
        { id: 1, name: 'Me in five years', summary: 'Weighs skill growth and optionality over near-term pay.', questions: 3, strength: 60, owner: 'you' },
        { id: 2, name: 'My family', summary: 'Needs predictable income and health coverage.', questions: 3, strength: 66, owner: 'maya' },
        { id: 3, name: 'The startup team', summary: 'Needs someone who can own ambiguity from day one.', questions: 2, strength: 55, owner: 'devan' },
      ],
      evidence: [
        { id: 1, text: 'The startup has 18 months of runway at current burn and a signed Series A term sheet.', source: 'Offer data room (2026)', owner: 'you', byAI: false },
        { id: 2, text: 'The offered equity vests over four years with a one-year cliff, so leaving in year one forfeits all of it.', source: 'Offer letter (2026)', owner: 'maya', byAI: false },
        { id: 3, text: 'Early-stage roles tend to carry broader scope and faster skill growth, traded against lower cash compensation.', source: 'Illustrative demo evidence, not a citation', owner: 'ai', byAI: true },
      ],
      assumptions: [
        { id: 1, text: 'The Series A closes on the stated timeline.', owner: 'you' },
        { id: 2, text: 'My current role would survive a downturn.', owner: 'maya' },
        { id: 3, text: 'We can absorb roughly six months of lower cash comp.', owner: 'you' },
      ],
      pos: [
        { id: 1, text: 'A steeper learning curve and broader ownership.', horizon: 'Near-term', who: 'Me in five years' },
        { id: 2, text: 'Meaningful equity if the company succeeds.', horizon: 'Long-term', who: 'Me in five years' },
      ],
      neg: [
        { id: 1, text: 'Lower cash comp and a lost 401(k) match while vesting.', horizon: 'Near-term', who: 'My family' },
      ],
      unc: [
        { id: 1, text: 'Whether the product finds a market before runway ends.', horizon: 'Near-term', who: 'The startup team' },
      ],
      watchpoints: [
        'The Series A slipping past Q3.',
        'Burn rate rising faster than revenue.',
      ],
    }),
  },
  {
    slug: 'should-we-adopt-a-four-day-work-week',
    domain: 'Policy',
    summary: 'Worth piloting with output metrics and staggered coverage before any permanent switch.',
    purpose:
      'Decide whether to move the company to a four-day week, and how to test it, so the call holds up to employees, managers, and finance.',
    conclusion: [
      'Run a time-boxed pilot with defined output metrics and staggered coverage before making the change permanent.',
      'The retention and burnout gains are well supported, while the risks around coverage and lasting productivity need local evidence.',
    ],
    reasoning:
      'Published trials repeatedly show steady output alongside lower burnout, which is strong support for the upside. The open questions are whether the gains outlast the novelty and whether client coverage holds on a shorter week. A pilot measures both before the company commits, so the policy gets tested rather than assumed.',
    house: mkHouse({
      title: 'Should we adopt a four-day work week?',
      concepts: ['Productivity', 'Burnout', 'Coverage', 'Compensation'],
      perspectives: [
        { id: 1, name: 'Employees', summary: 'Report less burnout and would defend the policy.', questions: 3, strength: 74, owner: 'you' },
        { id: 2, name: 'Managers', summary: 'Worry about coverage and client response times.', questions: 3, strength: 60, owner: 'maya' },
        { id: 3, name: 'Customers', summary: 'Care about responsiveness, not the internal schedule.', questions: 2, strength: 58, owner: 'devan' },
        { id: 4, name: 'Finance', summary: 'Watches whether output holds at the same payroll.', questions: 2, strength: 55, owner: 'you' },
      ],
      evidence: [
        { id: 1, text: 'In the UK four-day-week pilot, 71 percent of staff reported reduced burnout while revenue stayed roughly flat.', source: '4 Day Week Global / Autonomy UK pilot (2023)', url: 'https://autonomy.work/portfolio/uk4dwpilotresults/', owner: 'maya', byAI: false },
        { id: 2, text: 'Iceland public-sector trials found productivity maintained or improved across most trial workplaces.', source: 'Autonomy / Alda report (2021)', url: 'https://autonomy.work/portfolio/icelandsww/', owner: 'devan', byAI: false },
        { id: 3, text: '92 percent of the 61 participating UK companies continued the four-day week after the pilot ended.', source: '4 Day Week Global / Autonomy UK pilot (2023)', url: 'https://autonomy.work/portfolio/uk4dwpilotresults/', owner: 'ai', byAI: true },
      ],
      assumptions: [
        { id: 1, text: 'Output is driven by focus, not hours logged.', owner: 'you' },
        { id: 2, text: 'Coverage gaps can be staggered rather than backfilled with hires.', owner: 'maya' },
        { id: 3, text: 'Pay stays flat while hours drop.', owner: 'you' },
      ],
      pos: [
        { id: 1, text: 'Lower burnout and stronger retention.', horizon: 'Long-term', who: 'Employees' },
        { id: 2, text: 'A hiring edge in a tight labor market.', horizon: 'Near-term', who: 'Finance' },
      ],
      neg: [
        { id: 1, text: 'Coverage strain in client-facing and on-call roles.', horizon: 'Near-term', who: 'Managers' },
      ],
      unc: [
        { id: 1, text: 'Whether the gains persist past the novelty period.', horizon: 'Long-term', who: 'Employees' },
      ],
      watchpoints: [
        'Response-time targets slipping on the off day.',
        'Meeting load creeping back to fill four days.',
      ],
    }),
  },
  {
    slug: 'is-it-ethical-to-eat-meat',
    domain: 'Ethics',
    summary: 'Cutting back is well justified on welfare and climate grounds; going fully vegetarian is a personal line.',
    purpose:
      'Examine whether eating meat is ethical, so the reasoning weighs animal welfare, environmental cost, nutrition, and the livelihoods that depend on livestock.',
    conclusion: [
      'Reducing meat consumption is well justified by the welfare and environmental evidence.',
      'Whether to stop entirely is a reasonable but personal judgment, and any large policy shift should protect farming livelihoods.',
    ],
    reasoning:
      'The environmental and welfare evidence points clearly toward eating less meat. What stays contested is where to draw the line, because the case for full abstention rests on moral weight that people assign differently. The cost to farming livelihoods is a real constraint on how fast any shift should move.',
    house: mkHouse({
      title: 'Is it ethical to eat meat?',
      concepts: ['Animal welfare', 'Environmental cost', 'Nutrition', 'Cultural tradition'],
      perspectives: [
        { id: 1, name: 'Animals', summary: 'Bear the direct cost of industrial production.', questions: 3, strength: 70, owner: 'maya' },
        { id: 2, name: 'The planet', summary: 'Absorbs land, water, and emissions impacts.', questions: 3, strength: 66, owner: 'devan' },
        { id: 3, name: 'Individuals', summary: 'Balance health, cost, culture, and conscience.', questions: 2, strength: 58, owner: 'you' },
        { id: 4, name: 'Farmers', summary: 'Livelihoods and rural economies depend on livestock.', questions: 2, strength: 54, owner: 'you' },
      ],
      evidence: [
        { id: 1, text: 'Livestock supply chains account for roughly 14.5 percent of global greenhouse-gas emissions.', source: 'FAO, Tackling Climate Change Through Livestock (2013)', url: 'https://www.fao.org/3/i3437e/i3437e.pdf', owner: 'devan', byAI: false },
        { id: 2, text: 'Beef requires around 20 times the land per gram of protein compared with beans.', source: 'Our World in Data', url: 'https://ourworldindata.org/environmental-impacts-of-food', owner: 'maya', byAI: false },
        { id: 3, text: 'Well-planned vegetarian and vegan diets are nutritionally adequate per major dietetic bodies.', source: 'Academy of Nutrition & Dietetics position (2016)', url: 'https://pubmed.ncbi.nlm.nih.gov/27886704/', owner: 'ai', byAI: true },
      ],
      assumptions: [
        { id: 1, text: 'Sentience gives animal suffering real moral weight.', owner: 'maya' },
        { id: 2, text: 'Individual diet choices aggregate into meaningful environmental effect.', owner: 'devan' },
        { id: 3, text: 'Nutritional needs can be met without meat for most people.', owner: 'you' },
      ],
      pos: [
        { id: 1, text: 'Eating less lowers emissions and animal suffering.', horizon: 'Long-term', who: 'The planet' },
      ],
      neg: [
        { id: 1, text: 'Abrupt shifts threaten farming livelihoods and food access.', horizon: 'Near-term', who: 'Farmers' },
      ],
      unc: [
        { id: 1, text: 'Where the line falls between eating less and stopping entirely.', horizon: 'Long-term', who: 'Individuals' },
      ],
      watchpoints: [
        'The cultured-meat cost curve against conventional meat.',
        'Displacement effects on rural farm economies.',
      ],
    }),
  },
  {
    slug: 'should-our-team-migrate-to-a-monorepo',
    domain: 'Decisions',
    summary: 'A good move once remote build caching and affected-only CI are in place.',
    purpose:
      'Decide whether the team should consolidate its repositories into a monorepo, so the choice weighs code sharing, build tooling, and ownership.',
    conclusion: [
      'Adopt the monorepo after remote build caching and affected-only CI are in place.',
      'The code-sharing and onboarding gains are real, and the main risk of slower CI is a tooling problem rather than a structural one.',
    ],
    reasoning:
      'Large engineering orgs run single repositories at scale, so the model itself is proven. The cost shows up as CI time and looser ownership, both of which caching and CODEOWNERS address. Sequencing the tooling ahead of the migration is what keeps the move low risk.',
    house: mkHouse({
      title: 'Should our team migrate to a monorepo?',
      concepts: ['Code sharing', 'Build tooling', 'Release coupling', 'Ownership boundaries'],
      perspectives: [
        { id: 1, name: 'Platform team', summary: 'Wants unified tooling and atomic cross-cuts.', questions: 3, strength: 68, owner: 'you' },
        { id: 2, name: 'Product teams', summary: 'Fear slower CI and blurred ownership.', questions: 3, strength: 58, owner: 'maya' },
        { id: 3, name: 'New hires', summary: 'Onboard faster with one checkout and one setup.', questions: 2, strength: 62, owner: 'devan' },
      ],
      evidence: [
        { id: 1, text: 'Google runs billions of lines of code from a single repository with custom tooling.', source: 'Potvin & Levenberg, CACM (2016)', url: 'https://dl.acm.org/doi/10.1145/2854146', owner: 'you', byAI: false },
        { id: 2, text: 'Teams migrating without incremental build tooling commonly report significant CI-time regressions.', source: 'Illustrative demo evidence, not a citation', owner: 'maya', byAI: false },
        { id: 3, text: 'Atomic cross-project changes drop from days to a single pull request in monorepo setups.', source: 'Vendor case studies, illustrative', owner: 'ai', byAI: true },
      ],
      assumptions: [
        { id: 1, text: 'We can invest in remote caching and affected-only CI.', owner: 'you' },
        { id: 2, text: 'Ownership can be enforced with CODEOWNERS instead of repo boundaries.', owner: 'maya' },
        { id: 3, text: 'Release trains can be decoupled inside one repository.', owner: 'you' },
      ],
      pos: [
        { id: 1, text: 'Atomic refactors and shared libraries with no version drift.', horizon: 'Near-term', who: 'Platform team' },
        { id: 2, text: 'Faster, simpler onboarding.', horizon: 'Near-term', who: 'New hires' },
      ],
      neg: [
        { id: 1, text: 'CI and tooling cost until caching is in place.', horizon: 'Near-term', who: 'Product teams' },
      ],
      unc: [
        { id: 1, text: 'Whether ownership discipline holds without hard repo boundaries.', horizon: 'Long-term', who: 'Product teams' },
      ],
      watchpoints: [
        'CI wall-clock time as merge volume grows.',
        'CODEOWNERS coverage gaps on shared paths.',
      ],
    }),
  },
  {
    slug: 'should-i-go-to-a-state-school-or-a-private-university',
    domain: 'Decisions',
    summary: 'The state school wins on cost-adjusted outcomes unless a specific private program offers a credential the field demands.',
    purpose:
      'Decide between a state university and a private university, so the choice weighs cost, academic fit, career outcomes, and family finances.',
    conclusion: [
      'Choose the state school unless a specific private program offers a credential, network, or research opportunity the field demands and the debt load is manageable within five years of expected starting salary.',
      'The private-school premium is real in a narrow set of fields and programs, but for most majors the cost-adjusted outcomes favor the public option.',
    ],
    reasoning:
      'Lifetime earnings data show diminishing returns on tuition above a threshold, and the gap narrows further when financial aid and in-state pricing are factored in. The strongest private-school case rests on field-specific placement rates and alumni networks, not general prestige. Debt-to-income ratio at graduation is the clearest gate for whether the premium is worth paying.',
    house: mkHouse({
      title: 'Should I go to a state school or a private university?',
      concepts: ['Return on tuition', 'Debt-to-income ratio', 'Academic fit', 'Campus culture'],
      perspectives: [
        { id: 1, name: 'The student', summary: 'Wants the best education without crippling debt.', strength: 64, owner: 'you' },
        { id: 2, name: 'Parents', summary: 'Balance aspiration against the family budget.', strength: 60, owner: 'maya' },
        { id: 3, name: 'Future employer', summary: 'Cares about skills and internships more than the school name.', strength: 56, owner: 'devan' },
        { id: 4, name: 'Financial aid office', summary: 'Merit and need-based aid can close the sticker-price gap.', strength: 52, owner: 'you' },
      ],
      evidence: [
        { id: 1, text: 'Students who attend selective private colleges earn roughly 7–8 percent more at mid-career, but the gap narrows after controlling for student ability.', source: 'Dale & Krueger, NBER Working Paper (2011)', owner: 'you', byAI: false },
        { id: 2, text: 'Average student-loan debt at graduation is roughly twice as high at private four-year colleges as at public ones.', source: 'College Board, Trends in Student Aid (2024)', owner: 'maya', byAI: false },
        { id: 3, text: 'Employer surveys consistently rank relevant experience and skills above institutional prestige when evaluating candidates.', source: 'NACE Job Outlook Survey, illustrative', owner: 'ai', byAI: true },
      ],
      assumptions: [
        { id: 1, text: 'The student is admitted to competitive programs at both schools.', owner: 'you' },
        { id: 2, text: 'Financial aid offers are final and comparable.', owner: 'maya' },
        { id: 3, text: 'The intended major is offered at both institutions.', owner: 'you' },
      ],
      pos: [
        { id: 1, text: 'Graduating with little or no debt opens career choices that high debt forecloses.', horizon: 'Near-term', who: 'The student' },
        { id: 2, text: 'A strong state honors program can match private-school rigor at a fraction of the cost.', horizon: 'Near-term', who: 'Parents' },
      ],
      neg: [
        { id: 1, text: 'Passing on a top private program in a prestige-gated field may limit early-career placement.', horizon: 'Near-term', who: 'Future employer' },
      ],
      unc: [
        { id: 1, text: "Whether the private school's alumni network delivers measurable value in the student's specific field.", horizon: 'Long-term', who: 'The student' },
      ],
      watchpoints: [
        'The net-price gap after aid, not the sticker-price gap.',
        'Field-specific placement rates, not university-wide averages.',
      ],
    }),
  },
  {
    slug: 'should-facial-recognition-be-used-in-schools',
    domain: 'Classroom',
    summary: 'The safety gains are unproven relative to the surveillance costs, and less invasive alternatives exist.',
    purpose:
      'Examine whether schools should adopt facial recognition technology for safety and attendance, so the reasoning weighs student privacy, security outcomes, bias, and institutional trust.',
    conclusion: [
      'Schools should not adopt facial recognition until independent evidence shows it outperforms less invasive alternatives like badge systems and staffed entries.',
      'The bias and privacy costs fall hardest on the students least able to push back, which makes the burden of proof higher, not lower.',
    ],
    reasoning:
      'The claimed safety benefit — faster identification of threats — has not been validated in school settings, while the privacy cost and documented racial bias in recognition accuracy are well established. Schools that adopted the technology faced legal challenges and community backlash. Staffed entry points and visitor-management systems address the same threat model with far less surveillance overhead.',
    house: mkHouse({
      title: 'Should facial recognition be used in schools?',
      concepts: ['Biometric surveillance', 'Algorithmic bias', 'Student privacy', 'Physical security'],
      perspectives: [
        { id: 1, name: 'Students', summary: 'Bear the surveillance burden daily with limited ability to opt out.', strength: 70, owner: 'you' },
        { id: 2, name: 'School administrators', summary: 'Want faster threat identification and streamlined attendance.', strength: 58, owner: 'maya' },
        { id: 3, name: 'Parents', summary: 'Split between safety reassurance and discomfort with biometric data collection.', strength: 62, owner: 'devan' },
        { id: 4, name: 'Civil liberties advocates', summary: 'Flag disproportionate impact on students of color and chilling effects on expression.', strength: 66, owner: 'you' },
      ],
      evidence: [
        { id: 1, text: 'NIST testing found significantly higher false-match rates for Black and Asian faces compared with white faces across most commercial algorithms.', source: 'NIST Face Recognition Vendor Test (2019)', url: 'https://www.nist.gov/programs-projects/face-recognition-vendor-test-frvt', owner: 'you', byAI: false },
        { id: 2, text: "The Lockport, NY school district's facial-recognition pilot was suspended by the state after privacy objections and an inconclusive safety review.", source: 'New York State Education Department (2020)', owner: 'devan', byAI: false },
        { id: 3, text: 'No peer-reviewed study has demonstrated that facial recognition in K-12 settings reduces violent incidents compared with staffed entry systems.', source: 'Illustrative demo evidence, not a citation', owner: 'ai', byAI: true },
      ],
      assumptions: [
        { id: 1, text: 'Student consent is meaningful only when opting out carries no penalty.', owner: 'you' },
        { id: 2, text: 'The school can secure biometric data against breaches.', owner: 'maya' },
        { id: 3, text: 'Alternative security measures are available and funded.', owner: 'devan' },
      ],
      pos: [
        { id: 1, text: 'Potentially faster identification of known threats at entry points.', horizon: 'Near-term', who: 'School administrators' },
      ],
      neg: [
        { id: 1, text: 'Daily surveillance normalizes biometric tracking for minors.', horizon: 'Long-term', who: 'Students' },
        { id: 2, text: 'Higher error rates for students of color create unequal treatment.', horizon: 'Near-term', who: 'Civil liberties advocates' },
      ],
      unc: [
        { id: 1, text: 'Whether the technology actually reduces incidents in practice, not just in vendor claims.', horizon: 'Near-term', who: 'Parents' },
      ],
      watchpoints: [
        'State and federal legislation restricting biometric use in schools.',
        'Bias audit results as algorithms update.',
      ],
    }),
  },
  {
    slug: 'should-i-buy-or-rent-in-my-city',
    domain: 'Debate',
    summary: 'Renting wins until the expected stay exceeds five years and the price-to-rent ratio is below 20.',
    purpose:
      'Decide whether to buy or continue renting a home, so the reasoning accounts for local market conditions, opportunity cost, lifestyle flexibility, and long-term wealth building.',
    conclusion: [
      'Rent unless you expect to stay at least five years in the same city, the local price-to-rent ratio is below 20, and you have a down payment that does not drain your emergency fund.',
      'Buying is a leveraged, illiquid bet on one asset in one location — it builds wealth only when the holding period and market conditions cooperate.',
    ],
    reasoning:
      'Transaction costs (closing, selling, moving) typically take five-plus years to recoup, so short stays favor renting on pure math. The price-to-rent ratio captures whether local prices have outrun local rents, which is the clearest signal of whether ownership pencils out. The flexibility cost of owning is real but hard to quantify — it matters most for people early in their careers or likely to relocate.',
    house: mkHouse({
      title: 'Should I buy or rent in my city?',
      concepts: ['Price-to-rent ratio', 'Opportunity cost', 'Transaction costs', 'Equity building'],
      perspectives: [
        { id: 1, name: 'The renter', summary: 'Values flexibility and lower upfront commitment.', strength: 62, owner: 'you' },
        { id: 2, name: 'The prospective buyer', summary: 'Wants to build equity and lock in housing costs.', strength: 60, owner: 'maya' },
        { id: 3, name: 'A financial planner', summary: 'Compares total cost of ownership against investing the difference.', strength: 66, owner: 'devan' },
      ],
      evidence: [
        { id: 1, text: 'Average transaction costs (closing, agent fees, transfer taxes) run 8–10 percent of sale price, requiring years of appreciation to recoup.', source: 'Illustrative demo evidence, not a citation', owner: 'you', byAI: false },
        { id: 2, text: 'A price-to-rent ratio above 20 historically signals that buying is more expensive than renting on a monthly-cost basis.', source: 'Illustrative demo evidence, not a citation', owner: 'devan', byAI: false },
        { id: 3, text: 'Investing a down payment in a diversified index fund has historically returned more than residential real estate appreciation in most U.S. metros.', source: 'Illustrative demo evidence, not a citation', owner: 'ai', byAI: true },
      ],
      assumptions: [
        { id: 1, text: 'The buyer qualifies for a conventional mortgage at prevailing rates.', owner: 'you' },
        { id: 2, text: 'Rent increases track inflation, not speculative spikes.', owner: 'maya' },
        { id: 3, text: 'The buyer would actually invest the savings from renting rather than spending them.', owner: 'devan' },
      ],
      pos: [
        { id: 1, text: 'Locked-in housing costs and forced savings through mortgage payments.', horizon: 'Long-term', who: 'The prospective buyer' },
        { id: 2, text: 'Freedom to relocate for career or lifestyle without selling overhead.', horizon: 'Near-term', who: 'The renter' },
      ],
      neg: [
        { id: 1, text: 'Maintenance, taxes, and insurance add 1–2 percent of home value annually on top of the mortgage.', horizon: 'Long-term', who: 'The prospective buyer' },
      ],
      unc: [
        { id: 1, text: 'Local market direction over the expected holding period.', horizon: 'Long-term', who: 'A financial planner' },
      ],
      watchpoints: [
        'Mortgage rates relative to rental yield in the target neighborhood.',
        'Local zoning changes that could shift supply and prices.',
      ],
    }),
  },
  {
    slug: 'is-intermittent-fasting-right-for-me',
    domain: 'Debate',
    summary: 'Likely safe for most adults, but the evidence does not show it outperforms conventional calorie restriction for weight loss.',
    purpose:
      'Evaluate whether intermittent fasting is a sound dietary strategy, so the reasoning weighs clinical evidence, individual health factors, sustainability, and the risk of disordered eating.',
    conclusion: [
      'Intermittent fasting is a reasonable option for otherwise healthy adults who find it easier to follow than traditional diets, but it is not metabolically superior.',
      'Anyone with a history of disordered eating, diabetes medication, or pregnancy should consult a physician before starting.',
    ],
    reasoning:
      'Randomized trials show intermittent fasting produces comparable weight loss to continuous calorie restriction, not more. The real advantage is adherence: some people find time-restricted eating simpler to maintain. The risk profile is low for healthy adults but meaningful for populations prone to blood-sugar swings or eating disorders. Framing it as a lifestyle preference rather than a metabolic hack matches the evidence.',
    house: mkHouse({
      title: 'Is intermittent fasting right for me?',
      concepts: ['Time-restricted eating', 'Caloric deficit', 'Metabolic health', 'Adherence'],
      perspectives: [
        { id: 1, name: 'The dieter', summary: 'Wants a sustainable way to manage weight without counting every calorie.', strength: 60, owner: 'you' },
        { id: 2, name: 'A physician', summary: 'Cares about safety, contraindications, and evidence quality.', strength: 68, owner: 'maya' },
        { id: 3, name: 'A nutritionist', summary: 'Evaluates whether the approach meets long-term nutritional needs.', strength: 62, owner: 'devan' },
        { id: 4, name: 'A psychologist', summary: 'Watches for patterns that could trigger or worsen disordered eating.', strength: 58, owner: 'you' },
      ],
      evidence: [
        { id: 1, text: 'A 2020 JAMA Internal Medicine RCT found no significant difference in weight loss between 16:8 time-restricted eating and three structured meals per day over 12 weeks.', source: 'Lowe et al., JAMA Internal Medicine (2020)', url: 'https://pubmed.ncbi.nlm.nih.gov/32986097/', owner: 'maya', byAI: false },
        { id: 2, text: 'Systematic reviews report that intermittent fasting and continuous calorie restriction produce comparable reductions in body weight and fat mass.', source: 'Cioffi et al., European Journal of Clinical Nutrition (2018)', owner: 'devan', byAI: false },
        { id: 3, text: 'Clinicians note that rigid fasting windows can reinforce all-or-nothing thinking in patients with a history of binge eating.', source: 'Illustrative clinical observation, not a citation', owner: 'ai', byAI: true },
      ],
      assumptions: [
        { id: 1, text: 'The person has no medical condition that requires regular meal timing.', owner: 'you' },
        { id: 2, text: 'Weight management is the primary goal, not athletic performance.', owner: 'maya' },
        { id: 3, text: 'The person does not have a history of disordered eating.', owner: 'devan' },
      ],
      pos: [
        { id: 1, text: 'Simpler adherence for people who prefer fewer, larger meals.', horizon: 'Near-term', who: 'The dieter' },
      ],
      neg: [
        { id: 1, text: 'Risk of reinforcing restrictive patterns in vulnerable individuals.', horizon: 'Near-term', who: 'A psychologist' },
      ],
      unc: [
        { id: 1, text: 'Long-term metabolic effects beyond two years, where trial data is sparse.', horizon: 'Long-term', who: 'A physician' },
      ],
      watchpoints: [
        'New RCTs comparing time-restricted eating with calorie-matched controls over longer durations.',
        'Whether adherence advantages hold past six months.',
      ],
    }),
  },
  {
    slug: 'should-voting-be-mandatory',
    domain: 'Policy',
    summary: 'Compulsory voting raises turnout but needs same-day registration and a "none of the above" option to avoid disenfranchisement.',
    purpose:
      'Evaluate whether a democracy should require citizens to vote, so the case accounts for turnout effects, legitimacy, individual liberty, and implementation costs.',
    conclusion: [
      'Mandatory voting is worth adopting when paired with same-day registration, a formal "none of the above" option, and penalties small enough to function as a nudge rather than a punishment.',
      'Without those safeguards, compulsion risks penalizing the people least able to navigate the system.',
    ],
    reasoning:
      "Australia's compulsory system delivers turnout above 90 percent and has broad public support after a century of practice, which is strong evidence that the model works at scale. The strongest objection — that forcing a vote violates individual liberty — is substantially addressed by allowing a blank or \"none\" ballot, which preserves the right not to choose while still requiring participation. The implementation risk is that fines and enforcement fall harder on low-income and transient populations, so the penalty design matters as much as the mandate itself.",
    house: mkHouse({
      title: 'Should voting be mandatory?',
      concepts: ['Democratic legitimacy', 'Civic duty', 'Individual liberty', 'Turnout equity'],
      perspectives: [
        { id: 1, name: 'Non-voters', summary: 'Disproportionately young, low-income, and underrepresented in policy outcomes.', strength: 64, owner: 'you' },
        { id: 2, name: 'Civil libertarians', summary: 'Argue the right to vote includes the right not to.', strength: 62, owner: 'maya' },
        { id: 3, name: 'Election administrators', summary: 'Must handle higher volume and enforce compliance.', strength: 54, owner: 'devan' },
        { id: 4, name: 'Political parties', summary: 'Would shift strategy from turnout operations to persuasion.', strength: 56, owner: 'you' },
      ],
      evidence: [
        { id: 1, text: 'Australia has enforced compulsory voting since 1924 and consistently achieves turnout above 90 percent.', source: 'Australian Electoral Commission', url: 'https://www.aec.gov.au/about_aec/publications/', owner: 'you', byAI: false },
        { id: 2, text: 'Countries with compulsory voting show smaller income-based gaps in turnout compared with voluntary systems.', source: 'Illustrative demo evidence, not a citation', owner: 'maya', byAI: false },
        { id: 3, text: 'Critics note that compulsory-voting fines in Belgium and Australia are small but still disproportionately burden low-income citizens.', source: 'Illustrative demo evidence, not a citation', owner: 'ai', byAI: true },
      ],
      assumptions: [
        { id: 1, text: 'Higher turnout produces more representative outcomes.', owner: 'you' },
        { id: 2, text: 'A "none of the above" option adequately protects the right to abstain.', owner: 'maya' },
        { id: 3, text: 'Enforcement can be designed to nudge rather than punish.', owner: 'devan' },
      ],
      pos: [
        { id: 1, text: 'Near-universal turnout closes the representation gap for marginalized groups.', horizon: 'Long-term', who: 'Non-voters' },
        { id: 2, text: 'Parties compete on policy rather than turnout mechanics.', horizon: 'Long-term', who: 'Political parties' },
      ],
      neg: [
        { id: 1, text: 'Compulsion infringes on the liberty to disengage from politics.', horizon: 'Near-term', who: 'Civil libertarians' },
      ],
      unc: [
        { id: 1, text: 'Whether higher turnout actually shifts policy outcomes or just ratifies the status quo.', horizon: 'Long-term', who: 'Non-voters' },
      ],
      watchpoints: [
        'Informal ballot rates as a proxy for protest or disengagement.',
        'Enforcement patterns across income brackets.',
      ],
    }),
  },
  {
    slug: 'should-i-switch-careers-at-35',
    domain: 'Decisions',
    summary: 'Worth making when the new field has a clear entry path and the transition cost fits inside a 12-month financial cushion.',
    purpose:
      'Decide whether to leave an established career for a new field at mid-career, so the reasoning accounts for financial risk, transferable skills, identity, and long-term fulfillment.',
    conclusion: [
      'Switch when the new field has a concrete entry path you have already tested (a side project, a course, informational interviews) and you can absorb 12 months of reduced income.',
      'Without that evidence, the pull toward a new career may be burnout from the current one rather than genuine fit with the next.',
    ],
    reasoning:
      'Mid-career switchers carry real advantages — professional maturity, transferable management and communication skills, and a network — but the transition cost is higher than at 25 because income expectations, dependents, and identity are more entangled. The strongest switches are ones where the person has already validated interest through low-cost experiments, which separates genuine draw from escapism. A financial cushion gates the decision because the income dip is the most predictable risk.',
    house: mkHouse({
      title: 'Should I switch careers at 35?',
      concepts: ['Transferable skills', 'Sunk-cost fallacy', 'Identity transition', 'Financial runway'],
      perspectives: [
        { id: 1, name: 'The switcher', summary: 'Feels stalled and drawn to work that fits better.', strength: 62, owner: 'you' },
        { id: 2, name: 'Family and dependents', summary: 'Depend on stable income and benefits during the transition.', strength: 66, owner: 'maya' },
        { id: 3, name: 'A career coach', summary: 'Distinguishes burnout-driven escape from genuine vocational pull.', strength: 60, owner: 'devan' },
        { id: 4, name: 'The new industry', summary: 'Values fresh perspective but expects entry-level hustle.', strength: 54, owner: 'you' },
      ],
      evidence: [
        { id: 1, text: 'Bureau of Labor Statistics data show the median worker changes occupations multiple times, with mid-career switches increasingly common.', source: 'BLS, illustrative summary', owner: 'you', byAI: false },
        { id: 2, text: 'Career-change research finds that switchers who ran low-cost experiments (freelance projects, courses, shadowing) before quitting report higher satisfaction and lower regret.', source: 'Ibarra, Working Identity (2003), illustrative', owner: 'devan', byAI: false },
        { id: 3, text: 'Income typically dips 10–20 percent in the first two years of a mid-career switch before recovering, though the range varies widely by field.', source: 'Illustrative demo evidence, not a citation', owner: 'ai', byAI: true },
      ],
      assumptions: [
        { id: 1, text: 'The dissatisfaction is with the career itself, not a specific job or manager.', owner: 'you' },
        { id: 2, text: 'The household can absorb a year of lower income.', owner: 'maya' },
        { id: 3, text: 'The switcher has already tested interest through a side project or course.', owner: 'devan' },
      ],
      pos: [
        { id: 1, text: 'Renewed engagement and a second growth curve in a field that fits.', horizon: 'Long-term', who: 'The switcher' },
        { id: 2, text: 'Transferable skills accelerate the ramp in the new field.', horizon: 'Near-term', who: 'The new industry' },
      ],
      neg: [
        { id: 1, text: 'Income dip and benefits gap during the transition.', horizon: 'Near-term', who: 'Family and dependents' },
      ],
      unc: [
        { id: 1, text: "Whether the new career's appeal survives the entry-level grind.", horizon: 'Near-term', who: 'A career coach' },
      ],
      watchpoints: [
        'Whether the draw persists after a sabbatical or extended break from the current role.',
        'The gap between informational-interview impressions and day-to-day reality in the new field.',
      ],
    }),
  },
]

export function getExample(slug: string): ExampleHouse | undefined {
  return examples.find((e) => e.slug === slug)
}
