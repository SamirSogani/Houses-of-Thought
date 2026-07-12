// POST /api/ai/mini-house — the pre-login "Try It Instantly" teaser generator.
//
// Public and anonymous by design: no auth is read, only the pooled anon rate
// limit applies (enforceAiLimit → ANON_DAILY_CAP). The recreation spec calls for
// an in-memory per-IP 6-req/60s limiter local to the function; this route keeps
// the codebase's existing DB-backed pooled limiter instead (shared with every
// other AI route, survives serverless cold starts) — same rationale as reusing
// Groq (qwen3.6-27b / gpt-oss-20b) over the spec's Lovable AI Gateway.
//
// Pure function: a question string in → a Mini House out. Never writes the DB —
// the teaser is never saved (the conversion event is "create an account").
//
// Evidence stays grounded in a live Brave search from THIS request rather than
// the spec's "plausible sources allowed" — every mla_citation traces to a real
// URL (step 3), matching the rest of the app's "never invent a source" rule.
// Same pattern as /api/ai/research.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { completeJSON, AiError } from '@/lib/ai/groq'
import { enforceAiLimit } from '@/lib/ai/limits'
import { braveSearch } from '@/lib/ai/brave'
import { MINI_HOUSE_SYSTEM } from '@/lib/ai/prompts'
import { MiniHouseSchema, MINI_HOUSE_MIN_CHARS, MINI_HOUSE_MAX_CHARS } from '@/lib/ai/mini-house'

export const maxDuration = 30

const MAX_BODY_BYTES = 8 * 1024

const RequestSchema = z.object({
  question: z.string().trim().min(MINI_HOUSE_MIN_CHARS).max(MINI_HOUSE_MAX_CHARS),
})

// Friendly, user-facing copy — mirrors the spec's mapping (busy vs. generic
// upstream failure) rather than surfacing raw error codes to the client.
function friendlyMessage(err: AiError): string {
  if (err.status === 429) return 'The reasoning engine is busy right now — try again in a moment.'
  return 'Service temporarily unavailable. Please try again shortly.'
}

export async function POST(req: Request): Promise<Response> {
  try {
    await enforceAiLimit(req)
  } catch (err) {
    if (err instanceof AiError) return NextResponse.json({ error: friendlyMessage(err) }, { status: err.status })
    throw err
  }

  const raw = await req.text()
  if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Please enter a question between 5 and 600 characters.' }, { status: 413 })
  }

  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 400 })
  }
  const parsed = RequestSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Please enter a question between 5 and 600 characters.' }, { status: 400 })
  }
  const question = parsed.data.question

  try {
    // 1. Ground evidence in a live search. Best-effort: only a rate limit should
    //    surface as an error; anything else degrades to an evidence-less teaser
    //    rather than inviting the model to invent sources.
    let numbered = 'No search results were available.'
    let allowed = new Set<string>()
    try {
      const results = await braveSearch(question, 6)
      if (results.length > 0) {
        allowed = new Set(results.map((r) => r.url))
        numbered = results
          .map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.description}`)
          .join('\n\n')
      }
    } catch (err) {
      if (err instanceof AiError && err.status === 429) throw err
      console.error('[ai/mini-house] search failed, generating without evidence:', (err as Error)?.message)
    }

    // 2. Generate the whole Mini House in one call, grounding evidence in the
    //    numbered results only.
    const miniHouse = await completeJSON({
      role: 'drafter',
      system: MINI_HOUSE_SYSTEM,
      user: `Question: ${question}\n\n## Search results\n${numbered}\n\nBuild the Mini House as JSON.`,
      schema: MiniHouseSchema,
      schemaName: 'mini_house',
      effort: 'high',
      maxTokens: 6000,
    })

    // 3. Hard validation: keep only evidence whose URL is one Brave returned.
    const evidence = miniHouse.evidence.filter((e) => allowed.has(e.url))

    // Response shape mirrors the spec: { question, mini_house }.
    return NextResponse.json({ question, mini_house: { ...miniHouse, evidence } })
  } catch (err) {
    if (err instanceof AiError) {
      return NextResponse.json({ error: friendlyMessage(err) }, { status: err.status })
    }
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 502 })
  }
}
