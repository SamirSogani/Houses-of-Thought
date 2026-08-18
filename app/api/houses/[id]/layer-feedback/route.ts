// GET/POST /api/houses/[id]/layer-feedback — the post-draft Q&A/correction
// thread (migration 0039; components/build/LayerFeedbackThread.tsx). The
// person is reviewing a layer already drafted (Draft Mode or the reasoning
// pipeline — both seed the same state.draft/DRAFT_STAGES shape, lib/ai/draft.ts)
// and either has a question about it or wants to flag a mistake / missing
// context. This is deliberately NOT the reasoning pipeline's own step
// dispatcher (app/api/houses/[id]/reasoning/route.ts) — re-running that
// route's nine-agent orchestration per correction would be slow, expensive,
// and hard to scope to "just this one thing they mentioned". Instead this
// mirrors app/api/ai/draft/route.ts's much lighter shape: one completeJSON
// call, same AiAction vocabulary, same stage-kind allowlist — a correction is
// a small, targeted, human-prompted redo of that same stage draft, not a new
// capability.
//
// Authorization mirrors app/api/houses/[id]/reasoning/route.ts exactly (owner
// or 'editor' collaborator, checked against the caller's own session; then
// capabilitiesFor(accountType).canAuthorDraft) — this is the same authoring
// privilege, just exercised after the fact instead of during the initial run.
//
// GET lists the thread for one stage; POST appends a turn (inserts the
// person's message, calls the model, inserts + returns its reply). Both
// inserts run under the caller's own session (not service role) — migration
// 0039's insert policy is can_access_house only, no role-specific check
// needed since this route is the only writer for both roles.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { completeJSON, AiError } from '@/lib/ai/router'
import { enforceAiLimit } from '@/lib/ai/limits'
import { createClient } from '@/lib/supabase/server'
import { getCallerCapabilities } from '@/lib/auth/account'
import { log } from '@/lib/log'
import { PERSONA, LAYER_FEEDBACK_BLOCK, DRAFT_STAGE_BLOCKS } from '@/lib/ai/prompts'
import { serializeHouseForPrompt, type HouseForPrompt } from '@/lib/ai/serialize'
import { DRAFT_STAGES, DRAFT_STAGE_KINDS, DRAFT_STAGE_STEP, type DraftStage } from '@/lib/ai/draft'
import { LayerFeedbackResponseSchema, LAYER_FEEDBACK_MESSAGE_MAX, type LayerFeedbackTurn } from '@/lib/ai/layerFeedback'

export const maxDuration = 30

const MAX_BODY_BYTES = 120 * 1024
const TRANSCRIPT_LIMIT = 20 // turns of context fed back to the model, and returned to the client

const HouseIdSchema = z.string().uuid()
const StageQuerySchema = z.enum(DRAFT_STAGES)

const PostBodySchema = z.object({
  house: z.record(z.string(), z.unknown()),
  stage: z.enum(DRAFT_STAGES),
  message: z.string().trim().min(1).max(LAYER_FEEDBACK_MESSAGE_MAX),
})

interface HouseAuthzRow {
  id: string
  owner_id: string
}

interface FeedbackRow {
  id: string
  role: 'user' | 'assistant'
  message: string
  actions: unknown
  created_at: string
}

// Shared by GET and POST: caller must be signed in AND either own the house or
// be an 'editor' collaborator, AND canAuthorDraft — identical gate to
// app/api/houses/[id]/reasoning/route.ts (see that file's header comment for
// why each check exists and why owner/editor is checked before capabilities).
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
    log.error('houses/layer-feedback', 'house lookup failed', { error: houseError.message })
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
      log.error('houses/layer-feedback', 'collaborator lookup failed', { error: collabError.message })
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

  const stageParsed = StageQuerySchema.safeParse(new URL(req.url).searchParams.get('stage'))
  if (!stageParsed.success) return NextResponse.json({ error: 'invalid-request' }, { status: 400 })

  const supabase = await createClient()
  const authz = await authorize(supabase, houseId)
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status })

  const { data, error } = await supabase
    .from('house_layer_feedback')
    .select('id, role, message, actions, created_at')
    .eq('house_id', houseId)
    .eq('stage', stageParsed.data)
    .order('created_at', { ascending: true })
    .limit(TRANSCRIPT_LIMIT)
  if (error) {
    log.error('houses/layer-feedback', 'transcript load failed', { error: error.message })
    return NextResponse.json({ error: 'server-error' }, { status: 500 })
  }

  const turns: LayerFeedbackTurn[] = (data as FeedbackRow[]).map((row) => ({
    id: row.id,
    role: row.role,
    message: row.message,
    actions: (row.actions as LayerFeedbackTurn['actions']) ?? null,
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
  const { house, stage, message } = parsed.data as { house: HouseForPrompt; stage: DraftStage; message: string }

  const supabase = await createClient()
  const authz = await authorize(supabase, houseId)
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status })

  const {
    data: { user },
  } = await supabase.auth.getUser()
  // authorize() already confirmed a user exists; re-read here rather than
  // threading it back out of that helper.
  const userId = user!.id

  // Record the person's turn before calling the model — if the model call
  // fails below, their message still lands (matches how a chat send behaves
  // elsewhere: the failure is "no reply yet", never "message vanished").
  const { error: insertUserError } = await supabase
    .from('house_layer_feedback')
    .insert({ house_id: houseId, stage, role: 'user', message, created_by: userId })
  if (insertUserError) {
    log.error('houses/layer-feedback', 'user turn insert failed', { error: insertUserError.message })
    return NextResponse.json({ error: 'server-error' }, { status: 500 })
  }

  const { data: priorTurns, error: transcriptError } = await supabase
    .from('house_layer_feedback')
    .select('role, message')
    .eq('house_id', houseId)
    .eq('stage', stage)
    .order('created_at', { ascending: true })
    .limit(TRANSCRIPT_LIMIT)
  if (transcriptError) {
    log.error('houses/layer-feedback', 'transcript reload failed', { error: transcriptError.message })
    return NextResponse.json({ error: 'server-error' }, { status: 500 })
  }

  const houseText = serializeHouseForPrompt(house, DRAFT_STAGE_STEP[stage])
  const transcriptText = (priorTurns as { role: string; message: string }[])
    .map((t) => `${t.role === 'user' ? 'Person' : 'Co-pilot'}: ${t.message}`)
    .join('\n')
  const userPrompt = `${houseText}\n\n## Conversation about this layer so far\n${transcriptText}`
  const system = `${PERSONA}\n\n${LAYER_FEEDBACK_BLOCK}\n\n${DRAFT_STAGE_BLOCKS[stage]}`

  try {
    const { answer, actions } = await completeJSON({
      role: 'suggestor',
      system,
      user: userPrompt,
      schema: LayerFeedbackResponseSchema,
      schemaName: 'layer_feedback',
      effort: 'low',
      maxTokens: 900,
    })

    // Belt-and-suspenders, same posture as /api/ai/draft: only this stage's
    // kinds may land. Evidence gets no live search grounding in this route
    // (invariant 3) — the prompt already tells the model never to propose
    // add_evidence here, so DRAFT_STAGE_KINDS.evidence being its only allowed
    // kind means this filter alone reduces evidence-stage actions to none.
    const kinds = stage === 'evidence' ? [] : DRAFT_STAGE_KINDS[stage]
    const filtered = actions.filter((a) => kinds.includes(a.kind))

    const { data: assistantRow, error: insertAssistantError } = await supabase
      .from('house_layer_feedback')
      .insert({
        house_id: houseId,
        stage,
        role: 'assistant',
        message: answer,
        actions: filtered.length > 0 ? filtered : null,
        created_by: userId,
      })
      .select('id, created_at')
      .single()
    if (insertAssistantError) {
      log.error('houses/layer-feedback', 'assistant turn insert failed', { error: insertAssistantError.message })
      return NextResponse.json({ error: 'server-error' }, { status: 500 })
    }

    const reply = assistantRow as { id: string; created_at: string }
    const turn: LayerFeedbackTurn = {
      id: reply.id,
      role: 'assistant',
      message: answer,
      actions: filtered.length > 0 ? filtered : null,
      createdAt: reply.created_at,
    }
    return NextResponse.json({ turn })
  } catch (err) {
    if (err instanceof AiError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    log.error('houses/layer-feedback', 'unhandled error', { error: (err as Error)?.message })
    return NextResponse.json({ error: 'ai-upstream-error' }, { status: 502 })
  }
}
