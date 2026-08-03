// GET /api/admin/reasoning/runs/[id] — one past run's full packets/verdicts
// (decision 019, Phase 2 item 1: plans/active/reasoning-pipeline/15-persistence.md).
// Admin-only.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { isCallerAdmin } from '@/lib/auth/admin'
import { getReasoningRun } from '@/lib/ai/reasoning/persistence'

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
