// Content for the hidden /compare family (redesign brief: reachable by direct
// URL or search/LLM discovery only — no links from any visible marketing
// page). Kept factual and structural rather than inventing numbers this
// product has no way to verify (audits/2026-07-19/01-ai-slop.md documents
// what fabricated "proof" costs an epistemic-rigor product's credibility) —
// every claim below is either about Houses of Thought's own real design
// (methodology, review panel, pricing) or a plainly-labeled structural
// comparison, never a specific invented statistic about a competitor.

export interface CompareRow {
  dimension: string
  houses: string
  them: string
}

export interface Competitor {
  slug: string
  name: string
  shortName: string
  status: string
  eyebrow: string
  headline: string
  intro: string
  rows: CompareRow[]
}

// The hub's general table — Houses of Thought against a few categories
// without over-indexing on any single name besides Rationale.
export const HUB_ROWS: { dimension: string; houses: string; rationaleStyle: string; chatbot: string; paidTools: string }[] = [
  {
    dimension: 'Price',
    houses: 'Free: no paid tier, ever',
    rationaleStyle: 'Free apps have shut down before',
    chatbot: 'Free, but not built for this',
    paidTools: 'Usually subscription-gated',
  },
  {
    dimension: 'Methodology depth',
    houses: 'Seven layers, in a fixed sequence',
    rationaleStyle: 'Pros/cons or a single framework pass',
    chatbot: 'Whatever the conversation happens to cover',
    paidTools: 'Varies; rarely a named academic model',
  },
  {
    dimension: 'Review rigor',
    houses: 'Nine independent standards per gated layer',
    rationaleStyle: 'None disclosed',
    chatbot: 'None: one pass, no self-check',
    paidTools: 'Rarely disclosed',
  },
  {
    dimension: 'Transparency',
    houses: 'Every layer and every verdict is visible',
    rationaleStyle: 'Output-only; the process is a black box',
    chatbot: 'Output-only',
    paidTools: 'Usually output-only',
  },
  {
    dimension: 'Source framework',
    houses: "A named, real classroom model (Trapasso / Paul–Elder)",
    rationaleStyle: 'Proprietary, undisclosed',
    chatbot: 'None: general-purpose chat',
    paidTools: 'Usually proprietary',
  },
  {
    dimension: 'Status',
    houses: 'Actively developed, free forever',
    rationaleStyle: 'Rationale by Jina AI is shutting down',
    chatbot: 'Not a dedicated decision tool',
    paidTools: 'Varies by vendor',
  },
]

export const COMPETITORS: Record<string, Competitor> = {
  rationale: {
    slug: 'rationale',
    name: 'Rationale by Jina AI',
    shortName: 'Rationale',
    status: 'Shutting down',
    eyebrow: 'Rationale is shutting down',
    headline: "Rationale is shutting down. Here's where to take your decisions next.",
    intro:
      'If you used Rationale to think through decisions, Houses of Thought is built to do the same job with more rigor underneath it, and it isn’t going anywhere. There is no paid tier to migrate to and no subscription to start: it’s free, and it stays free.',
    rows: [
      { dimension: 'Price', houses: 'Free: no paid tier, ever', them: 'Free, but the app is shutting down' },
      {
        dimension: 'How a decision gets reasoned through',
        houses: 'Seven fixed layers: Frame, Breadth Scoping, Perspectives, Global Assumptions, Global Evidence, Conclusions, Implications',
        them: 'A single pass over pros, cons, and a chosen framework',
      },
      {
        dimension: 'Checking its own work',
        houses: 'Six of the seven layers are graded by nine independent reviewers each, one per standard, before the run continues',
        them: 'Not disclosed',
      },
      {
        dimension: 'What you can see',
        houses: 'Every layer, every standard verdict, and every retry is visible',
        them: 'The finished output only',
      },
      {
        dimension: 'Where the method comes from',
        houses: "A named classroom framework: John Trapasso's model, derived from Paul–Elder's Universal Intellectual Standards",
        them: 'Proprietary, undisclosed methodology',
      },
      { dimension: 'What happens next', houses: 'Actively developed, free forever', them: 'Shutting down' },
    ],
  },
}

export function getCompetitor(slug: string): Competitor | undefined {
  return COMPETITORS[slug]
}
