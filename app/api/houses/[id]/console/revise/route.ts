// POST /api/houses/[id]/console/revise — Loop A, bounded revise (plan doc
// plans/active/reasoning-pipeline/30-console-subagent-loops.md, migration
// 0042). "That answer is thin, try again but shorter" without opening a
// fresh chat or touching the pipeline. One iteration = one POST: the person
// picks a prior assistant turn and gives an instruction; the server runs
// critic → revise (two sequential completeJSON calls) and writes a REAL new
// assistant row rather than editing the old one in place — "a loop whose
// inside the person cannot see is a loop they cannot check" (doc 30), so the
// critique that produced this row is stored on it (`critique`, migration
// 0042), not thrown away once the rewrite lands.
//
// Budget: two sequential model calls inside maxDuration = 60. Their
// unmodified defaults do NOT fit — CHAIN_DEADLINE_MS.critic is 26s and
// CHAIN_DEADLINE_MS.console is 55s (router.ts), and 26 + 55 = 81s > 60s.
// Rather than raising the route's ceiling (doc 30's own instruction: "make
// the critic call the cheaper/shorter one"), this route shares ONE absolute
// deadline across both calls via completeJSON's own `deadlineAt` option: the
// critic call gets a short, explicit sub-deadline (CRITIC_DEADLINE_MS, well
// under its normal 26s budget — scoring three standards is a small task,
// not a whole-house rewrite), and the revise call gets whatever remains of
// the route's own 55s allowance (5s headroom under maxDuration=60, the same
// convention app/api/houses/[id]/console/route.ts's own comment in
// router.ts documents). Worst case: 15s + 40s = 55s, safely under 60s.
//
// Same authorize()/enforceAiLimit/AiError handling shape as
// app/api/houses/[id]/console/route.ts's own POST — this is that route's
// sibling for one specific kind of turn, not a replacement for it.
// enforceAiLimit(req, 2): this route makes two model calls per request (the
// exact gap doc 30's "Cost and rate limiting" section calls out and
// lib/ai/limits.ts's `units` param exists to close).

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { completeJSON, AiError } from '@/lib/ai/router'
import { enforceAiLimit } from '@/lib/ai/limits'
import { createClient } from '@/lib/supabase/server'
import { log } from '@/lib/log'
import { PERSONA, REVISE_CRITIC_BLOCK, CONSOLE_REVISE_BLOCK } from '@/lib/ai/prompts'
import { serializeHouseForPrompt, type HouseForPrompt } from '@/lib/ai/serialize'
import { getReasoningRunByHouseId } from '@/lib/ai/reasoning/persistence'
import {
  ReviseRequestSchema,
  ReviseCritiqueSchema,
  ReviseResponseSchema,
  revisionCapReached,
  type ConsoleTurn,
} from '@/lib/ai/console'
import { authorize } from '../authorize'

export const maxDuration = 60

const MAX_BODY_BYTES = 150 * 1024
// See this file's own header comment for the full budget math.
const ROUTE_BUDGET_MS = 55_000
const CRITIC_DEADLINE_MS = 15_000

const HouseIdSchema = z.string().uuid()

interface TargetTurnRow {
  id: string
  role: string
  message: string
  revision_iteration: number
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id: houseIdParam } = await params
  const houseIdParsed = HouseIdSchema.safeParse(houseIdParam)
  if (!houseIdParsed.success) return NextResponse.json({ error: 'invalid-request' }, { status: 400 })
  const houseId = houseIdParsed.data

  try {
    await enforceAiLimit(req, 2)
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
  const parsed = ReviseRequestSchema.safeParse(json)
  if (!parsed.success) return NextResponse.json({ error: 'invalid-request' }, { status: 400 })
  const { chatId, targetTurnId, instruction, house } = parsed.data

  const supabase = await createClient()
  const authz = await authorize(supabase, houseId)
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status })

  const { data: chatRow, error: chatError } = await supabase
    .from('house_console_chats')
    .select('id, deleted_at')
    .eq('id', chatId)
    .eq('house_id', houseId)
    .maybeSingle()
  if (chatError) {
    log.error('houses/console', 'revise: chat lookup failed', { error: chatError.message })
    return NextResponse.json({ error: 'server-error' }, { status: 500 })
  }
  if (!chatRow) return NextResponse.json({ error: 'chat-not-found' }, { status: 404 })
  if ((chatRow as { deleted_at: string | null }).deleted_at) {
    return NextResponse.json({ error: 'chat-deleted' }, { status: 409 })
  }

  const { data: targetRow, error: targetError } = await supabase
    .from('house_console_messages')
    .select('id, role, message, revision_iteration')
    .eq('id', targetTurnId)
    .eq('chat_id', chatId)
    .eq('house_id', houseId)
    .maybeSingle()
  if (targetError) {
    log.error('houses/console', 'revise: target turn lookup failed', { error: targetError.message })
    return NextResponse.json({ error: 'server-error' }, { status: 500 })
  }
  if (!targetRow) return NextResponse.json({ error: 'turn-not-found' }, { status: 404 })
  const target = targetRow as TargetTurnRow
  if (target.role !== 'assistant') return NextResponse.json({ error: 'invalid-request' }, { status: 400 })
  // Hard cap of 3 iterations (doc 30) — checked against the TARGET's own
  // stored revision_iteration, never the client's disabled button alone.
  if (revisionCapReached(target.revision_iteration)) {
    return NextResponse.json({ error: 'revise-cap-reached' }, { status: 400 })
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  const userId = user!.id

  // The instruction becomes a normal user turn — same insert shape as the
  // plain console route, so the transcript reads as one coherent
  // conversation rather than a special-cased side channel.
  const { data: userRow, error: insertUserError } = await supabase
    .from('house_console_messages')
    .insert({ house_id: houseId, chat_id: chatId, role: 'user', message: instruction, created_by: userId })
    .select('id, created_at')
    .single()
  if (insertUserError) {
    log.error('houses/console', 'revise: user turn insert failed', { error: insertUserError.message })
    return NextResponse.json({ error: 'server-error' }, { status: 500 })
  }
  const userReply = userRow as { id: string; created_at: string }

  const started = Date.now()
  const routeDeadlineAt = started + ROUTE_BUDGET_MS
  const criticDeadlineAt = Math.min(started + CRITIC_DEADLINE_MS, routeDeadlineAt)

  const houseText = serializeHouseForPrompt(house as HouseForPrompt)

  try {
    const critique = await completeJSON({
      role: 'critic',
      system: `${PERSONA}\n\n${REVISE_CRITIC_BLOCK}`,
      user: `${houseText}\n\n## Prior answer being revised\n${target.message}\n\n## Person's instruction for this revision\n${instruction}`,
      schema: ReviseCritiqueSchema,
      schemaName: 'revise_critique',
      effort: 'low',
      maxTokens: 700,
      deadlineAt: criticDeadlineAt,
    })

    const critiqueText = (['clarity', 'relevance', 'depth'] as const)
      .map((id) => `${id[0].toUpperCase()}${id.slice(1)} — ${critique.standards[id].pass ? 'pass' : 'falls short'}: ${critique.standards[id].note}`)
      .join('\n')

    const { answer } = await completeJSON({
      role: 'console',
      system: `${PERSONA}\n\n${CONSOLE_REVISE_BLOCK}`,
      user: `${houseText}\n\n## Prior answer being revised\n${target.message}\n\n## Person's instruction\n${instruction}\n\n## Critique\n${critiqueText}\n\nGuidance: ${critique.guidance}`,
      schema: ReviseResponseSchema,
      schemaName: 'console_revision',
      effort: 'low',
      maxTokens: 1200,
      deadlineAt: routeDeadlineAt,
    })

    const { data: assistantRow, error: insertAssistantError } = await supabase
      .from('house_console_messages')
      .insert({
        house_id: houseId,
        chat_id: chatId,
        role: 'assistant',
        message: answer,
        revises_message_id: target.id,
        revision_iteration: target.revision_iteration + 1,
        critique,
        created_by: userId,
      })
      .select('id, created_at')
      .single()
    if (insertAssistantError) {
      log.error('houses/console', 'revise: assistant turn insert failed', { error: insertAssistantError.message })
      return NextResponse.json({ error: 'server-error' }, { status: 500 })
    }
    const assistantReply = assistantRow as { id: string; created_at: string }

    // Same best-effort chat bookkeeping as the plain console route — a
    // failure here is logged, not surfaced, since both real rows already
    // committed either way.
    const run = await getReasoningRunByHouseId(houseId)
    const { error: chatUpdateError } = await supabase
      .from('house_console_chats')
      .update({ last_message_at: assistantReply.created_at, run_id_at_last_reply: run?.id ?? null })
      .eq('id', chatId)
    if (chatUpdateError) {
      log.error('houses/console', 'revise: chat bookkeeping update failed (non-fatal)', { error: chatUpdateError.message })
    }

    const userTurn: ConsoleTurn = {
      id: userReply.id,
      role: 'user',
      message: instruction,
      actions: null,
      rerunProposal: null,
      createdAt: userReply.created_at,
      revisesMessageId: null,
      revisionIteration: 0,
      critique: null,
    }
    const assistantTurn: ConsoleTurn = {
      id: assistantReply.id,
      role: 'assistant',
      message: answer,
      actions: null,
      rerunProposal: null,
      createdAt: assistantReply.created_at,
      revisesMessageId: target.id,
      revisionIteration: target.revision_iteration + 1,
      critique,
    }
    return NextResponse.json({ userTurn, assistantTurn })
  } catch (err) {
    if (err instanceof AiError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    log.error('houses/console', 'revise: unhandled error', { error: (err as Error)?.message })
    return NextResponse.json({ error: 'ai-upstream-error' }, { status: 502 })
  }
}
