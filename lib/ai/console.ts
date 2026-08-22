// Client-safe contract for GET/POST /api/houses/[id]/console — the
// post-pipeline console (plan doc
// plans/active/reasoning-pipeline/28-post-pipeline-console.md, migration
// 0040). Whole-house sibling of lib/ai/layerFeedback.ts's per-layer contract:
// same click-to-accept posture, but scoped to the entire house and able to
// propose BOTH add_* and remove_* actions (findings.ts), plus — unlike
// layer-feedback — a rerun proposal when the correction implies an earlier
// pipeline stage needs to be redone, not just one item swapped.
//
// Also the client-safe contract for the multi-chat surface added on top
// (plan doc plans/active/reasoning-pipeline/29-console-multi-chat.md,
// migration 0041): a chat is a house_console_chats row, a house_console_
// messages row now belongs to exactly one, and every route under
// app/api/houses/[id]/console/chats/ shares the request/response shapes
// below. The pure helpers here (chatDepth, messagesToFork, reparentChildren,
// toChronological) hold the actual branching/caps/copy/window-fix logic so
// lib/ai/console.test.ts can cover it without a database — the routes are
// thin wrappers that call these with rows they already fetched.

import { z } from 'zod'
import { AiActionSchema } from './findings'
import { DRAFT_STAGES, type DraftStage } from './draft'
import type { StepId } from './reasoning/steps'

// Same order-of-magnitude as layer-feedback's message cap — this is a chat
// turn, not an essay.
export const CONSOLE_MESSAGE_MAX = 500

export const RerunProposalSchema = z.object({
  stage: z.enum(DRAFT_STAGES),
  // Plain-language "why" shown to the person before they confirm — never
  // executed from this alone (invariant 2: nothing changes without a click).
  reason: z.string().min(1).max(300),
  // Fed into the pipeline's own regeneration channels (masterReview and/or
  // consoleGuidance, RunStateSchema) once confirmed — see the plan doc for
  // which stages use which channel.
  guidance: z.string().min(1).max(1000),
})
export type RerunProposal = z.infer<typeof RerunProposalSchema>

export const ConsoleResponseSchema = z.object({
  answer: z.string().min(1).max(800),
  // Wider than layer-feedback's max(4) — a whole-house correction can
  // legitimately need a remove + an add together, sometimes across more than
  // one layer in a single reply.
  actions: z.array(AiActionSchema).max(6),
  rerunProposal: RerunProposalSchema.nullable(),
})
export type ConsoleResponse = z.infer<typeof ConsoleResponseSchema>

export interface ConsoleTurn {
  id: string
  // 'system' added by migration 0041 for doc 30's Loop B rerun-completion
  // marker — nothing in this phase writes one, but the DB CHECK already
  // allows it, so the type does too rather than lying about what a GET can
  // return. ConsoleTranscript renders it as a plain centered note.
  role: 'user' | 'assistant' | 'system'
  message: string
  actions: z.infer<typeof AiActionSchema>[] | null
  rerunProposal: RerunProposal | null
  createdAt: string
}

// Where a confirmed rerun resumes the pipeline's own step dispatcher, and
// whether that stage has the masterReview guidance channel (see plan doc
// 28's table — perspectives has none; every other stage does). Both are
// always fed run.consoleGuidance regardless (RunStateSchema); masterReview
// additionally gives the ONE stage actually being corrected the more precise
// "here's your prior output, revise it per this" framing.
export interface RerunStageInfo {
  resumeStep: StepId
  masterReviewStep: StepId | null
}

export const RERUN_STAGE_INFO: Record<DraftStage, RerunStageInfo> = {
  concepts: { resumeStep: 'frame-generate', masterReviewStep: 'frame-review' },
  perspectives: { resumeStep: 'perspectives-generate-stances', masterReviewStep: null },
  assumptions: { resumeStep: 'global-assumptions-generate', masterReviewStep: 'global-assumptions-review' },
  evidence: { resumeStep: 'global-evidence-strategy', masterReviewStep: 'global-evidence-review' },
  implications: { resumeStep: 'implications-generate', masterReviewStep: 'implications-review' },
}

// The pipeline's OWN internal generation order — NOT the house UI's layer
// order (DRAFT_STAGE_STEP: concepts/perspectives/evidence/assumptions/
// implications). Evidence is house-step 3 and assumptions is house-step 4,
// but internally global-assumptions-generate runs BEFORE
// global-evidence-strategy (steps.ts's STEP_ORDER) — a rerun's cascade must
// follow this order, or "rerun evidence" would wrongly appear to also touch
// assumptions (which actually comes before it, not after).
export const RERUN_STAGE_ORDER: readonly DraftStage[] = ['concepts', 'perspectives', 'assumptions', 'evidence', 'implications']

// Every stage from fromStage onward, in true pipeline order — what a
// confirmed rerun actually regenerates (cascade, plan doc 28's second
// confirmed decision), and so what the confirmation UI shows as "will be
// reset" before the person agrees.
export function cascadeStages(fromStage: DraftStage): DraftStage[] {
  const i = RERUN_STAGE_ORDER.indexOf(fromStage)
  return i === -1 ? [fromStage] : RERUN_STAGE_ORDER.slice(i)
}

// ─────────────────────────────────────────────────────────────────────────
// Multiple chats (plan doc 29, migration 0041)
// ─────────────────────────────────────────────────────────────────────────

export const CHAT_TITLE_MAX = 120

// Cost controls first, UI controls second (doc 29 "Caps"): a fork inherits
// its whole parent transcript into every future prompt, so unbounded
// branching is unbounded token spend on a product with no revenue until
// ~2028. Both enforced server-side (chats/route.ts, chats/[chatId]/route.ts)
// and surfaced client-side (ChatSidebar) — never client-only.
export const MAX_ACTIVE_CHATS_PER_HOUSE = 20
export const MAX_CHAT_BRANCH_DEPTH = 5

// How many soft-deleted chats "Recently deleted" shows/loads at once — same
// order of magnitude as the active cap; deleted history isn't bounded by
// MAX_ACTIVE_CHATS_PER_HOUSE the way active chats are, so this exists purely
// to keep that disclosure from loading an unbounded list over time.
export const RECENTLY_DELETED_LIMIT = 30

export const CHAT_ORIGINS = ['root', 'fork', 'seed'] as const
export type ChatOrigin = (typeof CHAT_ORIGINS)[number]

// One row of GET .../console/chats — either the active list or (with
// ?deleted=true) the "Recently deleted" list. turnCount/stale are computed
// server-side (route.ts), not stored columns.
export interface ChatSummary {
  id: string
  title: string
  origin: ChatOrigin
  parentChatId: string | null
  branchedFromMessageId: string | null
  lastMessageAt: string
  turnCount: number
  // True once this chat's last reply predates the house's CURRENT
  // reasoning_runs row — i.e. a rerun has finished since. Always false for
  // a chat that has never had a reply, or when the house has no persisted
  // run at all (nothing to be stale against). Note this only tells a chat
  // it's stale; nothing here inserts doc 30's Loop B system marker — that's
  // out of scope for this phase, so a stale chat gets the one-line notice
  // (ConsoleTranscript) and nothing more.
  stale: boolean
  createdAt: string
  deletedAt: string | null
}

// POST .../console/chats body. A discriminated union rather than one object
// with optional fields — 'fork' is the only mode that both requires a
// specific message AND copies rows; 'seed' brances off a chat with no copy
// (doc 29's "lighter" option); 'new' takes no parent at all (origin 'root',
// same as a house's original implicit chat post-backfill).
export const CreateChatRequestSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('new') }),
  z.object({ mode: z.literal('fork'), fromChatId: z.string().uuid(), fromMessageId: z.string().uuid() }),
  z.object({ mode: z.literal('seed'), fromChatId: z.string().uuid() }),
])
export type CreateChatRequest = z.infer<typeof CreateChatRequestSchema>

// PATCH .../console/chats/[chatId] body: rename OR restore, never both in
// one call — restore is spelled `{ deletedAt: null }` (doc 29's own API
// table) rather than a boolean, so the wire shape has no other legal value.
export const PatchChatRequestSchema = z.union([
  z.object({ title: z.string().trim().min(1).max(CHAT_TITLE_MAX) }),
  z.object({ deletedAt: z.null() }),
])
export type PatchChatRequest = z.infer<typeof PatchChatRequestSchema>

// ── Pure helpers — DB-free, unit tested in lib/ai/console.test.ts ─────────

// Minimal shape chatDepth needs — routes pass their fetched
// house_console_chats rows (mapped to this) rather than this module knowing
// about Supabase row shapes.
export interface ChatNode {
  id: string
  parentChatId: string | null
}

// A root chat (no parent) is depth 0; each fork/seed is one more than its
// parent. Only ever walked over ACTIVE chats (routes filter deleted_at is
// null before calling this) — a chat can never be forked FROM a deleted
// parent (the routes reject that before reaching here), and DELETE's own
// re-parenting keeps every remaining chain pointing at a still-active
// ancestor, so the walk never needs to cross a deleted node. `seen` guards
// against a corrupt/cyclic chain rather than trusting the data is always
// well-formed.
export function chatDepth(chats: ChatNode[], startId: string): number {
  const byId = new Map(chats.map((c) => [c.id, c]))
  let depth = 0
  let current = byId.get(startId)
  const seen = new Set<string>()
  while (current?.parentChatId && !seen.has(current.id)) {
    seen.add(current.id)
    depth += 1
    current = byId.get(current.parentChatId)
  }
  return depth
}

// Whether forking/seeding FROM fromChatId would stay within
// MAX_CHAT_BRANCH_DEPTH — the child's depth would be chatDepth(fromChatId) + 1.
export function canBranchFrom(chats: ChatNode[], fromChatId: string): boolean {
  return chatDepth(chats, fromChatId) < MAX_CHAT_BRANCH_DEPTH
}

// Whether a house with this many ACTIVE chats has room for one more
// (a new chat, a fork/seed, or a restore).
export function hasRoomForNewChat(activeChatCount: number): boolean {
  return activeChatCount < MAX_ACTIVE_CHATS_PER_HOUSE
}

// Fork copy semantics (doc 29 "Fork copies rows; it does not reference
// them"): every row of the source chat's own transcript, in order, up to
// and including the fork point. Returns [] when forkMessageId isn't among
// sourceRows at all — the route treats that as an invalid fork target
// (either a bad id, or a message that belongs to a different chat, since
// callers fetch sourceRows scoped to the one chat being forked).
export function messagesToFork<T extends { id: string }>(sourceRows: T[], forkMessageId: string): T[] {
  const idx = sourceRows.findIndex((r) => r.id === forkMessageId)
  return idx === -1 ? [] : sourceRows.slice(0, idx + 1)
}

// Soft-delete re-parenting (doc 29 "branches survive deletion"): a deleted
// chat's own direct children move to ITS parent — a single linked-list
// splice, not a cascade. The route applies this as one SQL UPDATE
// (`set parent_chat_id = :deletedChat.parentChatId where parent_chat_id =
// :deletedChatId`); this pure version exists so that one-line rule has a
// name and a test independent of the DB.
export function reparentChildren<T extends { id: string; parentChatId: string | null }>(
  chats: T[],
  deletedChatId: string
): T[] {
  const deleted = chats.find((c) => c.id === deletedChatId)
  const newParent = deleted ? deleted.parentChatId : null
  return chats.map((c) => (c.parentChatId === deletedChatId ? { ...c, parentChatId: newParent } : c))
}

// Bug fix (doc 29 "Two bugs found while planning" #1): both the GET and the
// POST context reload used to run
// `.order('created_at', { ascending: true }).limit(N)`, which is the OLDEST
// N rows, not the most recent — past N turns the console stopped seeing
// recent conversation and kept re-sending the beginning. The fix queries
// `ascending: false` (newest N, DB-side) and calls this to flip the page
// back to chronological order for display/prompting. Pure so the fix has a
// regression test independent of the DB.
export function toChronological<T>(descRows: T[]): T[] {
  return [...descRows].reverse()
}

// Title auto-derivation (doc 29's data-model table: "derived from the first
// user message, renameable"). A truncation, not a summary, so the title
// stays the person's own words — same rationale as lib/ai/chat.ts's
// titleFromQuestion, reimplemented here rather than imported so this file
// (the console's own contract) doesn't reach into an unrelated feature's
// module for one string helper.
export function titleFromMessage(message: string): string {
  const m = message.replace(/\s+/g, ' ').trim()
  if (m.length <= CHAT_TITLE_MAX) return m
  const cut = m.slice(0, CHAT_TITLE_MAX)
  const lastSpace = cut.lastIndexOf(' ')
  return `${cut.slice(0, lastSpace > 40 ? lastSpace : CHAT_TITLE_MAX).trimEnd()}…`
}
