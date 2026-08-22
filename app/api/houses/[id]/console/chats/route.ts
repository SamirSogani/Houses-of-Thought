// GET/POST /api/houses/[id]/console/chats — the console's chat list (plan doc
// plans/active/reasoning-pipeline/29-console-multi-chat.md, migration 0041).
// GET lists this house's chats (active by default; ?deleted=true for the
// "Recently deleted" disclosure). POST creates one: 'new' (a fresh root chat,
// no parent), 'fork' (copies every message up to and including fromMessageId
// into a new chat — see messagesToFork's own comment, lib/ai/console.ts, for
// why a copy and not a reference), or 'seed' (branches off fromChatId with no
// message copy — doc 29's "lighter" option).
//
// Same authorize() as app/api/houses/[id]/console/route.ts (./authorize.ts) —
// no new authorization surface, just a second route family under it.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { log } from '@/lib/log'
import { getReasoningRunByHouseId } from '@/lib/ai/reasoning/persistence'
import {
  CreateChatRequestSchema,
  RECENTLY_DELETED_LIMIT,
  canBranchFrom,
  hasRoomForNewChat,
  messagesToFork,
  titleFromMessage,
  type ChatNode,
  type ChatOrigin,
  type ChatSummary,
} from '@/lib/ai/console'
import { authorize } from '../authorize'

const HouseIdSchema = z.string().uuid()

interface ChatRow {
  id: string
  title: string
  origin: ChatOrigin
  parent_chat_id: string | null
  branched_from_message_id: string | null
  run_id_at_last_reply: string | null
  created_at: string
  updated_at: string
  last_message_at: string
  deleted_at: string | null
}

interface MessageCopyRow {
  id: string
  role: string
  message: string
  actions: unknown
  rerun_proposal: unknown
  created_by: string | null
  created_at: string
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id: houseIdParam } = await params
  const houseIdParsed = HouseIdSchema.safeParse(houseIdParam)
  if (!houseIdParsed.success) return NextResponse.json({ error: 'invalid-request' }, { status: 400 })
  const houseId = houseIdParsed.data

  const supabase = await createClient()
  const authz = await authorize(supabase, houseId)
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status })

  const wantDeleted = new URL(req.url).searchParams.get('deleted') === 'true'

  let query = supabase
    .from('house_console_chats')
    .select(
      'id, title, origin, parent_chat_id, branched_from_message_id, run_id_at_last_reply, created_at, updated_at, last_message_at, deleted_at'
    )
    .eq('house_id', houseId)

  query = wantDeleted
    ? query.not('deleted_at', 'is', null).order('updated_at', { ascending: false }).limit(RECENTLY_DELETED_LIMIT)
    : query.is('deleted_at', null).order('last_message_at', { ascending: false })

  const { data, error } = await query
  if (error) {
    log.error('houses/console/chats', 'chat list load failed', { error: error.message })
    return NextResponse.json({ error: 'server-error' }, { status: 500 })
  }
  const rows = data as ChatRow[]

  // One grouped query for turn counts rather than one count() per chat.
  const chatIds = rows.map((r) => r.id)
  const counts = new Map<string, number>()
  if (chatIds.length > 0) {
    const { data: msgRows, error: countError } = await supabase
      .from('house_console_messages')
      .select('chat_id')
      .in('chat_id', chatIds)
    if (countError) {
      log.error('houses/console/chats', 'turn count load failed', { error: countError.message })
      return NextResponse.json({ error: 'server-error' }, { status: 500 })
    }
    for (const r of msgRows as { chat_id: string }[]) counts.set(r.chat_id, (counts.get(r.chat_id) ?? 0) + 1)
  }

  // "stale" only means anything for the active list — a deleted chat isn't
  // shown with a live composer to warn.
  const currentRunId = wantDeleted ? null : (await getReasoningRunByHouseId(houseId))?.id ?? null

  const chats: ChatSummary[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    origin: row.origin,
    parentChatId: row.parent_chat_id,
    branchedFromMessageId: row.branched_from_message_id,
    lastMessageAt: row.last_message_at,
    turnCount: counts.get(row.id) ?? 0,
    stale: currentRunId != null && row.run_id_at_last_reply != null && row.run_id_at_last_reply !== currentRunId,
    createdAt: row.created_at,
    deletedAt: row.deleted_at,
  }))
  return NextResponse.json({ chats })
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id: houseIdParam } = await params
  const houseIdParsed = HouseIdSchema.safeParse(houseIdParam)
  if (!houseIdParsed.success) return NextResponse.json({ error: 'invalid-request' }, { status: 400 })
  const houseId = houseIdParsed.data

  let json: unknown
  try {
    json = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 })
  }
  const parsed = CreateChatRequestSchema.safeParse(json)
  if (!parsed.success) return NextResponse.json({ error: 'invalid-request' }, { status: 400 })
  const body = parsed.data

  const supabase = await createClient()
  const authz = await authorize(supabase, houseId)
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status })

  const {
    data: { user },
  } = await supabase.auth.getUser()
  const userId = user!.id

  const { data: activeRows, error: activeError } = await supabase
    .from('house_console_chats')
    .select('id, title, parent_chat_id')
    .eq('house_id', houseId)
    .is('deleted_at', null)
  if (activeError) {
    log.error('houses/console/chats', 'active chat load failed', { error: activeError.message })
    return NextResponse.json({ error: 'server-error' }, { status: 500 })
  }
  const activeChats = activeRows as { id: string; title: string; parent_chat_id: string | null }[]

  if (!hasRoomForNewChat(activeChats.length)) {
    return NextResponse.json({ error: 'chat-limit-reached' }, { status: 400 })
  }

  let parentChatId: string | null = null
  let branchedFromMessageId: string | null = null
  let title = ''

  if (body.mode !== 'new') {
    const fromChat = activeChats.find((c) => c.id === body.fromChatId)
    if (!fromChat) return NextResponse.json({ error: 'chat-not-found' }, { status: 404 })
    const nodes: ChatNode[] = activeChats.map((c) => ({ id: c.id, parentChatId: c.parent_chat_id }))
    if (!canBranchFrom(nodes, fromChat.id)) {
      return NextResponse.json({ error: 'branch-depth-exceeded' }, { status: 400 })
    }
    parentChatId = fromChat.id
    title = fromChat.title ? `${fromChat.title} (branch)` : ''
    if (body.mode === 'fork') branchedFromMessageId = body.fromMessageId
  }

  const { data: newChatRow, error: insertChatError } = await supabase
    .from('house_console_chats')
    .insert({
      house_id: houseId,
      title,
      parent_chat_id: parentChatId,
      branched_from_message_id: branchedFromMessageId,
      origin: body.mode === 'new' ? 'root' : body.mode,
      created_by: userId,
    })
    .select(
      'id, title, origin, parent_chat_id, branched_from_message_id, run_id_at_last_reply, created_at, updated_at, last_message_at, deleted_at'
    )
    .single()
  if (insertChatError) {
    log.error('houses/console/chats', 'chat insert failed', { error: insertChatError.message })
    return NextResponse.json({ error: 'server-error' }, { status: 500 })
  }
  const newChat = newChatRow as ChatRow
  let turnCount = 0

  if (body.mode === 'fork') {
    // No cross-table transaction is available without a new RPC (out of
    // scope for this phase) — on a copy failure the empty chat row created
    // above is retired as a best-effort cleanup so a failed fork doesn't
    // leave an orphaned, message-less chat sitting in the list and counting
    // against the 20-active-chats cap.
    //
    // Retired by SOFT delete, not `.delete()`: this table grants only
    // select/insert/update to `authenticated` (migration 0041), deliberately
    // — chats are never hard-deleted in this product — so a `.delete()` here
    // would fail on the grant and silently leave the orphan behind, which is
    // the exact thing this cleanup exists to prevent.
    const { data: sourceRows, error: sourceError } = await supabase
      .from('house_console_messages')
      .select('id, role, message, actions, rerun_proposal, created_by, created_at')
      .eq('chat_id', body.fromChatId)
      .order('created_at', { ascending: true })
    if (sourceError) {
      log.error('houses/console/chats', 'fork source load failed', { error: sourceError.message })
      await supabase.from('house_console_chats').update({ deleted_at: new Date().toISOString() }).eq('id', newChat.id)
      return NextResponse.json({ error: 'server-error' }, { status: 500 })
    }

    const toCopy = messagesToFork(sourceRows as MessageCopyRow[], body.fromMessageId)
    if (toCopy.length === 0) {
      await supabase.from('house_console_chats').update({ deleted_at: new Date().toISOString() }).eq('id', newChat.id)
      return NextResponse.json({ error: 'invalid-request' }, { status: 400 })
    }

    const rowsToInsert = toCopy.map((r) => ({
      house_id: houseId,
      chat_id: newChat.id,
      role: r.role,
      message: r.message,
      actions: r.actions,
      rerun_proposal: r.rerun_proposal,
      created_by: r.created_by,
      created_at: r.created_at,
      origin_message_id: r.id,
    }))
    const { error: copyError } = await supabase.from('house_console_messages').insert(rowsToInsert)
    if (copyError) {
      log.error('houses/console/chats', 'fork copy failed', { error: copyError.message })
      await supabase.from('house_console_chats').update({ deleted_at: new Date().toISOString() }).eq('id', newChat.id)
      return NextResponse.json({ error: 'server-error' }, { status: 500 })
    }

    turnCount = rowsToInsert.length
    const lastCopied = rowsToInsert[rowsToInsert.length - 1]
    const firstUserMessage = toCopy.find((r) => r.role === 'user')
    const chatUpdate: Record<string, unknown> = { last_message_at: lastCopied.created_at }
    if (!newChat.title && firstUserMessage) chatUpdate.title = `${titleFromMessage(firstUserMessage.message)} (branch)`
    const { error: touchError } = await supabase.from('house_console_chats').update(chatUpdate).eq('id', newChat.id)
    if (touchError) {
      log.error('houses/console/chats', 'fork chat touch failed (non-fatal)', { error: touchError.message })
    } else {
      newChat.last_message_at = lastCopied.created_at as string
      if (typeof chatUpdate.title === 'string') newChat.title = chatUpdate.title
    }
  }

  const chat: ChatSummary = {
    id: newChat.id,
    title: newChat.title,
    origin: newChat.origin,
    parentChatId: newChat.parent_chat_id,
    branchedFromMessageId: newChat.branched_from_message_id,
    lastMessageAt: newChat.last_message_at,
    turnCount,
    stale: false,
    createdAt: newChat.created_at,
    deletedAt: newChat.deleted_at,
  }
  return NextResponse.json({ chat }, { status: 201 })
}
