// Shared helper behind BOTH "a rerun finished" paths that need to post the
// same role: 'system' marker into every active chat of a house — the real
// rerun's own completion route (./rerun-complete/route.ts, Loop B item 1b,
// plan doc plans/active/reasoning-pipeline/30-console-subagent-loops.md) and
// promoting a sandbox candidate (./candidate/promote/route.ts, Loop C, plan
// doc plans/active/reasoning-pipeline/31-console-sandbox-reruns.md, Trap 6:
// "Promoting changes the house for every chat... reuse that route, don't
// write a second one"). Extracted verbatim out of rerun-complete/route.ts's
// own body — same function, not a second copy — a plain module (not a
// route.ts) so it's an ordinary importable helper, same pattern as
// ./authorize.ts one directory up.
//
// Deliberately takes the caller's OWN already-authorized Supabase client and
// userId rather than doing its own auth — both call sites have already run
// authorize() and loaded the user by the time they reach here; this is pure
// "what to do once we know who's asking," not a second authorization gate.

import { createClient } from '@/lib/supabase/server'
import { log } from '@/lib/log'
import { rerunMarkerMessage } from '@/lib/ai/console'
import type { DraftStage } from '@/lib/ai/draft'

export type InsertRerunMarkerResult = { ok: true; chatsMarked: number } | { ok: false; error: string; status: number }

export async function insertRerunCompleteMarker(
  supabase: Awaited<ReturnType<typeof createClient>>,
  houseId: string,
  stage: DraftStage,
  userId: string
): Promise<InsertRerunMarkerResult> {
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
    return { ok: false, error: 'server-error', status: 500 }
  }
  const chatIds = (activeChats as { id: string }[]).map((c) => c.id)
  if (chatIds.length === 0) return { ok: true, chatsMarked: 0 }

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
    return { ok: false, error: 'server-error', status: 500 }
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

  return { ok: true, chatsMarked: chatIds.length }
}
