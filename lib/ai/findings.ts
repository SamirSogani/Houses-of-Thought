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
// Widened cap for the two reasoning-pipeline-sourced kinds below (2026-08-16,
// plan doc plans/active/reasoning-pipeline/27-house-scoped-pipeline-integration.md):
// their content is drawn from lib/ai/reasoning/contracts.ts packets, some of
// which cap at 600 (evidence claim_id/source_ref) or 1000 (counterargument
// rebuttals) chars — wider than every other AiAction field's 300, all of
// which are freshly model-generated for THIS schema's own 300-char prompts.
// Reusing `str` here would silently truncate well-formed pipeline output.
const longStr = z.string().min(1).max(1000)
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
  // Nested per-perspective supportingEvidence ({text, source}, lib/build/types.ts)
  // — distinct from add_evidence below, which targets the FLAT house_evidence
  // table. Added 2026-08-16 for the reasoning pipeline's PerspectiveBundle.evidence
  // mapping (plan doc 27 §3) — no prior AiAction kind could reach this nested
  // shape; Draft Mode's own 'evidence' stage still only ever emits add_evidence
  // (lib/ai/draft.ts's DRAFT_STAGE_KINDS is untouched by this addition).
  z.object({ kind: z.literal('add_perspective_evidence'), perspectiveName: str, text: longStr, source: longStr }),
  // Nested per-perspective counters (string[], lib/build/types.ts) — the
  // counterargument's rebuttals in the reasoning pipeline's own vocabulary.
  // Added alongside add_perspective_evidence above, same rationale.
  z.object({ kind: z.literal('add_counter'), perspectiveName: str, text: longStr }),
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
