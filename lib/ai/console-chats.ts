// Client-safe contract for the console's MULTIPLE CHATS surface (plan doc
// plans/active/reasoning-pipeline/29-console-multi-chat.md, migration 0041):
// a chat is a house_console_chats row, a house_console_messages row belongs
// to exactly one, and every route under app/api/houses/[id]/console/chats/
// shares the request/response shapes here.
//
// The pure helpers (chatDepth, messagesToFork, reparentChildren,
// toChronological, buildSidebarRows) hold the actual branching/caps/copy/
// window-fix logic so lib/ai/console.test.ts can cover it without a
// database — the routes are thin wrappers that call these with rows they
// already fetched. Split out of console.ts once that file passed the repo's
// ~600-line guideline; re-exported from it, so existing import sites are
// unaffected.

import { z } from 'zod'

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

// ── Sidebar tree (components/build/console/ChatSidebar.tsx renders these) ──
export function chatLabel(title: string): string {
  return title.trim().length > 0 ? title : 'Untitled chat'
}

export interface SidebarRow {
  chat: ChatSummary
  // TRUE nesting depth, not a flattened 0/1. Doc 29 originally specified a
  // single indent regardless of real depth; testing showed that makes a
  // branch-of-a-branch sit at the same level as a branch of the root, so a
  // sub-branch reads as though it had been branched off the original parent
  // instead of off the chat it actually came from. Depth is bounded by
  // MAX_CHAT_BRANCH_DEPTH server-side, so this cannot run away.
  depth: number
  // Direct parent's title, shown as "branched from …" on any nested row.
  parentTitle: string | null
}

// Depth-first walk, so every chat renders directly beneath its own parent.
// A chat whose parent is missing from the active set (soft-deleted, or an
// edge case) is treated as a root rather than being dropped.
export function buildSidebarRows(chats: ChatSummary[]): SidebarRow[] {
  const byId = new Map(chats.map((c) => [c.id, c]))

  const byLastMessageDesc = (a: ChatSummary, b: ChatSummary) =>
    new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()

  const childrenOf = new Map<string | null, ChatSummary[]>()
  for (const chat of chats) {
    const key = chat.parentChatId && byId.has(chat.parentChatId) ? chat.parentChatId : null
    childrenOf.set(key, [...(childrenOf.get(key) ?? []), chat])
  }
  for (const list of childrenOf.values()) list.sort(byLastMessageDesc)

  const rows: SidebarRow[] = []
  // A parent cycle can only come from corrupt data, but a recursive walk is
  // exactly where that would hang the page rather than just look wrong.
  const placed = new Set<string>()

  function walk(parentId: string | null, depth: number, parentTitle: string | null) {
    for (const chat of childrenOf.get(parentId) ?? []) {
      if (placed.has(chat.id)) continue
      placed.add(chat.id)
      rows.push({ chat, depth, parentTitle })
      walk(chat.id, depth + 1, chatLabel(chat.title))
    }
  }
  walk(null, 0, null)
  return rows
}
