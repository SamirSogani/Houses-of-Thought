// POST /api/houses/[id]/console/candidate/promote — Loop C, sandbox reruns
// with a diff (plan doc plans/active/reasoning-pipeline/31-console-sandbox-
// reruns.md, Trap 5 & 6).
//
// Trap 5, "promoting must not re-run anything": this route does NOT touch
// house content at all. The candidate is already computed and persisted
// (reasoning_runs.run_state) — ConsolePage applies it to the live house
// BEFORE calling this route, via the exact same client-side path a real
// rerun's completion already uses (dispatch({ type: 'APPLY_RERUN_RESULT',
// stages, actions }) against the live reducer, then the existing save()).
// This route's whole job is the two things that genuinely need a server
// round trip: mark the candidate resolved (so it stops being "the" live
// candidate — resolveCandidateRun, is_candidate stays true for the audit
// trail, only candidate_resolution flips) and post the completion marker
// (Trap 6: reuses ../rerunComplete.ts's insertRerunCompleteMarker, the exact
// function the real-rerun completion route already calls — not a second
// implementation of "mark every active chat").
//
// Same authorize()/service-role-only-reasoning_runs posture as
// ../route.ts's own header comment describes.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getLiveCandidateRun, resolveCandidateRun } from '@/lib/ai/reasoning/persistence'
import { PromoteCandidateRequestSchema } from '@/lib/ai/console'
import type { DraftStage } from '@/lib/ai/draft'
import { authorize } from '../../authorize'
import { insertRerunCompleteMarker } from '../../rerunComplete'

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
  const parsed = PromoteCandidateRequestSchema.safeParse(json)
  if (!parsed.success) return NextResponse.json({ error: 'invalid-request' }, { status: 400 })

  const supabase = await createClient()
  const authz = await authorize(supabase, houseId)
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status })

  const live = await getLiveCandidateRun(houseId)
  if (!live || !live.chatId || !live.stage || live.status !== 'done') {
    return NextResponse.json({ error: 'candidate-not-found' }, { status: 404 })
  }
  if (parsed.data.runId && parsed.data.runId !== live.id) {
    return NextResponse.json({ error: 'candidate-changed' }, { status: 409 })
  }

  const resolved = await resolveCandidateRun(live.id, houseId, 'promoted')
  if (!resolved) return NextResponse.json({ error: 'candidate-not-found' }, { status: 404 })

  const {
    data: { user },
  } = await supabase.auth.getUser()
  const userId = user!.id

  const result = await insertRerunCompleteMarker(supabase, houseId, live.stage as DraftStage, userId)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ ok: true, chatsMarked: result.chatsMarked })
}
