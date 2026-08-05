// POST /api/admin/reasoning/runs/[id]/synthesis — generate (or return the
// cached) multi-agent pro/con synthesis of a finished reasoning-pipeline run.
// Admin-only. maxDuration=60 (not the pipeline route's 30s): this fires 4
// completeJSON calls in two sequential rounds (3 parallel + 1 consolidator),
// wider than any single pipeline step but still one request — no client-
// driven step loop needed for a one-shot synthesis.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { isCallerAdmin } from '@/lib/auth/admin'
import { AiError } from '@/lib/ai/router'
import { log } from '@/lib/log'
import { getReasoningRun, persistSynthesis } from '@/lib/ai/reasoning/persistence'
import { generateProConSynthesis } from '@/lib/ai/reasoning/synthesis'
import type { RunState } from '@/components/admin/reasoning/ReasoningStagesList'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

const IdSchema = z.string().uuid()

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const runState = run.runState as RunState
  if (run.status !== 'done' || runState.finalAnswer == null) {
    return NextResponse.json({ error: 'run-not-finished' }, { status: 409 })
  }

  // Cached: repeat visits never re-spend the 4 AI calls.
  if (run.synthesis != null) {
    return NextResponse.json({ synthesis: run.synthesis, cached: true })
  }

  try {
    const synthesis = await generateProConSynthesis(runState)
    const persisted = await persistSynthesis(parsed.data, synthesis)
    if (!persisted) {
      log.error('ai/reasoning/synthesis-route', 'generated synthesis but failed to persist it', { runId: parsed.data })
    }
    return NextResponse.json({ synthesis, cached: false })
  } catch (err) {
    if (err instanceof AiError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    log.error('ai/reasoning/synthesis-route', 'unhandled error', { runId: parsed.data, error: (err as Error)?.message })
    return NextResponse.json({ error: 'ai-upstream-error' }, { status: 502 })
  }
}
