// Mechanism 2 ("Share") of plans/active/persistence/invite-share-panels.md.
// Service-role lookup by houses.share_token (0033) — deliberately NOT read
// through the user-session client/RLS: an anonymous visitor holding a link has
// no Supabase session at all, and the whole point of Share is that the token
// itself is the credential, not a signed-in identity. Shapes the row + its
// four child tables into the same State the builder/loadHouse produces, so
// app/shared/[token]/page.tsx can feed it straight into the same
// ReadOnlyHouse component /examples/[slug] uses.
//
// "No such token" and "revoked" (share_token set back to null) are
// indistinguishable on purpose — both are just "no row matched" — so a 404
// here never confirms or denies that a link ever existed.

import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient as createServiceClient, type SupabaseClient } from '@supabase/supabase-js'
import { blankState } from '@/lib/build/persistence'
import type { Perspective, State } from '@/lib/build/types'

export const dynamic = 'force-dynamic'

// Postgres will itself reject a non-uuid filter value (the column is typed
// uuid), but that surfaces as a query error rather than "no rows" — checking
// the shape first keeps every malformed-token guess on the exact same 404
// path as a well-formed-but-unknown one. Matches the z.string().uuid() gate
// app/api/admin/reasoning/runs/[id]/route.ts uses for the same reason.
const TokenSchema = z.string().uuid()

let service: SupabaseClient | null = null
function serviceClient(): SupabaseClient | null {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null
  if (!service) {
    service = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } }
    )
  }
  return service
}

interface HouseParentRow {
  id: string
  title: string | null
  question: string | null
  purpose: string | null
  conclusion: string | null
  reasoning: string | null
  concepts: string[] | null
  concept_definitions: string[] | null
  watchpoints: string[] | null
}

interface PerspectiveRow {
  name: string
  summary: string | null
  stance: string | null
  sub_questions: unknown
  supporting_evidence: unknown
  counters: string[] | null
  strength: number
  owner_key: string
}

interface EvidenceRow {
  text: string
  source: string | null
  owner_key: string
  by_ai: boolean
  url: string | null
}

interface AssumptionRow {
  text: string
  owner_key: string
}

interface ImplicationRow {
  kind: string
  text: string
  horizon: string | null
  who: string | null
}

// Row → State mapping, deliberately parallel to lib/build/persistence.ts's
// loadHouse (same columns, same child tables) but built independently: this
// route reads with the service-role key (no auth session, no rev/concurrency
// token — a shared view is read-only and never saved back), so it isn't a
// drop-in caller of that function.
function toState(
  house: HouseParentRow,
  perspRows: PerspectiveRow[],
  evidRows: EvidenceRow[],
  assumRows: AssumptionRow[],
  implicRows: ImplicationRow[]
): State {
  const state = blankState()
  state.title = house.title ?? ''
  state.question = house.question ?? ''
  state.purpose = house.purpose ?? ''
  state.conclusion = house.conclusion ?? ''
  state.reasoning = house.reasoning ?? ''
  const conceptTerms = house.concepts ?? []
  const conceptDefs = house.concept_definitions ?? []
  state.concepts = conceptTerms.map((term, i) => ({ term, definition: conceptDefs[i] ?? '' }))
  state.watchpoints = house.watchpoints ?? []

  state.perspectives = perspRows.map((r, i) => ({
    id: i + 1,
    name: r.name,
    summary: r.summary ?? '',
    stance: r.stance ?? '',
    subQuestions: (r.sub_questions as Perspective['subQuestions'] | null) ?? [],
    supportingEvidence: (r.supporting_evidence as Perspective['supportingEvidence'] | null) ?? [],
    counters: r.counters ?? [],
    strength: r.strength,
    owner: r.owner_key as Perspective['owner'],
  }))

  state.evidence = evidRows.map((r, i) => ({
    id: i + 1,
    text: r.text,
    source: r.source ?? '',
    owner: r.owner_key as State['evidence'][number]['owner'],
    byAI: r.by_ai,
    url: r.url ?? undefined,
  }))

  state.assumptions = assumRows.map((r, i) => ({
    id: i + 1,
    text: r.text,
    owner: r.owner_key as State['assumptions'][number]['owner'],
  }))

  const byKind = (kind: string) =>
    implicRows
      .filter((r) => r.kind === kind)
      .map((r, i) => ({
        id: i + 1,
        text: r.text,
        horizon: (r.horizon ?? 'Near-term') as State['pos'][number]['horizon'],
        who: r.who ?? '',
      }))
  state.pos = byKind('pos')
  state.neg = byKind('neg')
  state.unc = byKind('unc')

  return state
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  if (!TokenSchema.safeParse(token).success) {
    return NextResponse.json({ error: 'not-found' }, { status: 404 })
  }

  const client = serviceClient()
  if (!client) {
    return NextResponse.json({ error: 'unavailable' }, { status: 500 })
  }

  const { data: house, error: houseError } = await client
    .from('houses')
    .select(
      'id, title, question, purpose, conclusion, reasoning, concepts, concept_definitions, watchpoints'
    )
    .eq('share_token', token)
    .maybeSingle()

  // Never-shared, wrong token, or already-revoked (share_token back to null)
  // all land here identically — see module comment.
  if (houseError || !house) {
    return NextResponse.json({ error: 'not-found' }, { status: 404 })
  }

  const houseRow = house as HouseParentRow
  const [persp, evid, assum, implic] = await Promise.all([
    client.from('house_perspectives').select('*').eq('house_id', houseRow.id).order('position'),
    client.from('house_evidence').select('*').eq('house_id', houseRow.id).order('position'),
    client.from('house_assumptions').select('*').eq('house_id', houseRow.id).order('position'),
    client.from('house_implications').select('*').eq('house_id', houseRow.id).order('position'),
  ])
  if (persp.error || evid.error || assum.error || implic.error) {
    return NextResponse.json({ error: 'server-error' }, { status: 500 })
  }

  const state = toState(
    houseRow,
    (persp.data ?? []) as PerspectiveRow[],
    (evid.data ?? []) as EvidenceRow[],
    (assum.data ?? []) as AssumptionRow[],
    (implic.data ?? []) as ImplicationRow[]
  )

  return NextResponse.json({ house: state })
}
