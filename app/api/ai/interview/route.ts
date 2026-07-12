// POST /api/ai/interview — the context-intake interviewer. Asks one question at
// a time; when it has enough, returns a distilled `context` (summary + facts)
// that every other AI call then reads (invariant 4: pure, no DB writes). Only the
// distilled context persists — the transcript is ephemeral (privacy surface).

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { completeJSON, AiError } from '@/lib/ai/groq'
import { enforceAiLimit } from '@/lib/ai/limits'
import { PERSONA, INTERVIEW_BLOCK } from '@/lib/ai/prompts'
import { serializeHouseForPrompt, type HouseForPrompt } from '@/lib/ai/serialize'

export const maxDuration = 30

const MAX_BODY_BYTES = 100 * 1024
const MAX_TRANSCRIPT = 12

const RequestSchema = z.object({
  house: z.record(z.string(), z.unknown()),
  transcript: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string(),
    })
  ),
  forceSummary: z.boolean().optional(),
})

// context is non-null iff done (enforced by the prompt; client only acts on a
// non-null context).
const InterviewResponseSchema = z.object({
  reply: z.string(),
  done: z.boolean(),
  context: z
    .object({ summary: z.string(), facts: z.array(z.string()) })
    .nullable(),
})

export async function POST(req: Request): Promise<Response> {
  try {
    await enforceAiLimit(req)
  } catch (err) {
    if (err instanceof AiError) return NextResponse.json({ error: err.message }, { status: err.status })
    throw err
  }

  const raw = await req.text()
  if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'payload-too-large' }, { status: 413 })
  }

  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 })
  }

  const parsed = RequestSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid-request' }, { status: 400 })
  }
  const { house, transcript, forceSummary } = parsed.data

  if (transcript.length > MAX_TRANSCRIPT) {
    return NextResponse.json({ error: 'transcript-too-long' }, { status: 413 })
  }

  // completeJSON takes a single user message, so the running conversation is
  // folded into the prompt rather than sent as chat turns.
  const convo =
    transcript.length === 0
      ? '(no conversation yet — ask your first question)'
      : transcript
          .map((t) => `${t.role === 'user' ? 'Person' : 'Co-pilot'}: ${t.content}`)
          .join('\n')

  const system = forceSummary
    ? `${PERSONA}\n\n${INTERVIEW_BLOCK}\n\nYou must finish NOW: set done=true and produce the context.`
    : `${PERSONA}\n\n${INTERVIEW_BLOCK}`

  // The closing directive goes LAST in the user message (most recent instruction)
  // so a low-effort model reliably wraps up instead of asking another question.
  const closing = forceSummary
    ? 'STOP INTERVIEWING. Do NOT ask another question. Set done=true and output context (summary + facts) now, using only what has already been said.'
    : 'Produce the next interview step as JSON.'
  const user = `${serializeHouseForPrompt(house as HouseForPrompt)}\n\n## Conversation so far\n${convo}\n\n${closing}`

  try {
    const result = await completeJSON({
      role: 'coach',
      system,
      user,
      schema: InterviewResponseSchema,
      schemaName: 'interview_step',
      effort: 'low',
      maxTokens: 600,
    })
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof AiError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: 'ai-upstream-error' }, { status: 502 })
  }
}
