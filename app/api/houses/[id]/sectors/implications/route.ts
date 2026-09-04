// POST /api/houses/[id]/sectors/implications — generate the Implications
// Sector deep-dive (causal chains, timeline, scenarios, interaction effects;
// lib/sectors/types.ts's ImplicationsSectorSchema). Regenerating overwrites
// the existing row — one analysis per (house, sector_type), migration 0044.
//
// Auth mirrors app/api/houses/[id]/layer-feedback/route.ts's authorize():
// signed-in caller who owns the house or is an 'editor' collaborator. Note
// (2026-09-02): house_sectors' RLS (migration 0044) only grants INSERT/UPDATE
// to the owner ("Owner can manage sectors"; collaborators get SELECT only via
// a separate policy) — an editor who passes this route's authz will still
// have their saveSector() write rejected by RLS below. Flagging rather than
// loosening the migration myself, since fixing it is a DB change outside this
// route's own file.
//
// Role choice: the task this route was scaffolded from called for
// role: 'synthesis', but router-shared.ts's AiRole comment reserves 'swarm'
// and 'synthesis' for the reasoning pipeline (lib/ai/reasoning/*) only — and
// ATTEMPT_TIMEOUT_MS.synthesis (router-lanes.ts) is deliberately just 8s,
// sized for "packaging only" work after a swarm run, not a fresh structured
// analysis like this one. 'suggestor' is the general-purpose lane with the
// largest attempt/chain budget among the four open roles (coach/critic/
// suggestor/drafter) and already carries a comparably shaped multi-item
// structured-output task (SUGGEST_BLOCK), so it's used here instead.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { completeJSON, AiError } from '@/lib/ai/router'
import { enforceAiLimit } from '@/lib/ai/limits'
import { serializeHouseForPrompt } from '@/lib/ai/serialize'
import { loadHouseForSector } from '@/lib/sectors/loadHouseForSector'
import { ImplicationsSectorSchema } from '@/lib/sectors/types'
import { buildImplicationsPrompt } from '@/lib/sectors/implications-prompt'
import { saveSector, markSectorFailed } from '@/lib/sectors/persistence'
import { log } from '@/lib/log'

export const maxDuration = 120 // sector analysis needs more time than a suggest call

const SECTOR_TYPE = 'implications' as const

interface HouseAuthzRow {
  id: string
  owner_id: string
}

// Signed in AND (owner OR 'editor' collaborator) — same gate as
// layer-feedback's authorize(), minus its canAuthorDraft capability check
// (not part of this route's spec).
async function authorize(
  supabase: Awaited<ReturnType<typeof createClient>>,
  houseId: string
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'unauthenticated', status: 401 }

  const { data: houseRow, error: houseError } = await supabase
    .from('houses')
    .select('id, owner_id')
    .eq('id', houseId)
    .maybeSingle()
  if (houseError) {
    log.error('houses/sectors/implications', 'house lookup failed', { error: houseError.message })
    return { ok: false, error: 'server-error', status: 500 }
  }
  if (!houseRow) return { ok: false, error: 'not-found', status: 404 }
  const house = houseRow as HouseAuthzRow

  let canEdit = house.owner_id === user.id
  if (!canEdit) {
    const { data: collabRow, error: collabError } = await supabase
      .from('house_collaborators')
      .select('role')
      .eq('house_id', houseId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (collabError) {
      log.error('houses/sectors/implications', 'collaborator lookup failed', { error: collabError.message })
      return { ok: false, error: 'server-error', status: 500 }
    }
    canEdit = (collabRow as { role: string } | null)?.role === 'editor'
  }
  if (!canEdit) return { ok: false, error: 'forbidden', status: 403 }

  return { ok: true }
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
  const authz = await authorize(supabase, houseId)
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status })

  const house = await loadHouseForSector(supabase, houseId)
  if (!house) {
    log.error('houses/sectors/implications', 'house load failed', { houseId })
    return NextResponse.json({ error: 'house-load-failed' }, { status: 500 })
  }

  const houseText = serializeHouseForPrompt(house)
  const { system, user } = buildImplicationsPrompt(houseText)

  try {
    // Sector analysis is heavier than a sidebar suggestion: ~11K input
    // tokens + up to 8K output.  The default suggestor chain deadline
    // (55s) isn't enough — two attempts can exhaust it before reaching
    // the faster fallback providers.  Set a deadline matched to this
    // route's own maxDuration (120s), leaving ~10s headroom for the
    // save + response serialization.  maxTokens bumped from 4K → 8K
    // to prevent JSON truncation on complex analyses.
    const result = await completeJSON({
      role: 'suggestor',
      system,
      user,
      schema: ImplicationsSectorSchema,
      schemaName: 'implications_sector',
      effort: 'high',
      maxTokens: 8000,
      deadlineAt: Date.now() + 110_000,
    })

    const sector = await saveSector(supabase, houseId, SECTOR_TYPE, result, result.findings)
    if (!sector) {
      log.error('houses/sectors/implications', 'saveSector returned null', { houseId })
      return NextResponse.json({ error: 'save-failed' }, { status: 500 })
    }

    return NextResponse.json({ sector })
  } catch (err) {
    const isAiError = err instanceof AiError
    const message = isAiError ? err.message : 'ai-upstream-error'
    const status = isAiError ? err.status : 502
    if (!isAiError) {
      log.error('houses/sectors/implications', 'unhandled error', { error: (err as Error)?.message })
    }
    await markSectorFailed(supabase, houseId, SECTOR_TYPE, message)
    return NextResponse.json({ error: message }, { status })
  }
}
