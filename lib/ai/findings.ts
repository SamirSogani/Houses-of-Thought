// The shared contract between every AI route and the client. A route returns
// FINDINGS; a finding may carry an ACTION; only the reducer (via applyAiAction)
// ever applies one. One detection engine, two renderings (decision 007): the
// model fills observation/suggestion (Decide) AND question (Learn) on every
// finding, so the client can switch modes without refetching.
//
// Client-safe: pure zod + types, no server imports. Also converted to JSON Schema
// by lib/ai/groq.ts for Groq's structured outputs.

import { z } from 'zod'

// Shown by every AI surface when a route returns 429 (rate-limited). The routes
// respond `{ error: 'rate-limited' }`; the client matches that code. No Retry
// button on 429 — retrying won't help until the daily cap resets.
export const RATE_LIMITED_CODE = 'rate-limited'
export const RATE_LIMITED_COPY =
  'The co-pilot is resting — daily limit reached. It resets tomorrow.'

// What a finding can be about. The render label is derived client-side.
export const FINDING_KINDS = [
  'framing', //                 question too broad/compound/vague
  'vague_concept', //           term used but not pinned down
  'missing_perspective', //     stakeholder absent
  'weak_perspective', //        perspective has no stance/subQs/counters
  'missing_evidence', //        claim with nothing underneath
  'single_source', //           conclusion-relevant evidence from one source
  'hidden_assumption', //       unstated premise
  'load_bearing', //            assumption the conclusion depends on
  'conclusion_gap', //          conclusion outruns evidence/perspectives
  'unexamined_implication', //  consequence or bearer not considered
] as const

const str = z.string().min(1).max(300)
const HorizonSchema = z.enum(['Near-term', 'Long-term'])

// INVARIANT 1 (plans/active/ai README): there is deliberately NO action variant
// that sets conclusion, reasoning, question, or purpose — the AI never writes the
// conclusion, and the ban is enforced by this type, not just by prompts. Do not
// add such a variant.
export const AiActionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('add_concept'), term: str, definition: str }),
  z.object({ kind: z.literal('add_perspective'), name: str, summary: str, stance: str }),
  // perspectiveName is matched to an existing perspective by name, case-insensitive.
  z.object({ kind: z.literal('add_subquestion'), perspectiveName: str, q: str }),
  z.object({ kind: z.literal('add_assumption'), text: str }),
  z.object({
    kind: z.literal('add_implication'),
    ikind: z.enum(['pos', 'neg', 'unc']),
    text: str,
    horizon: HorizonSchema,
    who: str,
  }),
  z.object({ kind: z.literal('add_watchpoint'), text: str }),
  // add_evidence is Research Mode ONLY (doc 06). The suggest route drops it
  // server-side (invariant 3: evidence cites only Brave results in the request).
  z.object({ kind: z.literal('add_evidence'), text: str, source: str, url: str }),
])

export const FindingSchema = z.object({
  kind: z.enum(FINDING_KINDS),
  layer: z.number().int().min(1).max(7),
  severity: z.enum(['note', 'important']),
  observation: str, // what the engine noticed — Decide rendering, line 1
  suggestion: str, //  proposed move — Decide rendering, line 2
  question: str, //    Socratic form — Learn rendering (sole content)
  action: AiActionSchema.nullable(), // null when the move is "think", not "add"
})

export const FindingsResponseSchema = z.object({
  findings: z.array(FindingSchema).min(1).max(4),
})

export type AiAction = z.infer<typeof AiActionSchema>
export type Finding = z.infer<typeof FindingSchema>
export type FindingsResponse = z.infer<typeof FindingsResponseSchema>
export type FindingKind = (typeof FINDING_KINDS)[number]
