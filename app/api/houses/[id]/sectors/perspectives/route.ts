// POST /api/houses/[id]/sectors/perspectives — generate (or regenerate) the
// Perspectives Sector deep-dive analysis for a house. Loads the house and its
// child tables, serializes them for the model, calls completeJSON against
// PerspectivesSectorSchema, and persists the result via saveSector. Auth:
// signed-in only — RLS on houses/house_* scopes the actual rows to what the
// caller may see (owner or collaborator), same posture as the sibling GET
// route (app/api/houses/[id]/sectors/route.ts).

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { completeJSON, AiError } from '@/lib/ai/router'
import { enforceAiLimit } from '@/lib/ai/limits'
import { serializeHouseForPrompt, type HouseForPrompt } from '@/lib/ai/serialize'
import type { PersonKey } from '@/lib/build/types'
import { PerspectivesSectorSchema } from '@/lib/sectors/types'
import { buildPerspectivesPrompt } from '@/lib/sectors/perspectives-prompt'
import { saveSector, markSectorFailed } from '@/lib/sectors/persistence'
import { log } from '@/lib/log'

export const maxDuration = 120

interface HouseRow {
  title: string | null
  question: string | null
  purpose: string | null
  conclusion: string | null
  reasoning: string | null
  concepts: string[] | null
  concept_definitions: string[] | null
  watchpoints: string[] | null
  mode: string | null
  ai_context: HouseForPrompt['aiContext']
}

interface PerspectiveRow {
  name: string
  summary: string | null
  stance: string | null
  sub_questions: { q: string; note: string }[] | null
  supporting_evidence: { text: string; source: string }[] | null
  counters: string[] | null
  strength: number | null
}

interface EvidenceRow {
  text: string
  source: string | null
  by_ai: boolean
  owner_key: string | null
  url: string | null
}

interface AssumptionRow {
  text: string
  owner_key: string | null
}

interface ImplicationRow {
  kind: 'pos' | 'neg' | 'unc'
  text: string
  horizon: 'Near-term' | 'Long-term' | null
  who: string | null
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id: houseId } = await params

  try {
    await enforceAiLimit(req)
  } catch (err) {
    if (err instanceof AiError) return NextResponse.json({ error: err.message }, { status: err.status })
    throw err
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: houseRow, error: houseError } = await supabase
    .from('houses')
    .select('title, question, purpose, conclusion, reasoning, concepts, concept_definitions, watchpoints, mode, ai_context')
    .eq('id', houseId)
    .maybeSingle()
  if (houseError) {
    log.error('sectors/perspectives', 'house lookup failed', { error: houseError.message })
    return NextResponse.json({ error: 'server-error' }, { status: 500 })
  }
  if (!houseRow) return NextResponse.json({ error: 'not-found' }, { status: 404 })
  const house = houseRow as HouseRow

  const [perspectivesRes, evidenceRes, assumptionsRes, implicationsRes] = await Promise.all([
    supabase
      .from('house_perspectives')
      .select('name, summary, stance, sub_questions, supporting_evidence, counters, strength')
      .eq('house_id', houseId)
      .order('position', { ascending: true }),
    supabase
      .from('house_evidence')
      .select('text, source, by_ai, owner_key, url')
      .eq('house_id', houseId)
      .order('position', { ascending: true }),
    supabase
      .from('house_assumptions')
      .select('text, owner_key')
      .eq('house_id', houseId)
      .order('position', { ascending: true }),
    supabase
      .from('house_implications')
      .select('kind, text, horizon, who')
      .eq('house_id', houseId)
      .order('position', { ascending: true }),
  ])

  for (const res of [perspectivesRes, evidenceRes, assumptionsRes, implicationsRes]) {
    if (res.error) {
      log.error('sectors/perspectives', 'child table load failed', { error: res.error.message })
      return NextResponse.json({ error: 'server-error' }, { status: 500 })
    }
  }

  const perspectiveRows = (perspectivesRes.data ?? []) as PerspectiveRow[]
  const evidenceRows = (evidenceRes.data ?? []) as EvidenceRow[]
  const assumptionRows = (assumptionsRes.data ?? []) as AssumptionRow[]
  const implicationRows = (implicationsRes.data ?? []) as ImplicationRow[]

  const concepts = (house.concepts ?? []).map((term, i) => ({
    term,
    definition: (house.concept_definitions ?? [])[i] ?? '',
  }))

  const houseForPrompt: HouseForPrompt = {
    title: house.title ?? undefined,
    question: house.question ?? undefined,
    purpose: house.purpose ?? undefined,
    conclusion: house.conclusion ?? undefined,
    reasoning: house.reasoning ?? undefined,
    concepts,
    perspectives: perspectiveRows.map((p, i) => ({
      id: i,
      name: p.name,
      summary: p.summary ?? '',
      stance: p.stance ?? '',
      subQuestions: p.sub_questions ?? [],
      supportingEvidence: p.supporting_evidence ?? [],
      counters: p.counters ?? [],
      strength: p.strength ?? 0,
      owner: 'you',
    })),
    evidence: evidenceRows.map((e, i) => ({
      id: i,
      text: e.text,
      source: e.source ?? '',
      byAI: e.by_ai,
      owner: (e.owner_key || 'you') as PersonKey,
      url: e.url ?? undefined,
    })),
    assumptions: assumptionRows.map((a, i) => ({
      id: i,
      text: a.text,
      owner: (a.owner_key || 'you') as PersonKey,
    })),
    pos: implicationRows
      .filter((x) => x.kind === 'pos')
      .map((x, i) => ({ id: i, text: x.text, horizon: x.horizon ?? 'Near-term', who: x.who ?? '' })),
    neg: implicationRows
      .filter((x) => x.kind === 'neg')
      .map((x, i) => ({ id: i, text: x.text, horizon: x.horizon ?? 'Near-term', who: x.who ?? '' })),
    unc: implicationRows
      .filter((x) => x.kind === 'unc')
      .map((x, i) => ({ id: i, text: x.text, horizon: x.horizon ?? 'Near-term', who: x.who ?? '' })),
    watchpoints: house.watchpoints ?? [],
    aiContext: house.ai_context ?? null,
    mode: house.mode ?? undefined,
  }

  const houseText = serializeHouseForPrompt(houseForPrompt)
  const prompt = buildPerspectivesPrompt(houseText)

  try {
    // 'suggestor' lane: the open-role lane with the largest attempt/chain
    // budget. 'synthesis' is reserved for the reasoning pipeline's own
    // post-swarm packaging (router-lanes.ts) and has an 8s timeout too
    // short for a full sector analysis.
    //
    // Sector analysis is heavier than a sidebar suggestion: ~11K input
    // tokens + up to 8K output.  The default suggestor chain deadline
    // (55s) isn't enough — two attempts can exhaust it before reaching
    // the faster fallback providers.  Set a deadline matched to this
    // route's own maxDuration (120s), leaving ~10s headroom for the
    // save + response serialization.  maxTokens bumped from 4K → 8K
    // because the PerspectivesSectorSchema has 6 nested arrays — 4K
    // consistently truncated the JSON mid-object.
    const result = await completeJSON({
      role: 'suggestor',
      system: prompt.system,
      user: prompt.user,
      schema: PerspectivesSectorSchema,
      schemaName: 'PerspectivesSectorAnalysis',
      effort: 'high',
      maxTokens: 8000,
      deadlineAt: Date.now() + 110_000,
    })

    const sector = await saveSector(supabase, houseId, 'perspectives', result, result.findings)
    if (!sector) {
      return NextResponse.json({ error: 'Failed to save sector' }, { status: 500 })
    }
    return NextResponse.json({ sector })
  } catch (err) {
    const message = err instanceof AiError ? err.message : (err as Error)?.message || 'ai-upstream-error'
    await markSectorFailed(supabase, houseId, 'perspectives', message)
    if (err instanceof AiError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    log.error('sectors/perspectives', 'unhandled error', { error: message })
    return NextResponse.json({ error: 'ai-upstream-error' }, { status: 502 })
  }
}
