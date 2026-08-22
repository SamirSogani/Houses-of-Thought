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
//
// The actual marker-insertion body now lives in ../rerunComplete.ts
// (plan doc plans/active/reasoning-pipeline/31-console-sandbox-reruns.md,
// Trap 6) — promoting a sandbox candidate needs the exact same "mark every
// active chat" behavior, and reuses this same helper rather than a second
// copy. This route is now a thin wrapper: parse, authorize, call, respond.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { RerunCompleteRequestSchema } from '@/lib/ai/console'
import { authorize } from '../authorize'
import { insertRerunCompleteMarker } from '../rerunComplete'

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

  const result = await insertRerunCompleteMarker(supabase, houseId, stage, userId)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ ok: true, chatsMarked: result.chatsMarked })
}
