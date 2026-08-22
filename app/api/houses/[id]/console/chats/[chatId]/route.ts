// PATCH/DELETE /api/houses/[id]/console/chats/[chatId] — rename/restore and
// soft-delete a single chat (plan doc
// plans/active/reasoning-pipeline/29-console-multi-chat.md, migration 0041).
//
// PATCH takes EITHER `{ title }` (rename) OR `{ deletedAt: null }` (restore)
// — PatchChatRequestSchema (lib/ai/console.ts) is a union of exactly those
// two shapes, never both in one call.
//
// DELETE soft-deletes (`deleted_at = now()`) and re-parents the deleted
// chat's own direct children to ITS parent — "branches survive deletion"
// (doc 29). Both PATCH and DELETE are idempotent: restoring an already-
// active chat, or deleting an already-deleted one, succeeds as a no-op
// rather than erroring, since a double-click or a stale UI shouldn't surface
// as a failure.
//
// Same authorize() as the console route and chats/route.ts (./authorize.ts,
// one level up) — no new authorization surface.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { log } from '@/lib/log'
import { PatchChatRequestSchema, hasRoomForNewChat, type ChatOrigin, type ChatSummary } from '@/lib/ai/console'
import { authorize } from '../../authorize'

const HouseIdSchema = z.string().uuid()
const ChatIdSchema = z.string().uuid()

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

function toSummary(row: ChatRow): ChatSummary & { deletedAt: string | null } {
  return {
    id: row.id,
    title: row.title,
    origin: row.origin,
    parentChatId: row.parent_chat_id,
    branchedFromMessageId: row.branched_from_message_id,
    lastMessageAt: row.last_message_at,
    turnCount: 0, // not recomputed on a rename/restore/delete response — the sidebar keeps its own count from the list GET.
    stale: false,
    createdAt: row.created_at,
    deletedAt: row.deleted_at,
  }
}

async function loadChat(
  supabase: Awaited<ReturnType<typeof createClient>>,
  houseId: string,
  chatId: string
): Promise<{ ok: true; row: ChatRow } | { ok: false; error: string; status: number }> {
  const { data, error } = await supabase
    .from('house_console_chats')
    .select(
      'id, title, origin, parent_chat_id, branched_from_message_id, run_id_at_last_reply, created_at, updated_at, last_message_at, deleted_at'
    )
    .eq('id', chatId)
    .eq('house_id', houseId)
    .maybeSingle()
  if (error) {
    log.error('houses/console/chats', 'chat lookup failed', { error: error.message })
    return { ok: false, error: 'server-error', status: 500 }
  }
  if (!data) return { ok: false, error: 'chat-not-found', status: 404 }
  return { ok: true, row: data as ChatRow }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; chatId: string }> }
): Promise<Response> {
  const { id: houseIdParam, chatId: chatIdParam } = await params
  const houseIdParsed = HouseIdSchema.safeParse(houseIdParam)
  const chatIdParsed = ChatIdSchema.safeParse(chatIdParam)
  if (!houseIdParsed.success || !chatIdParsed.success) {
    return NextResponse.json({ error: 'invalid-request' }, { status: 400 })
  }
  const houseId = houseIdParsed.data
  const chatId = chatIdParsed.data

  let json: unknown
  try {
    json = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 })
  }
  const parsed = PatchChatRequestSchema.safeParse(json)
  if (!parsed.success) return NextResponse.json({ error: 'invalid-request' }, { status: 400 })
  const body = parsed.data

  const supabase = await createClient()
  const authz = await authorize(supabase, houseId)
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status })

  const loaded = await loadChat(supabase, houseId, chatId)
  if (!loaded.ok) return NextResponse.json({ error: loaded.error }, { status: loaded.status })
  const chat = loaded.row

  if ('title' in body) {
    const { data, error } = await supabase
      .from('house_console_chats')
      .update({ title: body.title })
      .eq('id', chatId)
      .select(
        'id, title, origin, parent_chat_id, branched_from_message_id, run_id_at_last_reply, created_at, updated_at, last_message_at, deleted_at'
      )
      .single()
    if (error) {
      log.error('houses/console/chats', 'rename failed', { error: error.message })
      return NextResponse.json({ error: 'server-error' }, { status: 500 })
    }
    return NextResponse.json({ chat: toSummary(data as ChatRow) })
  }

  // Restore. Idempotent: an already-active chat is returned as-is.
  if (chat.deleted_at === null) return NextResponse.json({ chat: toSummary(chat) })

  const { count, error: countError } = await supabase
    .from('house_console_chats')
    .select('id', { count: 'exact', head: true })
    .eq('house_id', houseId)
    .is('deleted_at', null)
  if (countError) {
    log.error('houses/console/chats', 'active count load failed', { error: countError.message })
    return NextResponse.json({ error: 'server-error' }, { status: 500 })
  }
  if (!hasRoomForNewChat(count ?? 0)) {
    return NextResponse.json({ error: 'chat-limit-reached' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('house_console_chats')
    .update({ deleted_at: null })
    .eq('id', chatId)
    .select(
      'id, title, origin, parent_chat_id, branched_from_message_id, run_id_at_last_reply, created_at, updated_at, last_message_at, deleted_at'
    )
    .single()
  if (error) {
    log.error('houses/console/chats', 'restore failed', { error: error.message })
    return NextResponse.json({ error: 'server-error' }, { status: 500 })
  }
  return NextResponse.json({ chat: toSummary(data as ChatRow) })
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; chatId: string }> }
): Promise<Response> {
  const { id: houseIdParam, chatId: chatIdParam } = await params
  const houseIdParsed = HouseIdSchema.safeParse(houseIdParam)
  const chatIdParsed = ChatIdSchema.safeParse(chatIdParam)
  if (!houseIdParsed.success || !chatIdParsed.success) {
    return NextResponse.json({ error: 'invalid-request' }, { status: 400 })
  }
  const houseId = houseIdParsed.data
  const chatId = chatIdParsed.data

  const supabase = await createClient()
  const authz = await authorize(supabase, houseId)
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status })

  const loaded = await loadChat(supabase, houseId, chatId)
  if (!loaded.ok) return NextResponse.json({ error: loaded.error }, { status: loaded.status })
  const chat = loaded.row

  // Idempotent: a second DELETE on an already-deleted chat is a no-op
  // success, not an error — its children were already re-parented the first
  // time, and re-running that step would be harmless but pointless.
  if (chat.deleted_at !== null) return NextResponse.json({ ok: true })

  const { error: deleteError } = await supabase
    .from('house_console_chats')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', chatId)
  if (deleteError) {
    log.error('houses/console/chats', 'soft delete failed', { error: deleteError.message })
    return NextResponse.json({ error: 'server-error' }, { status: 500 })
  }

  // Re-parent direct children to THIS chat's own parent — a single
  // linked-list splice (lib/ai/console.ts's reparentChildren documents the
  // same rule as a pure, tested function; this is its SQL equivalent, since
  // every child gets the identical new parent value in one UPDATE rather
  // than a fetch-then-loop). Best-effort: the delete itself already
  // committed, and there is no cross-table transaction available here
  // without a new RPC (out of scope for this phase) — a failure is logged,
  // not surfaced as a request failure, since the delete the person asked
  // for did succeed.
  const { error: reparentError } = await supabase
    .from('house_console_chats')
    .update({ parent_chat_id: chat.parent_chat_id })
    .eq('parent_chat_id', chatId)
  if (reparentError) {
    log.error('houses/console/chats', 're-parent failed (non-fatal)', { error: reparentError.message })
  }

  return NextResponse.json({ ok: true })
}
