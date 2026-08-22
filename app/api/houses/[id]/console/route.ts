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
// privilege, exercised in a third place. authorize() itself now lives in
// ./authorize.ts, shared with chats/route.ts and chats/[chatId]/route.ts
// (plan doc 29) — same function, not a second copy.
//
// chatId (plan doc 29, migration 0041): a chat is now a first-class row, not
// "every message for this house" — GET requires ?chatId= and POST requires
// chatId in the body, both scoping every query below to that one chat. Two
// bugs the multi-chat plan doc found while reading this file (doc 29 "Two
// bugs found while planning"), fixed here:
//   1. Both queries used to read `.order('created_at', { ascending: true
//      }).limit(TRANSCRIPT_LIMIT)` — the OLDEST TRANSCRIPT_LIMIT rows, not
//      the most recent. Past that many turns the console silently stopped
//      seeing recent conversation. Fixed with `ascending: false` (DB-side,
//      newest-first) + toChronological() (lib/ai/console.ts) to flip back to
//      display order.
//   2. Proposed-action chip state was React-only (`added` Set, ConsolePage) —
//      fixed in components/build/console/ConsoleTranscript.tsx, not here.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { completeJSON, AiError } from '@/lib/ai/router'
import { enforceAiLimit } from '@/lib/ai/limits'
import { createClient } from '@/lib/supabase/server'
import { log } from '@/lib/log'
import { PERSONA, CONSOLE_BLOCK } from '@/lib/ai/prompts'
import { serializeHouseForPrompt, type HouseForPrompt } from '@/lib/ai/serialize'
import { getReasoningRunByHouseId } from '@/lib/ai/reasoning/persistence'
import {
  ConsoleResponseSchema,
  CONSOLE_MESSAGE_MAX,
  titleFromMessage,
  toChronological,
  transcriptLine,
  type ConsoleTurn,
  type RerunProposal,
} from '@/lib/ai/console'
import { authorize } from './authorize'

export const maxDuration = 60

const MAX_BODY_BYTES = 150 * 1024
const TRANSCRIPT_LIMIT = 30

const HouseIdSchema = z.string().uuid()
const ChatIdSchema = z.string().uuid()

const PostBodySchema = z.object({
  house: z.record(z.string(), z.unknown()),
  message: z.string().trim().min(1).max(CONSOLE_MESSAGE_MAX),
  chatId: ChatIdSchema,
})

interface ConsoleRow {
  id: string
  role: 'user' | 'assistant' | 'system'
  message: string
  actions: unknown
  rerun_proposal: unknown
  created_at: string
  // Loop A columns (migration 0042, plan doc 30) — null/0 on every row this
  // route itself ever writes; only app/api/houses/[id]/console/revise/
  // route.ts sets them, but a GET here has to be able to READ what that
  // route wrote, so every row this route selects carries them too.
  revises_message_id: string | null
  revision_iteration: number
  critique: unknown
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id: houseIdParam } = await params
  const houseIdParsed = HouseIdSchema.safeParse(houseIdParam)
  if (!houseIdParsed.success) return NextResponse.json({ error: 'invalid-request' }, { status: 400 })
  const houseId = houseIdParsed.data

  const chatIdParsed = ChatIdSchema.safeParse(new URL(req.url).searchParams.get('chatId'))
  if (!chatIdParsed.success) return NextResponse.json({ error: 'invalid-request' }, { status: 400 })
  const chatId = chatIdParsed.data

  const supabase = await createClient()
  const authz = await authorize(supabase, houseId)
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status })

  // Bug fix #1 (doc 29): newest TRANSCRIPT_LIMIT rows, DB-side (was the
  // OLDEST TRANSCRIPT_LIMIT before this fix) — see module header comment.
  const { data, error } = await supabase
    .from('house_console_messages')
    .select('id, role, message, actions, rerun_proposal, created_at, revises_message_id, revision_iteration, critique')
    .eq('house_id', houseId)
    .eq('chat_id', chatId)
    .order('created_at', { ascending: false })
    .limit(TRANSCRIPT_LIMIT)
  if (error) {
    log.error('houses/console', 'transcript load failed', { error: error.message })
    return NextResponse.json({ error: 'server-error' }, { status: 500 })
  }

  const turns: ConsoleTurn[] = toChronological(data as ConsoleRow[]).map((row) => ({
    id: row.id,
    role: row.role,
    message: row.message,
    actions: (row.actions as ConsoleTurn['actions']) ?? null,
    rerunProposal: (row.rerun_proposal as RerunProposal) ?? null,
    createdAt: row.created_at,
    revisesMessageId: row.revises_message_id ?? null,
    revisionIteration: row.revision_iteration ?? 0,
    critique: (row.critique as ConsoleTurn['critique']) ?? null,
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
  const { house, message, chatId } = parsed.data as { house: HouseForPrompt; message: string; chatId: string }

  const supabase = await createClient()
  const authz = await authorize(supabase, houseId)
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status })

  const { data: chatRow, error: chatError } = await supabase
    .from('house_console_chats')
    .select('id, title, deleted_at')
    .eq('id', chatId)
    .eq('house_id', houseId)
    .maybeSingle()
  if (chatError) {
    log.error('houses/console', 'chat lookup failed', { error: chatError.message })
    return NextResponse.json({ error: 'server-error' }, { status: 500 })
  }
  if (!chatRow) return NextResponse.json({ error: 'chat-not-found' }, { status: 404 })
  if ((chatRow as { deleted_at: string | null }).deleted_at) {
    return NextResponse.json({ error: 'chat-deleted' }, { status: 409 })
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  const userId = user!.id

  const { error: insertUserError } = await supabase
    .from('house_console_messages')
    .insert({ house_id: houseId, chat_id: chatId, role: 'user', message, created_by: userId })
  if (insertUserError) {
    log.error('houses/console', 'user turn insert failed', { error: insertUserError.message })
    return NextResponse.json({ error: 'server-error' }, { status: 500 })
  }

  // Bug fix #1 (doc 29) — see module header comment and the GET handler
  // above for the same fix.
  const { data: priorTurns, error: transcriptError } = await supabase
    .from('house_console_messages')
    .select('role, message')
    .eq('house_id', houseId)
    .eq('chat_id', chatId)
    .order('created_at', { ascending: false })
    .limit(TRANSCRIPT_LIMIT)
  if (transcriptError) {
    log.error('houses/console', 'transcript reload failed', { error: transcriptError.message })
    return NextResponse.json({ error: 'server-error' }, { status: 500 })
  }

  // No focusStep — the whole house, every layer.
  const houseText = serializeHouseForPrompt(house)
  const transcriptText = toChronological(priorTurns as { role: string; message: string }[])
    .map((t) => transcriptLine(t.role, t.message))
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
        chat_id: chatId,
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

    // Chat bookkeeping: bump last_message_at, capture which reasoning_runs
    // row is current (drives the "stale" badge, GET .../console/chats — plan
    // doc 29), and derive the title from the first message if it hasn't been
    // set yet (rename or a later message never re-derives it). Best-effort:
    // the message exchange above already committed, so a failure here is
    // logged, not surfaced as a request failure — the person's message and
    // reply both landed either way.
    const run = await getReasoningRunByHouseId(houseId)
    const chatUpdate: Record<string, unknown> = { last_message_at: reply.created_at, run_id_at_last_reply: run?.id ?? null }
    if (!(chatRow as { title: string }).title) chatUpdate.title = titleFromMessage(message)
    const { error: chatUpdateError } = await supabase.from('house_console_chats').update(chatUpdate).eq('id', chatId)
    if (chatUpdateError) {
      log.error('houses/console', 'chat bookkeeping update failed (non-fatal)', { error: chatUpdateError.message })
    }

    const turn: ConsoleTurn = {
      id: reply.id,
      role: 'assistant',
      message: answer,
      actions: finalActions.length > 0 ? finalActions : null,
      rerunProposal: finalRerun,
      createdAt: reply.created_at,
      // This route never writes a revision — only .../console/revise/
      // route.ts does — so these are always the "ordinary turn" values.
      revisesMessageId: null,
      revisionIteration: 0,
      critique: null,
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
