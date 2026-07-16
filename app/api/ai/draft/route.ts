// POST /api/ai/draft — Draft Mode's staged generator (decision 016). One call
// drafts ONE layer (concepts | perspectives | evidence | assumptions |
// implications) as ordinary AiActions; the client applies them via the reducer's
// APPLY_DRAFT_STAGE and the user claims each layer afterwards. There is no stage
// for conclusion/reasoning/question/purpose — AiActionSchema cannot express them
// (invariant 1) and PERSONA's ban stays composed in, unlike the strawman.
//
// Account-only (016 §3): getCallerAccountType resolves ANONYMOUS callers to
// 'standard', whose canAuthorDraft is now true — so this route must check for a
// signed-in user itself before consulting capabilities, or the anonymous /house
// front door would draft. 401 without a user; 403 without canAuthorDraft.
//
// Pure function (invariant 4): house JSON in → actions out; never writes the DB.
// Evidence stays Brave-grounded with a same-request URL allowlist (invariant 3),
// mirroring /api/ai/research.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { completeJSON, AiError } from '@/lib/ai/groq'
import { enforceAiLimit } from '@/lib/ai/limits'
import { braveSearch } from '@/lib/ai/brave'
import { createClient } from '@/lib/supabase/server'
import { getCallerCapabilities } from '@/lib/auth/account'
import { PERSONA, QUERY_BLOCK, DRAFT_COMMON, DRAFT_STAGE_BLOCKS } from '@/lib/ai/prompts'
import { serializeHouseForPrompt, type HouseForPrompt } from '@/lib/ai/serialize'
import {
  DRAFT_STAGES,
  DRAFT_STAGE_KINDS,
  DRAFT_STAGE_STEP,
  DraftResponseSchema,
} from '@/lib/ai/draft'

export const maxDuration = 30

const MAX_BODY_BYTES = 100 * 1024

const AiContextSchema = z.object({
  summary: z.string(),
  facts: z.array(z.string()),
})

const RequestSchema = z.object({
  // House shape is validated defensively by serialize; accept any object here.
  house: z.record(z.string(), z.unknown()),
  stage: z.enum(DRAFT_STAGES),
  aiContext: AiContextSchema.nullish(),
})

const QuerySchema = z.object({ query: z.string() })

export async function POST(req: Request): Promise<Response> {
  // Rate-limit gate first (pooled across all AI routes).
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
  const { house, stage, aiContext } = parsed.data

  // Authoritative gates. The signed-in check must come before capabilities —
  // see the header comment on why anonymous would otherwise slip through.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const caps = await getCallerCapabilities()
  if (!caps.canAuthorDraft || caps.forcedMode === 'learn') {
    return NextResponse.json({ error: 'draft-not-available' }, { status: 403 })
  }

  const houseForPrompt: HouseForPrompt = {
    ...(house as HouseForPrompt),
    aiContext: aiContext ?? (house as HouseForPrompt).aiContext ?? null,
  }
  const houseText = serializeHouseForPrompt(houseForPrompt, DRAFT_STAGE_STEP[stage])
  const system = `${PERSONA}\n\n${DRAFT_COMMON}\n\n${DRAFT_STAGE_BLOCKS[stage]}`

  try {
    let userPrompt = houseText

    // The evidence stage grounds in a live search from THIS request; every other
    // stage drafts from the house + interview context alone.
    let allowed: Set<string> | null = null
    if (stage === 'evidence') {
      const derived = await completeJSON({
        role: 'coach',
        system: `${PERSONA}\n\n${QUERY_BLOCK}`,
        user: houseText,
        schema: QuerySchema,
        schemaName: 'search_query',
        effort: 'low',
        maxTokens: 200,
      })
      const query = derived.query.trim()
      const results = query ? await braveSearch(query, 6) : []
      // No usable results: return an empty stage rather than inviting invention.
      if (results.length === 0) return NextResponse.json({ stage, actions: [] })
      allowed = new Set(results.map((r) => r.url))
      const numbered = results
        .map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.description}`)
        .join('\n\n')
      userPrompt = `${houseText}\n\n## Search results (query: "${query}")\n${numbered}`
    }

    const { actions } = await completeJSON({
      role: 'drafter',
      system,
      user: userPrompt,
      schema: DraftResponseSchema,
      schemaName: 'draft_stage',
      effort: 'high',
      maxTokens: 4000,
    })

    // Belt to the schema's braces: only this stage's kinds may land, and an
    // evidence URL must be one Brave returned in this request.
    const kinds = DRAFT_STAGE_KINDS[stage]
    const filtered = actions.filter((a) => {
      if (!kinds.includes(a.kind)) return false
      if (a.kind === 'add_evidence') return allowed !== null && allowed.has(a.url)
      return true
    })

    return NextResponse.json({ stage, actions: filtered })
  } catch (err) {
    if (err instanceof AiError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: 'ai-upstream-error' }, { status: 502 })
  }
}
