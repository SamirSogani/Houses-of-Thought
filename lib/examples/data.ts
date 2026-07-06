// Static fixtures for the pre-login Examples pages (/examples, /examples/[slug]).
// These are curated, finished Houses of Thought shown as proof to visitors, with
// no auth and no DB. Content reuses the Build reducer's State shape (lib/build/
// types.ts) so the real strength model and layer render just work.
//
// The "Should AI be used in schools?" house is the canonical demo: its structured
// content is the Build seed (lib/build/state.ts) and its prose (purpose, per-
// perspective detail, conclusion, reasoning) is the stored copy in
// lib/build/content.ts. It is rendered verbatim, not re-authored.

import type { State } from '@/lib/build/types'
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

// Fill the ephemeral/default State fields, override only real content. Concepts
// are authored as plain term strings here and normalized to { term, definition }.
function mkHouse({ concepts, ...content }: Omit<Partial<State>, 'concepts'> & { concepts?: string[] }): State {
  return {
    ...blankState(),
    ...content,
    concepts: (concepts ?? []).map((term) => ({ term, definition: '' })),
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
        { id: 2, text: 'Payroll-to-wins correlation is weak in capped leagues (r ≈ 0.2) and stronger in uncapped ones (r ≈ 0.45).', source: 'Journal of Sports Economics (2022)', owner: 'devan', byAI: false },
        { id: 3, text: 'Union analyses estimate a cap shifts 5 to 8 percent of league revenue from labor to ownership.', source: 'MLBPA / NFLPA CBA filings (2023)', owner: 'you', byAI: false },
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
        { id: 2, text: 'Median tenure before the equity cliff is 2.1 years, and the offered vest cliff is 1 year.', source: 'Carta equity report (2025)', owner: 'maya', byAI: false },
        { id: 3, text: 'Comparable IC roles see 30 to 40 percent faster promotion at early-stage firms.', source: 'Levels.fyi cohort data (2025)', owner: 'ai', byAI: true },
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
        { id: 1, text: 'In a UK four-day-week trial, 71 percent of staff reported reduced burnout while revenue stayed roughly flat.', source: '4 Day Week Global pilot (2023)', owner: 'maya', byAI: false },
        { id: 2, text: 'Iceland public-sector trials found productivity maintained or improved across most teams.', source: 'Autonomy / ALDA report (2021)', owner: 'devan', byAI: false },
        { id: 3, text: '61 percent of participating UK firms kept the policy after the trial ended.', source: '4 Day Week Global follow-up (2024)', owner: 'ai', byAI: true },
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
        { id: 1, text: 'Animal agriculture accounts for roughly 14.5 percent of global greenhouse-gas emissions.', source: 'FAO livestock assessment (2013)', owner: 'devan', byAI: false },
        { id: 2, text: 'Beef requires around 20 times the land per gram of protein compared with beans.', source: 'Our World in Data (2022)', owner: 'maya', byAI: false },
        { id: 3, text: 'Well-planned vegetarian and vegan diets are nutritionally adequate per major dietetic bodies.', source: 'Academy of Nutrition & Dietetics position (2016)', owner: 'ai', byAI: true },
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
        { id: 1, text: 'Google and Meta run billions of lines from a single repository with custom tooling.', source: 'Potvin & Levenberg, CACM (2016)', owner: 'you', byAI: false },
        { id: 2, text: 'Teams migrating without incremental build tooling report 20 to 40 percent CI-time regressions.', source: 'Migration retrospectives survey (2024)', owner: 'maya', byAI: false },
        { id: 3, text: 'Atomic cross-project changes drop from days to a single pull request in monorepo setups.', source: 'Nx / Turborepo case studies (2025)', owner: 'ai', byAI: true },
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
]

export function getExample(slug: string): ExampleHouse | undefined {
  return examples.find((e) => e.slug === slug)
}
