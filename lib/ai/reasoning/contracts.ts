// Client-safe contracts for the reasoning pipeline (decision 019; architecture:
// plans/active/reasoning-pipeline/02-data-contracts.md). Pure zod + types, no
// server imports — mirrors lib/ai/chat.ts / lib/ai/draft.ts.
//
// Phase 1 (decisions/019 + plans/active/reasoning-pipeline/04, verification
// stage 1): no persistence — every packet here rides in ephemeral client
// state for the length of one run, never the DB. Bounded retries (Phase 1.5,
// 03-orchestration-and-failure-handling.md) DID land within Phase 1 scope —
// see ReviewPanelVerdictSchema.degraded below and
// app/api/admin/reasoning/route.ts's retryStep().

import { z } from 'zod'

const str = z.string().min(1).max(600)
// scope_notes asks for a lot in one field (FRAME_BLOCK, lib/ai/reasoning/
// prompts.ts: practical/social/economic/procedural angles, a spectrum-of-
// options note, an out-of-scope note) — the shared 600-char `str` cap
// rejected well-formed output that genuinely needed the room, surfaced live
// (2026-07-31) on a regeneration attempt: same failure pattern as
// SingleStandardVerdictSchema.notes below, same fix.
const scopeNotesStr = z.string().min(1).max(1400)
// rebuttals asks for substantive, specific reasoning per targeted claim ("name
// exactly what is wrong or weak"), not a generic complaint — same failure
// shape as SingleStandardVerdictSchema.notes below, surfaced live (2026-07-31)
// on real perspectives-generate-details traffic: the shared 600-char `str`
// cap rejected a well-formed rebuttal that genuinely needed the room.
const rebuttalStr = z.string().min(1).max(1000)
// search_findings holds runSearches()'s (lib/ai/reasoning/search.ts) formatted
// dump of up to 3 queries' real results (title+url+description each) — the
// 600-char `str` cap rejected this immediately on real traffic (2026-08-02):
// even one query's worth of real results routinely exceeds it, let alone 3.
const searchFindingsStr = z.string().min(1).max(4000)
const HorizonSchema = z.enum(['Near-term', 'Long-term'])
const ConfidenceSchema = z.enum(['low', 'medium', 'high'])

// ── Context-gather (Phase 3 item 1, decision 019: the two fixed checkpoints
// PLUS admin-triggered ad-hoc calls at any point — see AdHocContextGatherSchema
// below) ─────────────────────────────────────────────────────────────────────
// One question + up to 3 quick-pick options, mirroring this app's own
// AskUserQuestion-style UX (Samir's call, 2026-08-04): the admin can pick one
// of the options or answer freely instead ("Other" is always available and is
// never itself one of these — it's the UI's fallback, not a 4th option the
// model writes). options may be empty when the question is too open-ended for
// a short pick-list to make sense (CONTEXT_GATHER_BLOCK, prompts.ts).
export const ContextGatherQuestionSchema = z.object({
  question: str,
  options: z.array(str).max(3),
})
export type ContextGatherQuestion = z.infer<typeof ContextGatherQuestionSchema>

export const ContextGatherVerdictSchema = z.object({
  needs_user_input: z.boolean(),
  questions_for_user: z.array(ContextGatherQuestionSchema).max(3),
  reason: str,
  // Populated by the orchestrator (runContextGather, orchestrator-setup.ts)
  // via real search on questions_for_user when needs_user_input is true — the
  // model can't have real results yet at the point it decides whether to ask,
  // so this is never part of what the model itself returns (see
  // ContextGatherModelSchema below). Null when not needed or not run.
  search_findings: searchFindingsStr.nullable(),
})
export type ContextGatherVerdict = z.infer<typeof ContextGatherVerdictSchema>

// What the model actually produces — search_findings is added after the call.
export const ContextGatherModelSchema = ContextGatherVerdictSchema.omit({ search_findings: true })

// One free-text (or picked-option) answer per entry in a resolved verdict's
// questions_for_user, same index alignment. null means the admin skipped that
// specific question — Phase 3 item 1's confirmed "skippable" call (matches
// the existing "search enriches, never substitutes" philosophy: an unanswered
// question must never deadlock a run). Never empty string — skipping is
// always represented as null, not ''.
export const ContextGatherAnswersSchema = z.array(str.nullable()).max(3)
export type ContextGatherAnswers = z.infer<typeof ContextGatherAnswersSchema>

// An admin-triggered, ad-hoc context-gather call (Phase 3 item 1's larger
// scope, confirmed with Samir 2026-08-04: "any layer can trigger 'ask the
// user something' mid-pipeline," README's target architecture — not just the
// two fixed checkpoints below). Unlike contextGatherPre/Post on RunState
// (app/api/admin/reasoning/route.ts), there can be zero, one, or many of
// these per run, at whatever step the admin happened to be paused on —
// appended to, never mutated except to fill in `answers` once resolved.
export const AdHocContextGatherSchema = z.object({
  atStep: str, // a StepId (lib/ai/reasoning/steps.ts) — kept as a plain string here to avoid coupling this pure-contracts file to the step sequencer.
  verdict: ContextGatherVerdictSchema,
  answers: ContextGatherAnswersSchema.nullable(),
})
export type AdHocContextGather = z.infer<typeof AdHocContextGatherSchema>

// ── Frame ───────────────────────────────────────────────────────────────────
export const FramePacketSchema = z.object({
  original_query: str,
  core_question: str,
  definitions: z.array(z.object({ term: str, definition: str })).max(6),
  purpose: str,
  scope_notes: scopeNotesStr,
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
    // max 8, matching key_claims above (2026-08-01: real traffic showed the
    // model routinely ignoring the prompt's own "1-6" ask and rebutting more
    // than 6 of the stance's key_claims — target_claims is drawn FROM
    // key_claims, so it shouldn't be capped tighter than its own source).
    target_claims: z.array(str).min(1).max(8),
    rebuttals: z.array(rebuttalStr).min(1).max(8),
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

// What ONE standard reviewer's completeJSON call returns. notes' cap (400 ->
// 700 on 2026-07-30, -> 1000 on 2026-08-01) keeps climbing because the prompt
// keeps genuinely needing the room: quoting a fragment of the artifact plus
// the specific reason, and for a densely-argued perspective bundle (the
// densest artifact any reviewer sees), that routinely runs past 700 too —
// confirmed live on perspectives-review's accuracy standard, failing
// completeJSON's self-correction retry both attempts at 700.
export const SingleStandardVerdictSchema = z.object({
  pass: z.boolean(),
  notes: z.string().min(1).max(1000),
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
  // true only for a perspective bundle that exhausted MAX_REGENERATION_ATTEMPTS
  // (lib/ai/reasoning/budget.ts) and was passed forward anyway — the one layer
  // with real redundancy (the other bundles), per
  // 03-orchestration-and-failure-handling.md. Every other reviewed layer
  // hard-blocks-and-halts instead of ever setting this true (steps.ts
  // STEP_FAILURE_MODE) — see app/api/admin/reasoning/route.ts for the
  // regenerate-then-re-review loop this field is part of.
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
