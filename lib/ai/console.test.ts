// Pure-function coverage for the multi-chat console (plan doc
// plans/active/reasoning-pipeline/29-console-multi-chat.md): fork copy
// semantics, soft-delete re-parenting, the depth/count caps, and the
// transcript-window bug fix. Everything here is DB-free by construction —
// the routes (app/api/houses/[id]/console/chats/*) are thin wrappers over
// these same functions, exercised against Supabase rows they fetch
// themselves.
//
// Phase 2 (plan doc plans/active/reasoning-pipeline/30-console-subagent-
// loops.md) adds coverage for the same reason: the single-flight rerun
// lock's staleness window, the revise loop's iteration cap, the
// rerun-completion marker's stage targeting, and the revision-chain
// collapse grouping — all pure, all DB-free.

import { describe, expect, it } from 'vitest'
import {
  MAX_ACTIVE_CHATS_PER_HOUSE,
  MAX_CHAT_BRANCH_DEPTH,
  MAX_REVISE_ITERATIONS,
  STALE_RUN_LOCK_MS,
  canBranchFrom,
  chatDepth,
  groupRevisionChains,
  hasRoomForNewChat,
  messagesToFork,
  reparentChildren,
  rerunMarkerMessage,
  revisionCapReached,
  runLockBlocks,
  titleFromMessage,
  toChronological,
  type ChatNode,
  transcriptLine,
  buildSidebarRows,
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

describe('runLockBlocks (Loop B item 1a — single-flight rerun lock)', () => {
  const now = Date.parse('2026-08-22T12:00:00.000Z')

  it('never blocks when there is no other running row', () => {
    expect(runLockBlocks(null, 'incoming-run', now)).toBe(false)
  })

  it('never blocks a continuation of the SAME run, even if somehow passed in', () => {
    // The real caller (getConflictingRunningRun) already excludes the
    // incoming runId via its own query — this asserts the function's own
    // contract holds independent of that, per its header comment: "the one
    // line the whole lock's correctness rests on."
    const ownRow = { id: 'run-a', updatedAt: new Date(now).toISOString() }
    expect(runLockBlocks(ownRow, 'run-a', now)).toBe(false)
  })

  it('blocks a DIFFERENT run that is still fresh', () => {
    const other = { id: 'run-b', updatedAt: new Date(now - 60_000).toISOString() } // 1 minute old
    expect(runLockBlocks(other, 'run-a', now)).toBe(true)
  })

  it('does not block a DIFFERENT run once it is stale (>= STALE_RUN_LOCK_MS old)', () => {
    const justUnderStale = { id: 'run-b', updatedAt: new Date(now - (STALE_RUN_LOCK_MS - 1)).toISOString() }
    const exactlyStale = { id: 'run-b', updatedAt: new Date(now - STALE_RUN_LOCK_MS).toISOString() }
    expect(runLockBlocks(justUnderStale, 'run-a', now)).toBe(true)
    expect(runLockBlocks(exactlyStale, 'run-a', now)).toBe(false)
  })
})

describe('rerunMarkerMessage (Loop B item 1b — marker targeting)', () => {
  it('matches doc 30\'s own example text for the perspectives stage', () => {
    expect(rerunMarkerMessage('perspectives')).toBe(
      'Perspectives onward were regenerated; answers above may refer to the previous version.'
    )
  })

  it('names the SAME layer label RerunPanel already shows on the confirm card (concepts renders as "Frame")', () => {
    expect(rerunMarkerMessage('concepts')).toBe('Frame onward were regenerated; answers above may refer to the previous version.')
  })

  it('produces a distinct message per stage — the marker names what actually cascaded, not a generic notice', () => {
    const messages = new Set(
      (['concepts', 'perspectives', 'evidence', 'assumptions', 'implications'] as const).map(rerunMarkerMessage)
    )
    expect(messages.size).toBe(5)
  })
})

describe('revisionCapReached (Loop A — hard cap of MAX_REVISE_ITERATIONS)', () => {
  it('allows revising an original answer and every iteration below the cap', () => {
    for (let i = 0; i < MAX_REVISE_ITERATIONS; i++) {
      expect(revisionCapReached(i)).toBe(false)
    }
  })

  it('blocks at and above the cap', () => {
    expect(revisionCapReached(MAX_REVISE_ITERATIONS)).toBe(true)
    expect(revisionCapReached(MAX_REVISE_ITERATIONS + 1)).toBe(true)
  })
})

describe('groupRevisionChains (Loop A — earlier attempts collapse under a disclosure)', () => {
  it('returns nothing for a transcript with no revisions', () => {
    const turns = [
      { id: 'u1', revisesMessageId: null },
      { id: 'a1', revisesMessageId: null },
    ]
    expect(groupRevisionChains(turns)).toEqual([])
  })

  it('groups a single revision under its head, oldest-first', () => {
    const turns = [
      { id: 'a1', revisesMessageId: null }, // original answer
      { id: 'a2', revisesMessageId: 'a1' }, // one revision
    ]
    expect(groupRevisionChains(turns)).toEqual([{ headId: 'a2', earlierIds: ['a1'] }])
  })

  it('walks a full 3-iteration chain back to its root, in chronological order', () => {
    const turns = [
      { id: 'a1', revisesMessageId: null },
      { id: 'a2', revisesMessageId: 'a1' },
      { id: 'a3', revisesMessageId: 'a2' },
      { id: 'a4', revisesMessageId: 'a3' }, // the cap: a1 -> a2 -> a3 -> a4 is 3 revisions
    ]
    expect(groupRevisionChains(turns)).toEqual([{ headId: 'a4', earlierIds: ['a1', 'a2', 'a3'] }])
  })

  it('handles two independent chains in the same transcript', () => {
    const turns = [
      { id: 'a1', revisesMessageId: null },
      { id: 'a2', revisesMessageId: 'a1' },
      { id: 'b1', revisesMessageId: null },
      { id: 'b2', revisesMessageId: 'b1' },
    ]
    const groups = groupRevisionChains(turns)
    expect(groups).toHaveLength(2)
    expect(groups.find((g) => g.headId === 'a2')?.earlierIds).toEqual(['a1'])
    expect(groups.find((g) => g.headId === 'b2')?.earlierIds).toEqual(['b1'])
  })

  it('a corrupt cyclic chain does not infinite-loop (bounded by the seen guard)', () => {
    // x <-> y cycle back into each other; z is the genuine head (nothing
    // revises it) but walking backward from it hits the cycle.
    const turns = [
      { id: 'x', revisesMessageId: 'y' },
      { id: 'y', revisesMessageId: 'x' },
      { id: 'z', revisesMessageId: 'x' },
    ]
    const groups = groupRevisionChains(turns)
    expect(groups).toHaveLength(1)
    expect(groups[0].headId).toBe('z')
    expect(groups[0].earlierIds.length).toBeLessThanOrEqual(2)
  })
})

describe('transcriptLine', () => {
  it('labels the person and the co-pilot as themselves', () => {
    expect(transcriptLine('user', 'why is this here?')).toBe('Person: why is this here?')
    expect(transcriptLine('assistant', 'because X')).toBe('Co-pilot: because X')
  })

  it('never presents a system marker as something the co-pilot said', () => {
    // Loop B's rerun markers are product-generated; a two-way
    // user/not-user mapping would file them under 'Co-pilot:' and let the
    // model refer back to a line it never wrote.
    const line = transcriptLine('system', 'Frame onward was regenerated.')
    expect(line).toBe('[System note] Frame onward was regenerated.')
    expect(line).not.toContain('Co-pilot')
  })
})

describe('buildSidebarRows', () => {
  const chat = (id: string, parentChatId: string | null, lastMessageAt: string, title = '') =>
    ({ id, parentChatId, lastMessageAt, title }) as Parameters<typeof buildSidebarRows>[0][number]

  it('nests a branch under its own parent, not under the root', () => {
    // The bug this replaced: root > branch > sub-branch all rendered at one
    // flattened indent, so a sub-branch read as a branch of the original.
    const rows = buildSidebarRows([
      chat('root', null, '2026-08-22T10:00:00Z', 'Root'),
      chat('branch', 'root', '2026-08-22T10:01:00Z', 'Branch'),
      chat('sub', 'branch', '2026-08-22T10:02:00Z', 'Sub'),
    ])
    expect(rows.map((r) => [r.chat.id, r.depth])).toEqual([
      ['root', 0],
      ['branch', 1],
      ['sub', 2],
    ])
    expect(rows[2].parentTitle).toBe('Branch')
  })

  it('treats a chat whose parent is gone as a root rather than dropping it', () => {
    const rows = buildSidebarRows([
      chat('a', null, '2026-08-22T10:00:00Z', 'A'),
      chat('orphan', 'deleted-parent', '2026-08-22T10:05:00Z', 'Orphan'),
    ])
    expect(rows.map((r) => r.chat.id).sort()).toEqual(['a', 'orphan'])
    expect(rows.every((r) => r.depth === 0)).toBe(true)
  })

  it('terminates on a parent cycle instead of recursing forever', () => {
    const rows = buildSidebarRows([
      chat('x', 'y', '2026-08-22T10:00:00Z', 'X'),
      chat('y', 'x', '2026-08-22T10:01:00Z', 'Y'),
    ])
    // Neither is reachable from a real root; the walk must simply not hang.
    expect(rows.length).toBeLessThanOrEqual(2)
  })
})
