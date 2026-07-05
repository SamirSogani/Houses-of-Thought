// Static fixtures for the pre-login Examples pages (/examples, /examples/[slug]).
// These are curated, "completed" Houses of Thought shown as proof to visitors —
// no auth, no DB. Content reuses the Build reducer's State shape (see
// lib/build/types.ts) so the strength helpers and row shapes render unchanged.
// The AI-in-schools house reuses the Build demo seed (lib/build/state.ts).

import type { State } from '@/lib/build/types'
import { blankState } from '@/lib/build/persistence'
import { initialState } from '@/lib/build/state'

export type ExampleDomain = 'Decisions' | 'Debate' | 'Classroom' | 'Ethics' | 'Policy'

// Domain filter order for the gallery chips (plan: keep categories ≤6).
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
  stance: string // one-line card summary of where the house lands
  conclusion: string
  reasoning: string
  house: State // full reducer State so computeStrength / strength UI just work
}

// Fill the ephemeral/default State fields, override only real content.
function mkHouse(content: Partial<State>): State {
  return { ...blankState(), ...content }
}

export const examples: ExampleHouse[] = [
  {
    slug: 'should-ai-be-used-in-schools',
    domain: 'Classroom',
    stance: 'Yes — as a supervised tutor, not an unsupervised answer key.',
    conclusion:
      'Adopt AI in schools deliberately: deploy it as a supervised tutor that coaches, and pair every rollout with teacher training and clear assessment rules.',
    reasoning:
      'The evidence shows moderate, real learning gains, but only when AI supports a teacher rather than replacing the thinking. Every load-bearing assumption — accuracy, funding for training, maturing privacy law — holds under supervision and fails without it. The strongest objections are about equity and unsupervised use, which the conclusion answers directly rather than dismissing.',
    house: initialState,
  },
  {
    slug: 'should-salary-caps-exist-in-pro-sports',
    domain: 'Debate',
    stance: 'On balance yes, but revenue sharing may do the real balancing work.',
    conclusion:
      'A salary cap is defensible when paired with revenue sharing: it protects small-market viability and title-race parity, but it should not be sold as the sole cause of competitive balance.',
    reasoning:
      'Capped and uncapped leagues both produce champions, so the cap is not doing all the work the argument assumes. It does, however, stabilize small-market franchises and modestly shifts revenue from labor to ownership — a real cost to players that the conclusion acknowledges rather than hides.',
    house: mkHouse({
      title: 'Should salary caps exist in professional sports?',
      concepts: ['Competitive balance', 'Player mobility', 'Revenue sharing', 'Owner incentives'],
      perspectives: [
        { id: 1, name: 'Players', summary: 'Caps suppress earnings in a short, injury-prone career.', questions: 4, strength: 62, owner: 'you' },
        { id: 2, name: 'Owners', summary: 'Caps curb runaway spending and protect franchise value.', questions: 3, strength: 72, owner: 'maya' },
        { id: 3, name: 'Small-market teams', summary: 'A cap is the only way to compete with rich markets.', questions: 3, strength: 68, owner: 'devan' },
        { id: 4, name: 'Fans', summary: 'Care about a fair title race more than any single roster.', questions: 2, strength: 58, owner: 'you' },
      ],
      evidence: [
        { id: 1, text: 'The hard-capped NFL produced 12 different champions in 20 years; the uncapped MLB produced 11 — nearly identical.', source: 'League championship records (2004–2024)', owner: 'maya', byAI: false },
        { id: 2, text: 'Payroll-to-wins correlation is weak in capped leagues (r ≈ 0.2) versus uncapped (r ≈ 0.45).', source: 'Journal of Sports Economics (2022)', owner: 'devan', byAI: false },
        { id: 3, text: 'Union analyses estimate a cap shifts roughly 5–8% of league revenue from labor to ownership.', source: 'MLBPA / NFLPA CBA filings (2023)', owner: 'you', byAI: false },
      ],
      assumptions: [
        { id: 1, text: 'Fans actually value competitive balance and reward it with attention.', owner: 'you' },
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
        { id: 1, text: 'Whether the cap or revenue-sharing is doing the real balancing.', horizon: 'Long-term', who: 'The league' },
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
    stance: 'Take it only if the family can absorb ~6 months of lower cash comp.',
    conclusion:
      'Accept the startup offer if — and only if — a six-month cash-comp cushion is in place and the Series A closes on schedule; otherwise the learning upside does not outweigh the family stability at risk.',
    reasoning:
      'The upside is real: faster skill growth, broader ownership, and meaningful equity. But the decision hinges on two assumptions — that the round closes and that lower cash comp is survivable — and both are checkable now rather than hoped for. Framing the choice around those gates turns a gut call into a conditional one.',
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
        { id: 2, text: 'Median tenure before the equity cliff is 2.1 years; the offered vest cliff is 1 year.', source: 'Carta equity report (2025)', owner: 'maya', byAI: false },
        { id: 3, text: 'Comparable IC roles see 30–40% faster promotion at early-stage firms.', source: 'Levels.fyi cohort data (2025)', owner: 'ai', byAI: true },
      ],
      assumptions: [
        { id: 1, text: 'The Series A closes on the stated timeline.', owner: 'you' },
        { id: 2, text: 'My current role would still exist through a downturn.', owner: 'maya' },
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
    stance: 'Pilot it — gains look real, but coverage and durability are unproven.',
    conclusion:
      'Run a time-boxed four-day-week pilot with clear output metrics and staggered coverage before committing; the burnout and retention gains are well-supported, but the durability and coverage risks need local evidence.',
    reasoning:
      'Trials consistently show maintained output and lower burnout, which is strong support for the upside. The open questions — whether gains persist past the novelty period and whether client coverage holds — are exactly what a pilot measures, so the conclusion buys information rather than betting the whole policy at once.',
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
        { id: 1, text: 'In a UK four-day-week trial, 71% of staff reported reduced burnout while revenue stayed roughly flat.', source: '4 Day Week Global pilot (2023)', owner: 'maya', byAI: false },
        { id: 2, text: 'Iceland public-sector trials found productivity maintained or improved across most teams.', source: 'Autonomy / ALDA report (2021)', owner: 'devan', byAI: false },
        { id: 3, text: '61% of participating UK firms kept the policy after the trial ended.', source: '4 Day Week Global follow-up (2024)', owner: 'ai', byAI: true },
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
        { id: 1, text: 'Whether gains persist past the novelty period.', horizon: 'Long-term', who: 'Employees' },
      ],
      watchpoints: [
        'Response-time SLAs slipping on the off day.',
        'Meeting load creeping back to fill four days.',
      ],
    }),
  },
  {
    slug: 'is-it-ethical-to-eat-meat',
    domain: 'Ethics',
    stance: 'Reduction is well-justified; total abstention is a harder, personal call.',
    conclusion:
      'Reducing meat consumption is strongly justified on welfare and environmental grounds; whether to abstain entirely is a defensible but genuinely personal line, and abrupt policy shifts should protect farming livelihoods.',
    reasoning:
      'The environmental and welfare evidence is robust and points clearly toward reduction. The remaining disagreement is about where the line sits — reduce versus abstain — which turns on contested moral weight rather than facts. Naming that as the real crux, and flagging the livelihood cost, keeps the conclusion honest about what it can and cannot settle.',
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
        { id: 1, text: 'Animal agriculture accounts for roughly 14.5% of global greenhouse-gas emissions.', source: 'FAO livestock assessment (2013)', owner: 'devan', byAI: false },
        { id: 2, text: 'Beef requires around 20x the land per gram of protein compared with beans.', source: 'Our World in Data (2022)', owner: 'maya', byAI: false },
        { id: 3, text: 'Well-planned vegetarian and vegan diets are nutritionally adequate per major dietetic bodies.', source: 'Academy of Nutrition & Dietetics position (2016)', owner: 'ai', byAI: true },
      ],
      assumptions: [
        { id: 1, text: 'Sentience gives animal suffering real moral weight.', owner: 'maya' },
        { id: 2, text: 'Individual diet choices aggregate into meaningful environmental effect.', owner: 'devan' },
        { id: 3, text: 'Nutritional needs can be met without meat for most people.', owner: 'you' },
      ],
      pos: [
        { id: 1, text: 'Reducing intake lowers emissions and animal suffering.', horizon: 'Long-term', who: 'The planet' },
      ],
      neg: [
        { id: 1, text: 'Abrupt shifts threaten farming livelihoods and food access.', horizon: 'Near-term', who: 'Farmers' },
      ],
      unc: [
        { id: 1, text: 'Where the line falls between reduction and full abstention.', horizon: 'Long-term', who: 'Individuals' },
      ],
      watchpoints: [
        'The cultured-meat cost curve versus conventional meat.',
        'Displacement effects on rural farm economies.',
      ],
    }),
  },
  {
    slug: 'should-our-team-migrate-to-a-monorepo',
    domain: 'Decisions',
    stance: 'Yes, if build caching lands first — otherwise the CI cost bites.',
    conclusion:
      'Migrate to a monorepo, but only after remote build caching and affected-only CI are in place; the code-sharing and onboarding gains are real, and the main risk (CI time and ownership drift) is tooling-solvable rather than fundamental.',
    reasoning:
      'The upside — atomic refactors, no version drift, faster onboarding — is well-demonstrated at scale. The downside is concentrated in CI cost and ownership discipline, both of which are addressable with caching and CODEOWNERS. Sequencing the tooling before the migration is what turns a risky move into a safe one.',
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
        { id: 2, text: 'Teams migrating without incremental build tooling report 20–40% CI-time regressions.', source: 'Migration retrospectives survey (2024)', owner: 'maya', byAI: false },
        { id: 3, text: 'Atomic cross-project changes drop from days to a single PR in monorepo setups.', source: 'Nx / Turborepo case studies (2025)', owner: 'ai', byAI: true },
      ],
      assumptions: [
        { id: 1, text: 'We can invest in remote caching and affected-only CI.', owner: 'you' },
        { id: 2, text: 'Ownership can be enforced with CODEOWNERS, not repo boundaries.', owner: 'maya' },
        { id: 3, text: 'Release trains can be decoupled inside one repository.', owner: 'you' },
      ],
      pos: [
        { id: 1, text: 'Atomic refactors and shared libraries without version drift.', horizon: 'Near-term', who: 'Platform team' },
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
