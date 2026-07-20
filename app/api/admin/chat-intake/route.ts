// POST /api/admin/chat-intake — House Chat's conversational intake (decision
// 017). Admin-only beta: gated by isCallerAdmin() like every /api/admin route
// (403, matching ai-status — the page itself 404s). Pure function (invariant 4):
// transcript in, either one clarify message or the extracted build inputs out;
// never writes the DB. The house's question/purpose are clamped server-side to
// verbatim spans of the person's turns (lib/ai/chat.ts), so invariant 1 — the
// AI never writes question or purpose — holds in code, not just in the prompt.
//
// At most ONE clarify round: once the transcript contains an assistant turn,
// the model is forced to extract, so a chatty model can never loop paid turns.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { completeJSON, AiError } from '@/lib/ai/router'
import { enforceAiLimit } from '@/lib/ai/limits'
import { isCallerAdmin } from '@/lib/auth/admin'
import { PERSONA, CHAT_INTAKE_BLOCK } from '@/lib/ai/prompts'
import {
  ChatIntakeModelSchema,
  clampPurpose,
  clampQuestion,
  type ChatIntakeResponse,
  type ChatTurn,
} from '@/lib/ai/chat'

export const maxDuration = 30

// Transcript-only payload — far smaller than the house-carrying AI routes.
const MAX_BODY_BYTES = 64 * 1024
const MAX_TURNS = 20

const RequestSchema = z.object({
  transcript: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        // Same single-turn bound as the interview route.
        content: z.string().max(4000),
      })
    )
    .max(MAX_TURNS),
})

function renderConvo(transcript: ChatTurn[]): string {
  return transcript
    .map((t) => `${t.role === 'user' ? 'Person' : 'Co-pilot'}: ${t.content}`)
    .join('\n')
}

export async function POST(req: Request): Promise<Response> {
  // Operator gate first (this is an /api/admin route), then the pooled AI cap —
  // the beta still spends real lane quota and must stay inside it.
  if (!(await isCallerAdmin())) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
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
  const transcript = parsed.data.transcript as ChatTurn[]
  if (!transcript.some((t) => t.role === 'user')) {
    return NextResponse.json({ error: 'invalid-request' }, { status: 400 })
  }

  const mustExtract = transcript.some((t) => t.role === 'assistant')

  const system = mustExtract
    ? `${PERSONA}\n\n${CHAT_INTAKE_BLOCK}\n\nYou must finish NOW: set done=true and extract.`
    : `${PERSONA}\n\n${CHAT_INTAKE_BLOCK}`
  const closing = mustExtract
    ? 'DO NOT ask anything further. Set done=true and extract question, purpose, and context from what has already been said.'
    : 'Produce the next intake step as JSON.'
  const user = `## Conversation so far\n${renderConvo(transcript)}\n\n${closing}`

  try {
    const result = await completeJSON({
      role: 'coach',
      system,
      user,
      schema: ChatIntakeModelSchema,
      schemaName: 'chat_intake',
      effort: 'low',
      maxTokens: 600,
    })

    if (!result.done && !mustExtract) {
      const body: ChatIntakeResponse = { done: false, reply: result.reply }
      return NextResponse.json(body)
    }

    // Done (or forced): clamp the extraction to the person's own words. When a
    // wrap-up-refusing model left context null on a forced turn, degrade to the
    // person's last turn as summary — still their words, and the drafter treats
    // context as optional anyway.
    const question = clampQuestion(result.question, transcript)
    if (!question) {
      return NextResponse.json({ error: 'ai-invalid-output' }, { status: 502 })
    }
    const body: ChatIntakeResponse = {
      done: true,
      question,
      purpose: clampPurpose(result.purpose, transcript),
      context: result.context ?? { summary: question, facts: [] },
    }
    return NextResponse.json(body)
  } catch (err) {
    if (err instanceof AiError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: 'ai-upstream-error' }, { status: 502 })
  }
}
