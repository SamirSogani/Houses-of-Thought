// Client-safe contract for House Chat (POST /api/admin/chat-intake; decision
// 017). Mirrors lib/ai/draft.ts / findings.ts: pure zod + types + helpers, no
// server imports, shared by the route and the /admin/chat UI.
//
// The intake is EXTRACTIVE, never generative: the house's `question` and
// `purpose` must be spans of the person's own words. The model is told this in
// the prompt, but the clamps below are what make invariant 1 (the AI never
// writes question/purpose) hold in code — a non-verbatim extraction falls back
// to the person's literal message, never to model text.

import { z } from 'zod'

export type ChatTurn = { role: 'user' | 'assistant'; content: string }

// Field bound shared with the house columns (mirrors findings.ts `str` max).
export const CHAT_FIELD_MAX = 300

// What the model returns. `reply` carries the (single) clarify message when
// done=false; when done=true the route ignores it and the client shows its own
// templated copy instead — the model never gets to phrase the hand-off.
// The refine keeps a done=true turn from arriving without its extraction
// (parse-only; z.toJSONSchema skips refines, same note as the interview route).
export const ChatIntakeModelSchema = z
  .object({
    done: z.boolean(),
    reply: z.string(),
    question: z.string().nullable(),
    purpose: z.string().nullable(),
    context: z.object({ summary: z.string(), facts: z.array(z.string()) }).nullable(),
  })
  .refine((r) => !r.done || (r.question !== null && r.context !== null), {
    message: 'question and context must be non-null when done is true',
  })
export type ChatIntakeModel = z.infer<typeof ChatIntakeModelSchema>

// What the route returns to the client.
export type ChatIntakeResponse =
  | { done: false; reply: string }
  | {
      done: true
      question: string
      purpose: string
      context: { summary: string; facts: string[] }
    }

// ── conclusion candidates (POST /api/admin/chat-conclusions; decision 018) ───
//
// The one place outside the strawman where the AI authors conclusion text —
// admin-only, opt-in per question, and always PLURAL: the route returns 2–4
// candidates that genuinely disagree, each grounded in the whole house with its
// own trailing implications. Nothing lands in the house until the person adopts
// one (SET_CONCLUSION / SET_REASONING / add_implication dispatches, client-side).
// The shared AiActionSchema stays incapable of expressing a conclusion.

const ImplicationCandidateSchema = z.object({
  ikind: z.enum(['pos', 'neg', 'unc']),
  text: z.string().min(1).max(300),
  horizon: z.enum(['Near-term', 'Long-term']),
  who: z.string().min(1).max(120),
})

export const ConclusionCandidateSchema = z.object({
  // A direct, committed answer to the house's question.
  conclusion: z.string().min(1).max(600),
  // The trail: why, citing the house's own perspectives/evidence/assumptions.
  reasoning: z.string().min(1).max(900),
  // The exact datapoints doing the load-bearing work, named or quoted.
  basis: z.array(z.string().min(1).max(200)).min(2).max(8),
  // What follows IF this conclusion is adopted — shaped exactly like
  // add_implication, so adopting maps 1:1 onto existing reducer actions.
  implications: z.array(ImplicationCandidateSchema).min(2).max(4),
})
export type ConclusionCandidate = z.infer<typeof ConclusionCandidateSchema>

export const ChatConclusionsResponseSchema = z.object({
  candidates: z.array(ConclusionCandidateSchema).min(2).max(4),
})
export type ChatConclusionsResponse = z.infer<typeof ChatConclusionsResponseSchema>

// ── verbatim-span clamps ─────────────────────────────────────────────────────

// Case/whitespace-insensitive normalization for span matching. Capitalization
// and spacing are not authorship; wording is.
function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim()
}

// Trailing sentence punctuation the model may legitimately add or drop when
// trimming a span out of a longer message ("…ban homework instead" → "…ban
// homework instead?").
function stripEndPunct(s: string): string {
  return s.replace(/[?.!…]+$/, '').trim()
}

// True when `span` appears verbatim (modulo case/whitespace/end punctuation)
// inside any of the person's own turns.
export function isVerbatimSpan(span: string, turns: ChatTurn[]): boolean {
  const candidate = stripEndPunct(norm(span))
  if (!candidate) return false
  return turns.some((t) => t.role === 'user' && norm(t.content).includes(candidate))
}

function lastUserTurn(turns: ChatTurn[]): string {
  for (let i = turns.length - 1; i >= 0; i--) {
    if (turns[i].role === 'user') return turns[i].content.trim()
  }
  return ''
}

// The person's question, clamped to their own words. A verbatim extraction is
// kept; anything else falls back to their most recent question-shaped turn
// (or plain last turn), clipped to the field bound.
export function clampQuestion(span: string | null, turns: ChatTurn[]): string {
  if (span && isVerbatimSpan(span, turns)) return span.trim().slice(0, CHAT_FIELD_MAX)
  const questionish = [...turns]
    .reverse()
    .find((t) => t.role === 'user' && t.content.trim().endsWith('?'))
  const fallback = questionish ? questionish.content.trim() : lastUserTurn(turns)
  return fallback.slice(0, CHAT_FIELD_MAX)
}

// Purpose is optional by design (the clarify turn asks once; skipping is fine).
// A non-verbatim extraction becomes empty — the person writes it in the builder.
export function clampPurpose(span: string | null, turns: ChatTurn[]): string {
  if (span && isVerbatimSpan(span, turns)) return span.trim().slice(0, CHAT_FIELD_MAX)
  return ''
}

// Dashboard/builder title derived from the question — a truncation, not a
// summary, so it stays the person's words too.
export function titleFromQuestion(question: string): string {
  const q = question.replace(/\s+/g, ' ').trim()
  if (q.length <= 80) return q
  const cut = q.slice(0, 80)
  const lastSpace = cut.lastIndexOf(' ')
  return `${cut.slice(0, lastSpace > 40 ? lastSpace : 80).trimEnd()}…`
}
