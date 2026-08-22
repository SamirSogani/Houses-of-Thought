// Pure-function coverage for the multi-chat console (plan doc
// plans/active/reasoning-pipeline/29-console-multi-chat.md): fork copy
// semantics, soft-delete re-parenting, the depth/count caps, and the
// transcript-window bug fix. Everything here is DB-free by construction —
// the routes (app/api/houses/[id]/console/chats/*) are thin wrappers over
// these same functions, exercised against Supabase rows they fetch
// themselves.

import { describe, expect, it } from 'vitest'
import {
  MAX_ACTIVE_CHATS_PER_HOUSE,
  MAX_CHAT_BRANCH_DEPTH,
  canBranchFrom,
  chatDepth,
  hasRoomForNewChat,
  messagesToFork,
  reparentChildren,
  titleFromMessage,
  toChronological,
  type ChatNode,
} from './console'

describe('chatDepth / canBranchFrom', () => {
  // root -> a -> b -> c (depth 0, 1, 2, 3)
  const chain: ChatNode[] = [
    { id: 'root', parentChatId: null },
    { id: 'a', parentChatId: 'root' },
    { id: 'b', parentChatId: 'a' },
    { id: 'c', parentChatId: 'b' },
  ]

  it('a root chat (no parent) is depth 0', () => {
    expect(chatDepth(chain, 'root')).toBe(0)
  })

  it('depth increases by one per fork/seed hop', () => {
    expect(chatDepth(chain, 'a')).toBe(1)
    expect(chatDepth(chain, 'b')).toBe(2)
    expect(chatDepth(chain, 'c')).toBe(3)
  })

  it('a corrupt cyclic chain does not infinite-loop', () => {
    const cyclic: ChatNode[] = [
      { id: 'x', parentChatId: 'y' },
      { id: 'y', parentChatId: 'x' },
    ]
    expect(chatDepth(cyclic, 'x')).toBeLessThanOrEqual(2)
  })

  it('allows branching below the cap and rejects at/above it', () => {
    // Build a chain of exactly MAX_CHAT_BRANCH_DEPTH hops below root.
    const deep: ChatNode[] = [{ id: 'n0', parentChatId: null }]
    for (let i = 1; i <= MAX_CHAT_BRANCH_DEPTH; i++) {
      deep.push({ id: `n${i}`, parentChatId: `n${i - 1}` })
    }
    // n0..n(MAX-1) are below the cap (depth 0..MAX-1); nMAX is AT the cap.
    expect(chatDepth(deep, `n${MAX_CHAT_BRANCH_DEPTH - 1}`)).toBe(MAX_CHAT_BRANCH_DEPTH - 1)
    expect(canBranchFrom(deep, `n${MAX_CHAT_BRANCH_DEPTH - 1}`)).toBe(true)
    expect(chatDepth(deep, `n${MAX_CHAT_BRANCH_DEPTH}`)).toBe(MAX_CHAT_BRANCH_DEPTH)
    expect(canBranchFrom(deep, `n${MAX_CHAT_BRANCH_DEPTH}`)).toBe(false)
  })
})

describe('hasRoomForNewChat', () => {
  it('allows creation below the cap and rejects at/above it', () => {
    expect(hasRoomForNewChat(MAX_ACTIVE_CHATS_PER_HOUSE - 1)).toBe(true)
    expect(hasRoomForNewChat(MAX_ACTIVE_CHATS_PER_HOUSE)).toBe(false)
    expect(hasRoomForNewChat(MAX_ACTIVE_CHATS_PER_HOUSE + 1)).toBe(false)
  })
})

describe('messagesToFork', () => {
  const rows = [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }, { id: 'm4' }]

  it('copies every row up to and including the fork point', () => {
    expect(messagesToFork(rows, 'm2')).toEqual([{ id: 'm1' }, { id: 'm2' }])
  })

  it('copies the whole transcript when forking from the last message', () => {
    expect(messagesToFork(rows, 'm4')).toEqual(rows)
  })

  it('returns nothing for a fork point not present in the source rows', () => {
    // Same shape as "message belongs to a different chat" — the route
    // scopes sourceRows to one chat before calling this, so a mismatched id
    // here is exactly what an invalid fromChatId/fromMessageId pairing
    // looks like.
    expect(messagesToFork(rows, 'does-not-exist')).toEqual([])
    expect(messagesToFork([], 'm1')).toEqual([])
  })
})

describe('reparentChildren', () => {
  it('moves a deleted chat’s direct children to its own parent', () => {
    const chats = [
      { id: 'root', parentChatId: null as string | null },
      { id: 'mid', parentChatId: 'root' },
      { id: 'child-a', parentChatId: 'mid' },
      { id: 'child-b', parentChatId: 'mid' },
      { id: 'unrelated', parentChatId: 'root' },
    ]
    const result = reparentChildren(chats, 'mid')
    expect(result.find((c) => c.id === 'child-a')?.parentChatId).toBe('root')
    expect(result.find((c) => c.id === 'child-b')?.parentChatId).toBe('root')
    // Untouched siblings/grandparent stay exactly as they were.
    expect(result.find((c) => c.id === 'unrelated')?.parentChatId).toBe('root')
    expect(result.find((c) => c.id === 'root')?.parentChatId).toBe(null)
  })

  it('re-parents to null when the deleted chat was itself a root', () => {
    const chats = [
      { id: 'root', parentChatId: null as string | null },
      { id: 'child', parentChatId: 'root' },
    ]
    const result = reparentChildren(chats, 'root')
    expect(result.find((c) => c.id === 'child')?.parentChatId).toBe(null)
  })

  it('is a no-op when the deleted id has no children', () => {
    const chats = [
      { id: 'root', parentChatId: null as string | null },
      { id: 'other', parentChatId: 'root' },
    ]
    expect(reparentChildren(chats, 'lonely')).toEqual(chats)
  })
})

describe('toChronological (transcript-window bug fix)', () => {
  it('flips DB-order (newest-first, from ascending:false + limit) back to chronological order', () => {
    // Simulates what `.order('created_at', { ascending: false }).limit(3)`
    // returns from a 5-row table: the newest 3, newest-first.
    const fullHistory = ['t1', 't2', 't3', 't4', 't5']
    const newestFirstPage = ['t5', 't4', 't3'] // what the fixed query returns
    expect(toChronological(newestFirstPage)).toEqual(fullHistory.slice(-3))
  })

  it('is its own inverse on an empty or single-row page', () => {
    expect(toChronological([])).toEqual([])
    expect(toChronological(['only'])).toEqual(['only'])
  })
})

describe('titleFromMessage', () => {
  it('passes short messages through untouched', () => {
    expect(titleFromMessage('Why is this here?')).toBe('Why is this here?')
  })

  it('truncates a long message on a word break with an ellipsis', () => {
    const long = 'x'.repeat(200) + ' word'
    const title = titleFromMessage(long)
    expect(title.length).toBeLessThanOrEqual(121)
    expect(title.endsWith('…')).toBe(true)
  })
})
