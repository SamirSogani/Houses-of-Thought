// GET /api/admin/reasoning/runs — list past reasoning-pipeline runs
// (decision 019, Phase 2 item 1: plans/active/reasoning-pipeline/15-persistence.md).
// Summaries only (no run_state — that can run up to the 300KB request-body
// cap the pipeline route itself allows); a row's full packets/verdicts are
// fetched individually via runs/[id]. Admin-only.

import { NextResponse } from 'next/server'
import { isCallerAdmin } from '@/lib/auth/admin'
import { listReasoningRuns } from '@/lib/ai/reasoning/persistence'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!(await isCallerAdmin())) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  const runs = await listReasoningRuns()
  if (runs === null) {
    return NextResponse.json({ error: 'read-unavailable' }, { status: 502 })
  }
  return NextResponse.json({ runs })
}
