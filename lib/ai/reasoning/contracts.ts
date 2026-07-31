// Client-safe contracts for the reasoning pipeline (decision 019; architecture:
// plans/active/reasoning-pipeline/02-data-contracts.md). Pure zod + types, no
// server imports — mirrors lib/ai/chat.ts / lib/ai/draft.ts.
//
// Phase 1 (decisions/019 + plans/active/reasoning-pipeline/04, verification
// stage 1): no retries, no persistence — every packet here rides in ephemeral
// client state for the length of one run, never the DB.

import { z } from 'zod'

const str = z.string().min(1).max(600)
const HorizonSchema = z.enum(['Near-term', 'Long-term'])
const ConfidenceSchema = z.enum(['low', 'medium', 'high'])

// ── Context-gather (callable at the two fixed checkpoints in Phase 1) ──────
export const ContextGatherVerdictSchema = z.object({
  needs_user_input: z.boolean(),
  questions_for_user: z.array(str).max(3),
  reason: str,
})
export type ContextGatherVerdict = z.infer<typeof ContextGatherVerdictSchema>

// ── Frame ───────────────────────────────────────────────────────────────────
export const FramePacketSchema = z.object({
  original_query: str,
  core_question: str,
  definitions: z.array(z.object({ term: str, definition: str })).max(6),
  purpose: str,
  scope_notes: str,
})
export type FramePacket = z.infer<typeof FramePacketSchema>

// ── Breadth-scoping ──────────────────────────────────────────────────────────
export const BreadthScopingPacketSchema = z.object({
  n: z.number().int().min(2).max(12),
  rationale: str,
  candidate_viewpoint_labels: z.array(str).min(2).max(12),
})
export type BreadthScopingPacket = z.infer<typeof BreadthScopingPacketSchema>

// ── Perspectives (the one fan-out layer) ────────────────────────────────────
export const PerspectiveEvidenceItemSchema = z.object({
  claim_id: str,
  source_ref: str,
  confidence: ConfidenceSchema,
  caveats: str.nullable(),
})

export const PerspectiveBundleSchema = z.object({
  perspective_id: str,
  stance_label: str,
  stance_summary: str,
  key_claims: z.array(str).min(1).max(8),
  sub_questions: z.array(str).min(1).max(6),
  assumptions: z.array(str).min(1).max(6),
  evidence: z.array(PerspectiveEvidenceItemSchema).max(6),
  counterargument: z.object({
    // Which perspective's session actually wrote it — the independence check
    // (01-layers-and-standards.md): must not be this bundle's own perspective_id.
    authored_by_perspective_id: str,
    target_claims: z.array(str).min(1).max(6),
    rebuttals: z.array(str).min(1).max(6),
  }),
})
export type PerspectiveBundle = z.infer<typeof PerspectiveBundleSchema>

// The round-1 output of perspectives-generate-stances — just enough for round
// 2 (sub-questions/assumptions/evidence/counterargument) to build on. Split
// out because the client resends this between the two generate steps (see
// lib/ai/reasoning/steps.ts for why perspectives-generate is itself two steps).
export const PerspectiveStanceSchema = PerspectiveBundleSchema.pick({
  perspective_id: true,
  stance_label: true,
  stance_summary: true,
  key_claims: true,
})
export type PerspectiveStance = z.infer<typeof PerspectiveStanceSchema>

// ── Review panel — the generic shape reused at every 9-standard gate ───────
// (decisions/019 §3: called "review panel" / "standard reviewer" throughout,
// deliberately not "critic" — see that decision for why.)
export const STANDARD_IDS = [
  'clarity',
  'accuracy',
  'precision',
  'relevance',
  'depth',
  'breadth',
  'logic',
  'significance',
  'fairness',
] as const
export type StandardId = (typeof STANDARD_IDS)[number]

// What ONE standard reviewer's completeJSON call returns. notes' 700-char cap
// (raised from 400, 2026-07-30) reflects what the prompt actually asks for —
// quoting a fragment of the artifact plus the specific reason genuinely runs
// past 400 chars; the tighter cap was rejecting well-formed, on-task output.
export const SingleStandardVerdictSchema = z.object({
  pass: z.boolean(),
  notes: z.string().min(1).max(700),
})
export type SingleStandardVerdict = z.infer<typeof SingleStandardVerdictSchema>

const ReviewPanelStandardsSchema = z.object({
  clarity: SingleStandardVerdictSchema,
  accuracy: SingleStandardVerdictSchema,
  precision: SingleStandardVerdictSchema,
  relevance: SingleStandardVerdictSchema,
  depth: SingleStandardVerdictSchema,
  breadth: SingleStandardVerdictSchema,
  logic: SingleStandardVerdictSchema,
  significance: SingleStandardVerdictSchema,
  fairness: SingleStandardVerdictSchema,
})

// Server-aggregated from 9 SingleStandardVerdict calls (lib/ai/reasoning/
// orchestrator-panel.ts) — never itself a completeJSON schema.
export const ReviewPanelVerdictSchema = z.object({
  subject_id: str,
  standards: ReviewPanelStandardsSchema,
  overall_pass: z.boolean(),
  // Phase 1 has no retries, so degraded only ever means "perspective bundle
  // whose panel failed and was passed forward anyway" — never a retried-then-
  // recovered state (that's a Phase 2 concept).
  degraded: z.boolean(),
})
export type ReviewPanelVerdict = z.infer<typeof ReviewPanelVerdictSchema>

// ── Global layers (question-level, informed by all perspectives, scoped to none) ─
export const GlobalAssumptionsPacketSchema = z.object({
  question_level_assumptions: z.array(str).min(1).max(8),
  cross_perspective_notes: str,
})
export type GlobalAssumptionsPacket = z.infer<typeof GlobalAssumptionsPacketSchema>

export const GlobalEvidencePacketSchema = z.object({
  question_level_evidence: z
    .array(z.object({ claim_id: str, source_ref: str, confidence: ConfidenceSchema }))
    .max(8),
})
export type GlobalEvidencePacket = z.infer<typeof GlobalEvidencePacketSchema>

// ── Conclusions and implications ────────────────────────────────────────────
export const ConclusionsPacketSchema = z.object({
  conclusions: z.array(str).min(1).max(4),
  supporting_chain: z.array(str).min(1).max(8),
})
export type ConclusionsPacket = z.infer<typeof ConclusionsPacketSchema>

const ImplicationItemSchema = z.object({
  ikind: z.enum(['pos', 'neg', 'unc']),
  text: str,
  horizon: HorizonSchema,
  who: str,
})

export const ImplicationsPacketSchema = z.object({
  implications: z.array(ImplicationItemSchema).min(2).max(8),
  confidence: ConfidenceSchema,
  caveats_from_degraded_layers: z.array(str).max(6),
})
export type ImplicationsPacket = z.infer<typeof ImplicationsPacketSchema>

// ── Final composition (packaging only, no review panel) ─────────────────────
export const FinalAnswerSchema = z.object({
  core_question: str,
  answer: z.string().min(1).max(3000),
  caveats: z.array(str).max(8),
})
export type FinalAnswer = z.infer<typeof FinalAnswerSchema>
