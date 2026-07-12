// POST /api/ai/strawman — generates a deliberately flawed "strawman" argument the
// teacher reviews and releases (plan phase 5; decision 007's one sanctioned author
// use). Teacher-authored: only the class's teacher may generate, and the audience
// / topics / criteria are read from the assignment (set by the teacher before
// generating), never trusted from the request body.
//
// Guarded: the assignment must have ai_strawman_enabled = true AND the caller must
// be the class's teacher. Pure function (invariant 4): returns content, never
// writes the DB — the teacher's client persists it via ensure_strawman_house +
// saveHouse.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { completeJSON, AiError } from '@/lib/ai/groq'
import { enforceAiLimit } from '@/lib/ai/limits'
import { createClient } from '@/lib/supabase/server'
import { STRAWMAN_SYSTEM } from '@/lib/ai/prompts'

export const maxDuration = 30

const MAX_BODY_BYTES = 8 * 1024

const RequestSchema = z.object({
  assignmentId: z.string().uuid(),
})

const StrawmanSchema = z.object({
  title: z.string(),
  conclusion: z.string(),
  reasoning: z.string(),
  perspectives: z
    .array(z.object({ name: z.string(), summary: z.string(), stance: z.string() }))
    .max(2),
  evidence: z.array(z.object({ text: z.string(), source: z.string() })).max(3),
  assumptions: z.array(z.string()).max(4),
})

export async function POST(req: Request): Promise<Response> {
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

  // Authoritative gate: the caller must be the class's teacher and the strawman
  // must be enabled. Params come from the assignment row, not the request.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const { data: assignment } = await supabase
    .from('assignments')
    .select('question, ai_strawman_enabled, class_id, strawman_grade_level, strawman_age, strawman_topics, strawman_criteria')
    .eq('id', parsed.data.assignmentId)
    .single()
  if (!assignment || !assignment.ai_strawman_enabled) {
    return NextResponse.json({ error: 'strawman-not-available' }, { status: 403 })
  }
  const { data: cls } = await supabase.from('classes').select('teacher_id').eq('id', assignment.class_id).single()
  if (!cls || cls.teacher_id !== user.id) {
    return NextResponse.json({ error: 'not-teacher' }, { status: 403 })
  }

  // Compose the audience/topics/criteria the teacher set (each optional).
  const lines = [`Question: ${assignment.question}`]
  if (assignment.strawman_grade_level) lines.push(`Audience grade level: ${assignment.strawman_grade_level}`)
  if (assignment.strawman_age) lines.push(`Audience age: ${assignment.strawman_age}`)
  if (assignment.strawman_topics) lines.push(`Extra topics to weave in: ${assignment.strawman_topics}`)
  if (assignment.strawman_criteria) lines.push(`Additional teacher criteria: ${assignment.strawman_criteria}`)
  lines.push('Write the strawman argument as JSON.')

  try {
    const content = await completeJSON({
      role: 'drafter',
      system: STRAWMAN_SYSTEM,
      user: lines.join('\n'),
      schema: StrawmanSchema,
      schemaName: 'strawman_house',
      effort: 'low',
      maxTokens: 2000,
    })
    return NextResponse.json(content)
  } catch (err) {
    if (err instanceof AiError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: 'ai-upstream-error' }, { status: 502 })
  }
}
