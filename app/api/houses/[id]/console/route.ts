// GET/POST /api/houses/[id]/console — the post-pipeline console's whole-house
// chat (migration 0040; plan doc
// plans/active/reasoning-pipeline/28-post-pipeline-console.md;
// components/build/console/*). Whole-house sibling of
// app/api/houses/[id]/layer-feedback/route.ts: same lightweight
// one-completeJSON-call shape (not the pipeline's own step dispatcher — see
// that file's header comment for why re-running the nine-agent orchestration
// per chat turn would be the wrong tool), but scoped to the entire house, may
// propose remove_* actions as well as add_*, and may propose a rerunProposal
// when the correction is foundational rather than local. Confirming a
// rerunProposal does NOT happen here — that goes through
// app/api/houses/[id]/reasoning/route.ts's own step dispatcher (its new GET,
// resumed via consoleGuidance/masterReview injection), reusing the existing
// pipeline engine rather than this route trying to re-implement it.
//
// Authorization mirrors layer-feedback/reasoning's routes exactly (owner or
// 'editor' collaborator, checked against the caller's own session; then
// capabilitiesFor(accountType).canAuthorDraft) — this is the same authoring
// privilege, exercised in a third place.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { completeJSON, AiError } from '@/lib/ai/router'
import { enforceAiLimit } from '@/lib/ai/limits'
import { createClient } from '@/lib/supabase/server'
import { getCallerCapabilities } from '@/lib/auth/account'
import { log } from '@/lib/log'
import { PERSONA, CONSOLE_BLOCK } from '@/lib/ai/prompts'
import { serializeHouseForPrompt, type HouseForPrompt } from '@/lib/ai/serialize'
import { ConsoleResponseSchema, CONSOLE_MESSAGE_MAX, type ConsoleTurn, type RerunProposal } from '@/lib/ai/console'

export const maxDuration = 60

const MAX_BODY_BYTES = 150 * 1024
const TRANSCRIPT_LIMIT = 30

const HouseIdSchema = z.string().uuid()

const PostBodySchema = z.object({
  house: z.record(z.string(), z.unknown()),
  message: z.string().trim().min(1).max(CONSOLE_MESSAGE_MAX),
})

interface HouseAuthzRow {
  id: string
  owner_id: string
}

interface ConsoleRow {
  id: string
  role: 'user' | 'assistant'
  message: string
  actions: unknown
  rerun_proposal: unknown
  created_at: string
}

// Shared by GET and POST — identical gate to layer-feedback/reasoning's own
// (see either file's header comment for the full rationale).
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
    log.error('houses/console', 'house lookup failed', { error: houseError.message })
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
      log.error('houses/console', 'collaborator lookup failed', { error: collabError.message })
      return { ok: false, error: 'server-error', status: 500 }
    }
    canEdit = (collabRow as { role: string } | null)?.role === 'editor'
  }
  if (!canEdit) return { ok: false, error: 'forbidden', status: 403 }

  const caps = await getCallerCapabilities()
  if (!caps.canAuthorDraft) return { ok: false, error: 'draft-not-available', status: 403 }

  return { ok: true }
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id: houseIdParam } = await params
  const houseIdParsed = HouseIdSchema.safeParse(houseIdParam)
  if (!houseIdParsed.success) return NextResponse.json({ error: 'invalid-request' }, { status: 400 })
  const houseId = houseIdParsed.data

  const supabase = await createClient()
  const authz = await authorize(supabase, houseId)
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status })

  const { data, error } = await supabase
    .from('house_console_messages')
    .select('id, role, message, actions, rerun_proposal, created_at')
    .eq('house_id', houseId)
    .order('created_at', { ascending: true })
    .limit(TRANSCRIPT_LIMIT)
  if (error) {
    log.error('houses/console', 'transcript load failed', { error: error.message })
    return NextResponse.json({ error: 'server-error' }, { status: 500 })
  }

  const turns: ConsoleTurn[] = (data as ConsoleRow[]).map((row) => ({
    id: row.id,
    role: row.role,
    message: row.message,
    actions: (row.actions as ConsoleTurn['actions']) ?? null,
    rerunProposal: (row.rerun_proposal as RerunProposal) ?? null,
    createdAt: row.created_at,
  }))
  return NextResponse.json({ turns })
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id: houseIdParam } = await params
  const houseIdParsed = HouseIdSchema.safeParse(houseIdParam)
  if (!houseIdParsed.success) return NextResponse.json({ error: 'invalid-request' }, { status: 400 })
  const houseId = houseIdParsed.data

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
  const parsed = PostBodySchema.safeParse(json)
  if (!parsed.success) return NextResponse.json({ error: 'invalid-request' }, { status: 400 })
  const { house, message } = parsed.data as { house: HouseForPrompt; message: string }

  const supabase = await createClient()
  const authz = await authorize(supabase, houseId)
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status })

  const {
    data: { user },
  } = await supabase.auth.getUser()
  const userId = user!.id

  const { error: insertUserError } = await supabase
    .from('house_console_messages')
    .insert({ house_id: houseId, role: 'user', message, created_by: userId })
  if (insertUserError) {
    log.error('houses/console', 'user turn insert failed', { error: insertUserError.message })
    return NextResponse.json({ error: 'server-error' }, { status: 500 })
  }

  const { data: priorTurns, error: transcriptError } = await supabase
    .from('house_console_messages')
    .select('role, message')
    .eq('house_id', houseId)
    .order('created_at', { ascending: true })
    .limit(TRANSCRIPT_LIMIT)
  if (transcriptError) {
    log.error('houses/console', 'transcript reload failed', { error: transcriptError.message })
    return NextResponse.json({ error: 'server-error' }, { status: 500 })
  }

  // No focusStep — the whole house, every layer.
  const houseText = serializeHouseForPrompt(house)
  const transcriptText = (priorTurns as { role: string; message: string }[])
    .map((t) => `${t.role === 'user' ? 'Person' : 'Co-pilot'}: ${t.message}`)
    .join('\n')
  const userPrompt = `${houseText}\n\n## Conversation so far\n${transcriptText}`
  const system = `${PERSONA}\n\n${CONSOLE_BLOCK}`

  try {
    const { answer, actions, rerunProposal } = await completeJSON({
      role: 'console',
      system,
      user: userPrompt,
      schema: ConsoleResponseSchema,
      schemaName: 'console_turn',
      effort: 'low',
      maxTokens: 1800,
    })

    // Belt-and-suspenders, same posture as layer-feedback/draft: no live
    // search grounding here (invariant 3), so add_evidence never lands even
    // if the model tries — the prompt already tells it not to.
    const filteredActions = actions.filter((a) => a.kind !== 'add_evidence')
    // A reply proposes actions OR a rerun, never both (CONSOLE_BLOCK's own
    // instruction) — enforced here too rather than trusting the model alone.
    const finalActions = rerunProposal ? [] : filteredActions
    const finalRerun = filteredActions.length > 0 ? null : rerunProposal

    const { data: assistantRow, error: insertAssistantError } = await supabase
      .from('house_console_messages')
      .insert({
        house_id: houseId,
        role: 'assistant',
        message: answer,
        actions: finalActions.length > 0 ? finalActions : null,
        rerun_proposal: finalRerun,
        created_by: userId,
      })
      .select('id, created_at')
      .single()
    if (insertAssistantError) {
      log.error('houses/console', 'assistant turn insert failed', { error: insertAssistantError.message })
      return NextResponse.json({ error: 'server-error' }, { status: 500 })
    }

    const reply = assistantRow as { id: string; created_at: string }
    const turn: ConsoleTurn = {
      id: reply.id,
      role: 'assistant',
      message: answer,
      actions: finalActions.length > 0 ? finalActions : null,
      rerunProposal: finalRerun,
      createdAt: reply.created_at,
    }
    return NextResponse.json({ turn })
  } catch (err) {
    if (err instanceof AiError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    log.error('houses/console', 'unhandled error', { error: (err as Error)?.message })
    return NextResponse.json({ error: 'ai-upstream-error' }, { status: 502 })
  }
}
