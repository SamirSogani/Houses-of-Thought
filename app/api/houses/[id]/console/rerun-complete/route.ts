// POST /api/houses/[id]/console/rerun-complete — Loop B item 1b (plan doc
// plans/active/reasoning-pipeline/30-console-subagent-loops.md): once a
// confirmed rerun finishes, every ACTIVE chat of the house gets one
// role: 'system' marker row saying so, so a chat that was mid-conversation
// says it's stale rather than quietly going stale.
//
// The rerun itself completes CLIENT-side — useReasoningPipelineRunner's
// effect dispatches APPLY_RERUN_RESULT once nextStep === null, and
// ConsolePage saves the house from there (see that hook's own comment).
// There is no server-side "rerun finished" event to hook into, so the
// client calls this small route once it observes phase === 'done'. What
// stays server-side, per this phase's own instruction, is exactly the two
// things that matter: which chats are "active" (a client-trusted list here
// would let a stale tab mark chats it can no longer see) and the marker text
// itself (rerunMarkerMessage, lib/ai/console.ts) — the client sends only the
// stage that was rerun.
//
// Same authorize() as every other route in this family (./  ../authorize) —
// no new authorization surface. Not an AI route (no completeJSON call), so
// no enforceAiLimit — matches chats/route.ts and chats/[chatId]/route.ts,
// the other non-AI routes under this family.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { log } from '@/lib/log'
import { RerunCompleteRequestSchema, rerunMarkerMessage } from '@/lib/ai/console'
import { authorize } from '../authorize'

const HouseIdSchema = z.string().uuid()

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
  const parsed = RerunCompleteRequestSchema.safeParse(json)
  if (!parsed.success) return NextResponse.json({ error: 'invalid-request' }, { status: 400 })
  const { stage } = parsed.data

  const supabase = await createClient()
  const authz = await authorize(supabase, houseId)
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status })

  const {
    data: { user },
  } = await supabase.auth.getUser()
  const userId = user!.id

  // "every active chat" (doc 30) — deliberately not soft-deleted ones (doc
  // 30's own "Open questions" leaves that as unresolved future work, not a
  // decision made here).
  const { data: activeChats, error: chatsError } = await supabase
    .from('house_console_chats')
    .select('id')
    .eq('house_id', houseId)
    .is('deleted_at', null)
  if (chatsError) {
    log.error('houses/console', 'rerun-complete chat load failed', { error: chatsError.message })
    return NextResponse.json({ error: 'server-error' }, { status: 500 })
  }
  const chatIds = (activeChats as { id: string }[]).map((c) => c.id)
  if (chatIds.length === 0) return NextResponse.json({ ok: true, chatsMarked: 0 })

  const message = rerunMarkerMessage(stage)
  const rows = chatIds.map((chatId) => ({
    house_id: houseId,
    chat_id: chatId,
    role: 'system' as const,
    message,
    created_by: userId,
  }))
  const { error: insertError } = await supabase.from('house_console_messages').insert(rows)
  if (insertError) {
    log.error('houses/console', 'rerun-complete marker insert failed', { error: insertError.message })
    return NextResponse.json({ error: 'server-error' }, { status: 500 })
  }

  // Bookkeeping only (sidebar ordering) — deliberately NOT touching
  // run_id_at_last_reply: that field means "the last ASSISTANT reply here
  // reflects the current run," and inserting a marker doesn't make that
  // true — only a genuine new reply after the rerun does. Leaving it alone
  // keeps the "stale" badge (GET .../console/chats) honest even after the
  // marker lands; the two are complementary, not redundant — the badge says
  // the chat is out of date, the marker says exactly where.
  const { error: touchError } = await supabase
    .from('house_console_chats')
    .update({ last_message_at: new Date().toISOString() })
    .in('id', chatIds)
  if (touchError) {
    log.error('houses/console', 'rerun-complete chat touch failed (non-fatal)', { error: touchError.message })
  }

  return NextResponse.json({ ok: true, chatsMarked: chatIds.length })
}
