// POST /api/ai/interview — the context-intake interviewer. Asks one question at
// a time; when it has enough, returns a distilled `context` (summary + facts)
// that every other AI call then reads (invariant 4: pure, no DB writes). Only the
// distilled context persists — the transcript is ephemeral (privacy surface).

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { completeJSON, AiError } from '@/lib/ai/router'
import { enforceAiLimit } from '@/lib/ai/limits'
import { PERSONA, INTERVIEW_BLOCK } from '@/lib/ai/prompts'
import { serializeHouseForPrompt, type HouseForPrompt } from '@/lib/ai/serialize'

export const maxDuration = 30

// Body cap is now generous: an oversized prompt routes to Gemini's ~1M window
// (size-aware routing in lib/ai/router.ts), so we no longer need a tight 100 KB
// ceiling — only an abuse guard.
const MAX_BODY_BYTES = 512 * 1024
// At/above SOFT we conclude the interview gracefully (force the summary) rather
// than erroring, so a long conversation never loses the context gathered so far.
// HARD is a true abuse ceiling that still rejects.
const SOFT_TRANSCRIPT = 14
const HARD_TRANSCRIPT = 60
// Recent turns kept verbatim in the prompt; older ones are condensed so prompt
// size (and cost) stays bounded regardless of conversation length.
const PROMPT_KEEP_RECENT = 10

type Turn = { role: 'user' | 'assistant'; content: string }

// Fold a long transcript to its opening turn + the most recent PROMPT_KEEP_RECENT,
// eliding the middle. Keeps the prompt bounded; the intake still concludes from
// what was said (the model is told to summarise from the conversation so far).
function buildConvo(transcript: Turn[]): string {
  if (transcript.length === 0) return '(no conversation yet — ask your first question)'
  const fmt = (t: Turn) => `${t.role === 'user' ? 'Person' : 'Co-pilot'}: ${t.content}`
  if (transcript.length <= PROMPT_KEEP_RECENT + 1) return transcript.map(fmt).join('\n')
  const head = fmt(transcript[0])
  const recent = transcript.slice(-PROMPT_KEEP_RECENT).map(fmt).join('\n')
  return `${head}\n(…earlier turns condensed for length…)\n${recent}`
}

const RequestSchema = z.object({
  house: z.record(z.string(), z.unknown()),
  transcript: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      // Bounds one pasted turn: without this, a single turn under the 512 KB
      // body cap could push ~125k input tokens onto the large-window lane.
      content: z.string().max(4000),
    })
  ),
  forceSummary: z.boolean().optional(),
})

// context is non-null iff done — enforced by the refine, not just the prompt:
// a done+null reply fails the parse and rides completeJSON's self-correction
// retry instead of reaching the client, which would treat it as "another turn"
// and loop paid wrap-up calls. (The refine is parse-only; z.toJSONSchema skips
// it, so the schema sent to providers is unchanged.)
const InterviewResponseSchema = z
  .object({
    reply: z.string(),
    done: z.boolean(),
    context: z
      .object({ summary: z.string(), facts: z.array(z.string()) })
      .nullable(),
  })
  .refine((r) => !r.done || r.context !== null, {
    message: 'context must be non-null when done is true',
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

  // Only reject on genuine abuse. A merely-long interview wraps up gracefully
  // below instead of 413-ing, so the intake work is never lost.
  if (transcript.length > HARD_TRANSCRIPT) {
    return NextResponse.json({ error: 'transcript-too-long' }, { status: 413 })
  }
  const mustWrapUp = forceSummary || transcript.length >= SOFT_TRANSCRIPT

  // completeJSON takes a single user message, so the running conversation is
  // folded (and, when long, condensed) into the prompt rather than sent as turns.
  const convo = buildConvo(transcript as Turn[])

  const system = mustWrapUp
    ? `${PERSONA}\n\n${INTERVIEW_BLOCK}\n\nYou must finish NOW: set done=true and produce the context.`
    : `${PERSONA}\n\n${INTERVIEW_BLOCK}`

  // The closing directive goes LAST in the user message (most recent instruction)
  // so a low-effort model reliably wraps up instead of asking another question.
  const closing = mustWrapUp
    ? 'STOP INTERVIEWING. Do NOT ask another question. Set done=true and output context (summary + facts) now, using only what has already been said.'
    : 'Produce the next interview step as JSON.'
  const user = `${serializeHouseForPrompt(house as HouseForPrompt)}\n\n## Conversation so far\n${convo}\n\n${closing}`

  try {
    // Context-intake can accumulate a large prompt (house + transcript). The
    // router is size-aware: if this exceeds the fast model's window it routes to
    // Gemini's ~1M window automatically, and a genuine overflow escalates rather
    // than erroring — so no special handling is needed here.
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
