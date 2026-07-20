// POST /api/admin/chat-conclusions — House Chat's opt-in conclusion candidates
// (decision 018). This is the second sanctioned Author use after the strawman:
// the AI drafts 2-4 genuinely disagreeing candidate conclusions, each grounded
// in the WHOLE house with its own trailing implications. Fencing, in order:
// admin-only (403 before any quota is spent), per-question opt-in on the client,
// plural-only output, and adoption is a human click that maps onto existing
// reducer actions — the shared AiActionSchema still cannot express a conclusion,
// so no other surface gains this capability.
//
// Pure function (invariant 4): house JSON in, candidates out, no DB writes.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { completeJSON, AiError } from '@/lib/ai/router'
import { enforceAiLimit } from '@/lib/ai/limits'
import { isCallerAdmin } from '@/lib/auth/admin'
import { CHAT_CONCLUSIONS_SYSTEM } from '@/lib/ai/prompts'
import { serializeHouseForPrompt, type HouseForPrompt } from '@/lib/ai/serialize'
import { ChatConclusionsResponseSchema } from '@/lib/ai/chat'

export const maxDuration = 30

// Same cap as the draft route — the payload is a full house.
const MAX_BODY_BYTES = 100 * 1024

const AiContextSchema = z.object({
  summary: z.string(),
  facts: z.array(z.string()),
})

const RequestSchema = z.object({
  house: z.record(z.string(), z.unknown()),
  aiContext: AiContextSchema.nullish(),
})

export async function POST(req: Request): Promise<Response> {
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
  const { house, aiContext } = parsed.data

  const houseForPrompt: HouseForPrompt = {
    ...(house as HouseForPrompt),
    aiContext: aiContext ?? (house as HouseForPrompt).aiContext ?? null,
  }
  // Focus marker on the Conclusion step (5) — candidates answer that layer.
  const user = serializeHouseForPrompt(houseForPrompt, 5)

  try {
    const result = await completeJSON({
      role: 'drafter',
      system: CHAT_CONCLUSIONS_SYSTEM,
      user,
      schema: ChatConclusionsResponseSchema,
      schemaName: 'chat_conclusions',
      effort: 'high',
      maxTokens: 4000,
    })
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof AiError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: 'ai-upstream-error' }, { status: 502 })
  }
}
