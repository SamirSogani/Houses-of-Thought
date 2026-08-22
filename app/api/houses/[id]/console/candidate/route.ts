// GET/POST/DELETE /api/houses/[id]/console/candidate — Loop C, sandbox
// reruns with a diff (plan doc
// plans/active/reasoning-pipeline/31-console-sandbox-reruns.md, migration
// 0043). A "candidate" is a reasoning_runs row marked is_candidate = true —
// a rerun that wrote nothing to the house, offered for promote/discard
// instead. Every read/write here goes through
// lib/ai/reasoning/persistence.ts's service-role functions, never a direct
// `supabase.from('reasoning_runs')` — that table has been deny-all RLS with
// NO grant to `authenticated` since 0030/0031, so a user-session client
// (this route's own `supabase`, used only for authorize()/chat lookups)
// could not read or write it even if this file tried to.
//
// GET returns the house's one live (unresolved) candidate, if it has been
// FINALIZED (chatId/stage/baseContent all set — see POST below); a
// still-running or just-finished-but-not-yet-finalized sandbox run isn't
// something the diff card can render yet, so GET treats it the same as "no
// candidate" rather than returning a partial shape callers would have to
// special-case.
//
// POST "finalizes" an already-finished sandbox run into an addressable
// candidate — attaches the chat that owns it, the stage it targeted, and
// the house-content snapshot to diff against. Called once by ConsolePage
// right after useReasoningPipelineRunner's sandbox run reaches phase:
// 'done' (that hook itself never writes this metadata — it only knows
// runId/runState, not which chat asked or what to diff against).
//
// DELETE discards the house's live candidate (candidate_resolution =
// 'discarded'). Idempotent: no live candidate to discard is a success, not
// an error, matching chats/[chatId]/route.ts's own DELETE posture.
//
// Promoting is a SEPARATE route (./promote/route.ts) — it does more than
// resolve this row (Trap 6: also posts the rerun-complete marker), and
// keeping it separate from this file's simpler CRUD keeps each route
// readable on its own.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { log } from '@/lib/log'
import { getLiveCandidateRun, finalizeCandidateRun, resolveCandidateRun } from '@/lib/ai/reasoning/persistence'
import { FinalizeCandidateRequestSchema, type CandidateSummary } from '@/lib/ai/console'
import type { DraftStage } from '@/lib/ai/draft'
import { authorize } from '../authorize'
import type { CandidateRunRow } from '@/lib/ai/reasoning/persistence'

const HouseIdSchema = z.string().uuid()

// null unless the row is genuinely ready to show (Trap: a candidate whose
// sandbox run hasn't finished, or has finished but not yet been finalized
// with a chat/stage/baseContent, has nothing a diff card can render).
function toSummary(row: CandidateRunRow): CandidateSummary | null {
  if (!row.chatId || !row.stage || row.baseContent === null || row.status !== 'done') return null
  return {
    runId: row.id,
    chatId: row.chatId,
    stage: row.stage as DraftStage,
    baseContent: row.baseContent as Record<string, unknown>,
    runState: row.runState,
    updatedAt: row.updatedAt,
  }
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id: houseIdParam } = await params
  const houseIdParsed = HouseIdSchema.safeParse(houseIdParam)
  if (!houseIdParsed.success) return NextResponse.json({ error: 'invalid-request' }, { status: 400 })
  const houseId = houseIdParsed.data

  const supabase = await createClient()
  const authz = await authorize(supabase, houseId)
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status })

  const row = await getLiveCandidateRun(houseId)
  return NextResponse.json({ candidate: row ? toSummary(row) : null })
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
  const parsed = FinalizeCandidateRequestSchema.safeParse(json)
  if (!parsed.success) return NextResponse.json({ error: 'invalid-request' }, { status: 400 })
  const { runId, chatId, stage, baseContent } = parsed.data

  const supabase = await createClient()
  const authz = await authorize(supabase, houseId)
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status })

  // The chat has to genuinely belong to this house and still be active —
  // same shape of check every other route in this family runs before
  // trusting a client-supplied chatId (console/route.ts, revise/route.ts).
  const { data: chatRow, error: chatError } = await supabase
    .from('house_console_chats')
    .select('id, deleted_at')
    .eq('id', chatId)
    .eq('house_id', houseId)
    .maybeSingle()
  if (chatError) {
    log.error('houses/console', 'candidate finalize: chat lookup failed', { error: chatError.message })
    return NextResponse.json({ error: 'server-error' }, { status: 500 })
  }
  if (!chatRow) return NextResponse.json({ error: 'chat-not-found' }, { status: 404 })
  if ((chatRow as { deleted_at: string | null }).deleted_at) {
    return NextResponse.json({ error: 'chat-deleted' }, { status: 409 })
  }

  const row = await finalizeCandidateRun(runId, houseId, chatId, stage, baseContent)
  if (!row) return NextResponse.json({ error: 'candidate-not-found' }, { status: 404 })
  const summary = toSummary(row)
  if (!summary) {
    // finalizeCandidateRun already required status: 'done', so this would
    // only happen if the update somehow raced itself — treat it the same as
    // "not found" rather than returning a shape the client can't use.
    return NextResponse.json({ error: 'candidate-not-found' }, { status: 404 })
  }
  return NextResponse.json({ candidate: summary })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id: houseIdParam } = await params
  const houseIdParsed = HouseIdSchema.safeParse(houseIdParam)
  if (!houseIdParsed.success) return NextResponse.json({ error: 'invalid-request' }, { status: 400 })
  const houseId = houseIdParsed.data

  const supabase = await createClient()
  const authz = await authorize(supabase, houseId)
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status })

  const live = await getLiveCandidateRun(houseId)
  // Idempotent: nothing live to discard is a success, matching
  // chats/[chatId]/route.ts's own DELETE posture — a double-click or a
  // stale UI shouldn't surface as a failure.
  if (!live) return NextResponse.json({ ok: true })

  await resolveCandidateRun(live.id, houseId, 'discarded')
  return NextResponse.json({ ok: true })
}
