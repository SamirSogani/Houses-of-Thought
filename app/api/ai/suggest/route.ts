// POST /api/ai/suggest — the co-pilot's live suggestions for one layer.
//
// Pure function: house JSON in → findings out (invariant 4). It never writes the
// DB; persistence rides the existing autosave path. Works for both builder routes
// (/build/[id] and anonymous /house) — neither auth nor identity is read here.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { completeJSON, AiError } from '@/lib/ai/groq'
import { enforceAiLimit } from '@/lib/ai/limits'
import { getCallerCapabilities } from '@/lib/auth/account'
import { PERSONA, SUGGEST_BLOCK } from '@/lib/ai/prompts'
import { serializeHouseForPrompt, type HouseForPrompt } from '@/lib/ai/serialize'
import { FindingsResponseSchema } from '@/lib/ai/findings'

export const maxDuration = 30

const MAX_BODY_BYTES = 100 * 1024

const AiContextSchema = z.object({
  summary: z.string(),
  facts: z.array(z.string()),
})

const RequestSchema = z.object({
  // House shape is validated defensively by serialize; accept any object here.
  house: z.record(z.string(), z.unknown()),
  step: z.number().int().min(1).max(7),
  mode: z.enum(['learn', 'decide']),
  // Optional; the house payload already carries aiContext, but a caller may send
  // it separately — the serializer picks up whichever is present.
  aiContext: AiContextSchema.nullish(),
})

export async function POST(req: Request): Promise<Response> {
  // Rate-limit gate first (pooled across all AI routes).
  try {
    await enforceAiLimit(req)
  } catch (err) {
    if (err instanceof AiError) return NextResponse.json({ error: err.message }, { status: err.status })
    throw err
  }

  // Guard body size before parsing (protects tokens and memory).
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
  const { house, step, mode, aiContext } = parsed.data

  // Authoritative posture gate (plan phase 1): a student is pinned to Learn
  // regardless of the mode the client sent, so the co-pilot can never be coaxed
  // into Decide-mode answers. Non-students keep the requested mode.
  const caps = await getCallerCapabilities()
  const effectiveMode = caps.forcedMode ?? mode

  const houseForPrompt: HouseForPrompt = {
    ...(house as HouseForPrompt),
    aiContext: aiContext ?? (house as HouseForPrompt).aiContext ?? null,
  }
  const system = `${PERSONA}\n\n${SUGGEST_BLOCK}`
  const user = `Mode: ${effectiveMode}\n\n${serializeHouseForPrompt(houseForPrompt, step)}`

  try {
    const { findings } = await completeJSON({
      role: 'suggestor',
      system,
      user,
      schema: FindingsResponseSchema,
      schemaName: 'copilot_findings',
      effort: 'low',
      maxTokens: 1400,
    })

    // Belt to the schema's braces (invariants 1 & 3): evidence enters only via
    // Research Mode, and a finding must target the focused layer.
    const filtered = findings.filter(
      (f) => f.layer === step && f.action?.kind !== 'add_evidence'
    )

    return NextResponse.json({ findings: filtered })
  } catch (err) {
    if (err instanceof AiError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: 'ai-upstream-error' }, { status: 502 })
  }
}
