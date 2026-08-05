// POST /api/admin/reasoning/runs/[id]/ask {question} — the synthesis page's
// ask-AI sidebar. Admin-only. Requires a synthesis to already exist (the
// sidebar only mounts once one has been generated) — grounds the answer in
// the run's own material + the synthesis + the prior conversation, then
// persists both the question and the answer as one appendSynthesisChat call.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { isCallerAdmin } from '@/lib/auth/admin'
import { AiError } from '@/lib/ai/router'
import { log } from '@/lib/log'
import { getReasoningRun, appendSynthesisChat } from '@/lib/ai/reasoning/persistence'
import { answerSynthesisQuestion, type SynthesisChatTurn } from '@/lib/ai/reasoning/synthesis'
import type { RunState } from '@/components/admin/reasoning/ReasoningStagesList'

export const maxDuration = 30
export const dynamic = 'force-dynamic'

const IdSchema = z.string().uuid()
const RequestSchema = z.object({ question: z.string().min(1).max(2000) })

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
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
  const bodyParsed = RequestSchema.safeParse(json)
  if (!bodyParsed.success) {
    return NextResponse.json({ error: 'invalid-request' }, { status: 400 })
  }

  const run = await getReasoningRun(idParsed.data)
  if (run === null) {
    return NextResponse.json({ error: 'not-found' }, { status: 404 })
  }
  if (run.synthesis == null) {
    return NextResponse.json({ error: 'synthesis-not-generated' }, { status: 409 })
  }

  const { question } = bodyParsed.data
  try {
    const answer = await answerSynthesisQuestion(run.runState as RunState, run.synthesis, run.synthesisChat, question)

    const now = new Date().toISOString()
    const turns: SynthesisChatTurn[] = [
      { role: 'user', content: question, at: now },
      { role: 'assistant', content: answer, at: now },
    ]
    const persisted = await appendSynthesisChat(idParsed.data, turns)
    if (!persisted) {
      log.error('ai/reasoning/ask-route', 'answered but failed to persist the chat turn', { runId: idParsed.data })
    }
    return NextResponse.json({ answer })
  } catch (err) {
    if (err instanceof AiError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    log.error('ai/reasoning/ask-route', 'unhandled error', { runId: idParsed.data, error: (err as Error)?.message })
    return NextResponse.json({ error: 'ai-upstream-error' }, { status: 502 })
  }
}
