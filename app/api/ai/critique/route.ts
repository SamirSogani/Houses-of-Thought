// POST /api/ai/critique — the Socratic critic on the Review layer. At Review the
// co-pilot stops suggesting and starts challenging: it grades the whole house
// against the Paul–Elder standards and names the weakest link.
//
// COMMENTARY ONLY (invariant 6): this never feeds computeStrength — the
// deterministic House Strength score is untouched. Pure function: house in →
// critique out, no DB writes. Like /suggest, the response carries both renderings
// (note = Decide, question = Learn) and the client picks.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { completeJSON, AiError } from '@/lib/ai/groq'
import { enforceAiLimit } from '@/lib/ai/limits'
import { PERSONA, CRITIQUE_BLOCK } from '@/lib/ai/prompts'
import { serializeHouseForPrompt, type HouseForPrompt } from '@/lib/ai/serialize'

export const maxDuration = 30

const MAX_BODY_BYTES = 100 * 1024

// Paul–Elder standards, trimmed to the six that map cleanly onto the house.
const STANDARDS = ['clarity', 'accuracy', 'depth', 'breadth', 'logic', 'fairness'] as const

const RequestSchema = z.object({
  house: z.record(z.string(), z.unknown()),
})

const CritiqueSchema = z.object({
  headline: z.string(),
  standards: z
    .array(
      z.object({
        standard: z.enum(STANDARDS),
        grade: z.enum(['strong', 'mixed', 'weak']),
        note: z.string(),
        question: z.string(),
      })
    )
    .length(6),
  weakestLink: z.object({
    layer: z.number().int().min(1).max(7),
    why: z.string(),
    question: z.string(),
  }),
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

  const system = `${PERSONA}\n\n${CRITIQUE_BLOCK}`
  const user = serializeHouseForPrompt(parsed.data.house as HouseForPrompt)

  try {
    const critique = await completeJSON({
      system,
      user,
      schema: CritiqueSchema,
      schemaName: 'house_critique',
      effort: 'high',
      // reasoning_effort:'high' spends tokens on reasoning before any output;
      // this schema's output is large (6 standards × 2 fields + weakest link), so
      // budget generously or Groq returns json_validate_failed with empty output.
      maxTokens: 6000,
    })
    return NextResponse.json(critique)
  } catch (err) {
    if (err instanceof AiError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: 'ai-upstream-error' }, { status: 502 })
  }
}
