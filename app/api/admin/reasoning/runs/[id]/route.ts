// GET /api/admin/reasoning/runs/[id] — one past run's full packets/verdicts
// (decision 019, Phase 2 item 1: plans/active/reasoning-pipeline/15-persistence.md).
// PATCH — links the run to the House it was materialized into ("View in
// house"). Both admin-only.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { isCallerAdmin } from '@/lib/auth/admin'
import { getReasoningRun, linkReasoningRunToHouse } from '@/lib/ai/reasoning/persistence'

export const dynamic = 'force-dynamic'

const IdSchema = z.string().uuid()

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isCallerAdmin())) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  const { id } = await params
  const parsed = IdSchema.safeParse(id)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid-request' }, { status: 400 })
  }
  const run = await getReasoningRun(parsed.data)
  if (run === null) {
    return NextResponse.json({ error: 'not-found' }, { status: 404 })
  }
  return NextResponse.json({ run })
}

const PatchSchema = z.object({ houseId: z.string().uuid() })

// RunActions.tsx calls this right after it creates+saves the house (client-
// side, RLS requires auth.uid()=owner_id) — this route only records the
// link, service-role, since reasoning_runs is deny-all RLS. The conditional
// .is('house_id', null) update inside linkReasoningRunToHouse means a
// double-click race still converges on one winning house id; the losing
// call's response reports back the id that actually won, not its own.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isCallerAdmin())) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  const { id } = await params
  const idParsed = IdSchema.safeParse(id)
  if (!idParsed.success) {
    return NextResponse.json({ error: 'invalid-request' }, { status: 400 })
  }

  let json: unknown
  try {
    json = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 })
  }
  const bodyParsed = PatchSchema.safeParse(json)
  if (!bodyParsed.success) {
    return NextResponse.json({ error: 'invalid-request' }, { status: 400 })
  }

  const houseId = await linkReasoningRunToHouse(idParsed.data, bodyParsed.data.houseId)
  if (houseId === null) {
    return NextResponse.json({ error: 'link-failed' }, { status: 502 })
  }
  return NextResponse.json({ houseId })
}
