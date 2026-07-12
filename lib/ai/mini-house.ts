// Shared shape for the pre-login "Mini House" (POST /api/ai/mini-house). Client-
// safe (zod only, no server imports) so both the route and the /try UI import it,
// mirroring lib/ai/findings.ts.
//
// Field names, cardinality, and fixed perspective/assumption ordering mirror the
// "Try It Instantly" recreation spec verbatim (snake_case, exactly-3/exactly-2
// shapes) — with one deliberate deviation: evidence stays grounded in a live
// Brave search rather than the spec's "plausible sources allowed". Citations are
// MLA-formatted exactly as specced, but every url traces to a real search result
// (see app/api/ai/mini-house/route.ts step 3) — same rule as the rest of the app.
//
// A Mini House is never persisted — the teaser is ephemeral by design; the
// conversion event is "create an account".

import { z } from 'zod'

export const MINI_HOUSE_PERSPECTIVE_TITLES = [
  'Practical / Logical',
  'Emotional / Personal',
  'Long-Term / Strategic',
] as const

export const MINI_HOUSE_ASSUMPTION_TYPES = ['Unstated', 'Emotional', 'Logical'] as const

export const MiniSubQuestionSchema = z.object({
  question: z.string(),
  answer: z.string(),
})

export const MiniPerspectiveSchema = z.object({
  title: z.string(), // one of MINI_HOUSE_PERSPECTIVE_TITLES, in fixed order
  summary: z.string(), // one sentence
  sub_questions: z.array(MiniSubQuestionSchema).length(2),
  sub_conclusion: z.string(),
})

export const MiniAssumptionSchema = z.object({
  type: z.enum(MINI_HOUSE_ASSUMPTION_TYPES),
  text: z.string(),
})

export const MiniEvidenceSchema = z.object({
  summary: z.string(),
  source_title: z.string(),
  source_publisher: z.string(),
  mla_citation: z.string(),
  // Not part of the spec's rendered field list; carried only so the route can
  // validate this item traces to a real Brave result. Dropped before it would
  // ever need to render.
  url: z.string(),
})

export const MiniSynthesisSchema = z.object({
  final_take: z.string(),
  key_tradeoffs: z.array(z.string()).length(3),
  strongest_tension: z.string(),
  reflective_question: z.string(),
})

export const MiniHouseSchema = z.object({
  restated_question: z.string(),
  perspectives: z.array(MiniPerspectiveSchema).length(3),
  assumptions: z.array(MiniAssumptionSchema).length(3),
  // Spec says "exactly 5"; relaxed to "up to 5" so the model never fabricates a
  // citation just to hit the count when Brave returns fewer usable results.
  evidence: z.array(MiniEvidenceSchema).max(5),
  synthesis: MiniSynthesisSchema,
})

export type MiniSubQuestion = z.infer<typeof MiniSubQuestionSchema>
export type MiniPerspective = z.infer<typeof MiniPerspectiveSchema>
export type MiniAssumption = z.infer<typeof MiniAssumptionSchema>
export type MiniEvidence = z.infer<typeof MiniEvidenceSchema>
export type MiniSynthesis = z.infer<typeof MiniSynthesisSchema>
export type MiniHouse = z.infer<typeof MiniHouseSchema>

// Example prompts shown on the /try entry screen.
export const MINI_HOUSE_EXAMPLES = [
  'Should I change my major?',
  'Should I quit my job?',
  'How do I stop procrastinating?',
  'Should I move to another city?',
] as const

export const MINI_HOUSE_MIN_CHARS = 5
export const MINI_HOUSE_MAX_CHARS = 600

// Cosmetic build-progress checklist (client-side timer, not tied to real
// progress — one POST returns the whole Mini House).
export const MINI_HOUSE_BUILD_STAGES = [
  'Restating your question…',
  'Analyzing perspectives…',
  'Identifying assumptions…',
  'Gathering evidence…',
  'Generating conclusions…',
] as const

export const MINI_HOUSE_STAGE_INTERVAL_MS = 1400
export const MINI_HOUSE_MIN_LOADING_MS = 4500
