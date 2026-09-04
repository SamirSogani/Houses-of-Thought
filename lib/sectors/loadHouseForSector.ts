// Server-only helper that loads a house's content into the HouseForPrompt shape
// needed by sector analysis prompts. Shared by all sector API routes so the
// DB→HouseForPrompt mapping lives in one place.

import type { PersonKey } from '@/lib/build/types'
import type { HouseForPrompt } from '@/lib/ai/serialize'

if (typeof window !== 'undefined') {
  throw new Error('lib/sectors/loadHouseForSector.ts is server-only')
}

type Supabase = Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>

export async function loadHouseForSector(
  supabase: Supabase,
  houseId: string
): Promise<HouseForPrompt | null> {
  // Parent row.
  const { data: house, error } = await supabase
    .from('houses')
    .select(
      'title, question, purpose, conclusion, reasoning, concepts, concept_definitions, watchpoints, mode, ai_context'
    )
    .eq('id', houseId)
    .maybeSingle()
  if (error || !house) return null

  // Child tables in parallel.
  const [persp, evid, assum, implic] = await Promise.all([
    supabase.from('house_perspectives').select('*').eq('house_id', houseId).order('position'),
    supabase.from('house_evidence').select('*').eq('house_id', houseId).order('position'),
    supabase.from('house_assumptions').select('*').eq('house_id', houseId).order('position'),
    supabase.from('house_implications').select('*').eq('house_id', houseId).order('position'),
  ])

  // Any child-table error is a hard stop (same as persistence.ts's loadHouse).
  if (persp.error || evid.error || assum.error || implic.error) return null

  // Map concepts from parallel arrays to { term, definition }.
  const rawConcepts = (house.concepts ?? []) as string[]
  const rawDefs = (house.concept_definitions ?? []) as string[]
  const concepts = rawConcepts.map((term: string, i: number) => ({
    term,
    definition: rawDefs[i] ?? '',
  }))

  // Map perspectives.
  const perspectives = (persp.data ?? []).map(
    (p: Record<string, unknown>, i: number) => ({
      id: i + 1,
      name: (p.name as string) ?? '',
      summary: (p.summary as string) ?? '',
      stance: (p.stance as string) ?? '',
      subQuestions: Array.isArray(p.sub_questions) ? p.sub_questions : [],
      supportingEvidence: Array.isArray(p.supporting_evidence) ? p.supporting_evidence : [],
      counters: Array.isArray(p.counters) ? p.counters : [],
      strength: typeof p.strength === 'number' ? p.strength : 0,
      owner: ((p.owner_key as string) ?? 'you') as PersonKey,
    })
  )

  // Map evidence.
  const evidence = (evid.data ?? []).map(
    (e: Record<string, unknown>, i: number) => ({
      id: i + 1,
      text: (e.text as string) ?? '',
      source: (e.source as string) ?? '',
      byAI: e.by_ai === true,
      owner: ((e.owner_key as string) ?? 'you') as 'you',
      url: (e.url as string) ?? undefined,
    })
  )

  // Map assumptions.
  const assumptions = (assum.data ?? []).map(
    (a: Record<string, unknown>, i: number) => ({
      id: i + 1,
      text: (a.text as string) ?? '',
      owner: ((a.owner_key as string) ?? 'you') as 'you',
    })
  )

  // Map implications, split by kind.
  type ImplRow = { text: string; horizon: string; who: string; kind: string }
  const allImpl = (implic.data ?? []) as ImplRow[]
  const mapImpl = (kind: string) =>
    allImpl
      .filter((r) => r.kind === kind)
      .map((r, i) => ({
        id: i + 1,
        text: r.text ?? '',
        horizon: (r.horizon ?? 'Near-term') as 'Near-term' | 'Long-term',
        who: r.who ?? '',
      }))

  return {
    title: (house.title as string) ?? '',
    question: (house.question as string) ?? '',
    purpose: (house.purpose as string) ?? '',
    conclusion: (house.conclusion as string) ?? '',
    reasoning: (house.reasoning as string) ?? '',
    concepts,
    perspectives,
    evidence,
    assumptions,
    pos: mapImpl('pos'),
    neg: mapImpl('neg'),
    unc: mapImpl('unc'),
    watchpoints: (house.watchpoints ?? []) as string[],
    aiContext: house.ai_context as HouseForPrompt['aiContext'],
    mode: (house.mode as string) ?? 'decide',
  }
}
