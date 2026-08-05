// Server-only pro/con synthesis of a finished reasoning-pipeline run, plus
// the ask-AI sidebar's answer generation. Mirrors the pipeline's own fan-out
// pattern (orchestrator-panel.ts/orchestrator-perspectives.ts): a stage-1 fan
// of independent extraction agents, feeding a single stage-2 consolidator —
// but scoped to ONE synthesis call, not a 17-step run, so schemas, prompts,
// and orchestration all live in this one file rather than split across
// contracts.ts/prompts.ts/orchestrator-*.ts.
//
// Every stage-1 agent shares one persona: they are organizing material the
// pipeline's own review panels already vetted, never re-judging or
// second-guessing it, and never inventing a claim not already present in
// what they were given. This is what keeps the synthesis honest — it's a
// reorganization of already-reviewed content, not a fresh pass of reasoning.

import { z } from 'zod'
import { completeJSON } from '@/lib/ai/router'
import { serializeFrame, serializePerspectives } from './prompts'
import type { RunState } from '@/components/admin/reasoning/ReasoningStagesList'

if (typeof window !== 'undefined') {
  throw new Error('lib/ai/reasoning/synthesis.ts is server-only and must not run in the browser')
}

const str = z.string().min(1).max(600)

// ── Schemas ──────────────────────────────────────────────────────────────
export const SynthesisPointSchema = z.object({ point: str, basis: str })
export type SynthesisPoint = z.infer<typeof SynthesisPointSchema>

export const SynthesisExtractSchema = z.object({
  points: z.array(SynthesisPointSchema).min(1).max(6),
})
export type SynthesisExtract = z.infer<typeof SynthesisExtractSchema>

export const ProConSynthesisSchema = z.object({
  pros: z.array(SynthesisPointSchema).min(1).max(8),
  cons: z.array(SynthesisPointSchema).min(1).max(8),
  key_tension: str,
  open_questions: z.array(str).max(6),
})
export type ProConSynthesis = z.infer<typeof ProConSynthesisSchema>

export const SynthesisChatTurnSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(4000),
  at: z.string(),
})
export type SynthesisChatTurn = z.infer<typeof SynthesisChatTurnSchema>

export const SynthesisAskResponseSchema = z.object({ answer: z.string().min(1).max(3000) })
export type SynthesisAskResponse = z.infer<typeof SynthesisAskResponseSchema>

// ── Prompts ──────────────────────────────────────────────────────────────
const SYNTHESIS_PERSONA = `You are organizing material a multi-agent reasoning pipeline has already generated and vetted through review panels — you are NOT re-judging, re-arguing, or second-guessing any of it. Never invent a claim, source, or point that is not already present in what you were given below. Plain, direct language — no hedging filler.`

const SUPPORTING_CASE_BLOCK = `Task: pull out the strongest points IN FAVOR of the question's answer from the material below — grounded only in what the perspectives already claimed and the positive implications already identified.

Return 1-6 points, each: point (the claim itself, stated plainly) and basis (which perspective, claim, or implication it is drawn from). Organize what is already there — do not soften, strengthen, or invent.`

const OPPOSING_CASE_BLOCK = `Task: pull out the strongest points AGAINST the question's answer from the material below — grounded only in the rebuttals each perspective's counterargument already made and the negative implications already identified.

Return 1-6 points, each: point and basis. Organize what is already there — do not soften, strengthen, or invent.`

const TENSION_BLOCK = `Task: name the genuine tensions and open questions in the material below — grounded only in the uncertain implications, the final answer's caveats, and the question-level assumptions already identified.

Return 1-6 points, each: point (the tension or open question, stated plainly) and basis (what it is drawn from). Organize what is already there — do not soften, strengthen, or invent.`

const CONSOLIDATOR_BLOCK = `Task: given three organized extracts below (a supporting case, an opposing case, and a set of tensions/open questions) plus the run's own conclusions and final answer, consolidate them into one clean pro/con synthesis for someone who wants the shape of the disagreement, not the raw pipeline trace.

Merge near-duplicate points into one; drop anything vague or merely restated elsewhere; keep every substantively distinct point. Return pros (1-8) and cons (1-8), each with point and basis (carry the basis through a merge, or restate it if you combined two). key_tension is a genuine synthesis of the real tension at stake — one or two sentences that name what is actually in tension, not a side-by-side listing of the pros and cons. open_questions (up to 6) come from the tension extract's points plus the final answer's caveats — phrase them as questions, not statements.`

const ASK_BLOCK = `Task: answer the admin's follow-up question about the synthesis below, grounded only in the run's material and the synthesis itself. Never invent anything beyond what you were given — if the material genuinely doesn't say, say so plainly rather than guessing.

Return a single, direct answer.`

// ── Context serialization — each stage-1 agent sees only what its own task
// needs (perspectives.ts's `serializeFrame`/`serializePerspectives` already
// used elsewhere carry MUCH more than any one of these three needs). ────────
function coreQuestionLine(run: RunState): string {
  return `## Core question\n${run.frame?.core_question ?? run.originalQuery}`
}

function implicationsByKind(run: RunState, kind: 'pos' | 'neg' | 'unc'): string {
  const items = (run.implications?.implications ?? []).filter((i) => i.ikind === kind)
  return items.length ? items.map((i) => `- ${i.text} (${i.who}, ${i.horizon})`).join('\n') : '(none)'
}

function serializeSupportingContext(run: RunState): string {
  const perspectives = (run.perspectives ?? [])
    .map((p) => `### ${p.stance_label}\n${p.key_claims.map((c) => `- ${c}`).join('\n')}`)
    .join('\n\n')
  return `${coreQuestionLine(run)}\n\n## Perspectives' key claims\n${perspectives || '(none)'}\n\n## Positive implications\n${implicationsByKind(run, 'pos')}`
}

function serializeOpposingContext(run: RunState): string {
  const rebuttals = (run.perspectives ?? [])
    .map((p) => `### Against ${p.stance_label}\n${p.counterargument.rebuttals.map((r) => `- ${r}`).join('\n')}`)
    .join('\n\n')
  return `${coreQuestionLine(run)}\n\n## Counterarguments\n${rebuttals || '(none)'}\n\n## Negative implications\n${implicationsByKind(run, 'neg')}`
}

function serializeTensionContext(run: RunState): string {
  const caveats = (run.finalAnswer?.caveats ?? []).map((c) => `- ${c}`).join('\n') || '(none)'
  const assumptions =
    (run.globalAssumptions?.question_level_assumptions ?? []).map((a) => `- ${a}`).join('\n') || '(none)'
  return `${coreQuestionLine(run)}\n\n## Uncertain implications\n${implicationsByKind(run, 'unc')}\n\n## Final answer's caveats\n${caveats}\n\n## Question-level assumptions\n${assumptions}`
}

function serializeExtract(extract: SynthesisExtract): string {
  return extract.points.map((p) => `- ${p.point} (${p.basis})`).join('\n')
}

// ── Generation ───────────────────────────────────────────────────────────
// All-or-nothing (mirrors runReviewPanel's Promise.all precedent): if any
// stage-1 call fails, this whole function rejects — the route below returns
// 502 and persists nothing, rather than caching a synthesis silently missing
// its cons (or pros, or tensions).
export async function generateProConSynthesis(run: RunState): Promise<ProConSynthesis> {
  const [supporting, opposing, tension] = await Promise.all([
    completeJSON({
      role: 'drafter',
      system: `${SYNTHESIS_PERSONA}\n\n${SUPPORTING_CASE_BLOCK}`,
      user: serializeSupportingContext(run),
      schema: SynthesisExtractSchema,
      schemaName: 'synthesis_supporting_case',
      effort: 'high',
      maxTokens: 1200,
    }),
    completeJSON({
      role: 'drafter',
      system: `${SYNTHESIS_PERSONA}\n\n${OPPOSING_CASE_BLOCK}`,
      user: serializeOpposingContext(run),
      schema: SynthesisExtractSchema,
      schemaName: 'synthesis_opposing_case',
      effort: 'high',
      maxTokens: 1200,
    }),
    completeJSON({
      role: 'drafter',
      system: `${SYNTHESIS_PERSONA}\n\n${TENSION_BLOCK}`,
      user: serializeTensionContext(run),
      schema: SynthesisExtractSchema,
      schemaName: 'synthesis_tension',
      effort: 'high',
      maxTokens: 1200,
    }),
  ])

  const conclusions = (run.conclusions?.conclusions ?? []).map((c) => `- ${c}`).join('\n') || '(none)'
  const consolidatorContext = `## Supporting case (organized)\n${serializeExtract(supporting)}\n\n## Opposing case (organized)\n${serializeExtract(opposing)}\n\n## Tensions and open questions (organized)\n${serializeExtract(tension)}\n\n## Conclusions\n${conclusions}\n\n## Final answer\n${run.finalAnswer?.answer ?? '(none)'}`

  return completeJSON({
    role: 'coach',
    system: `${SYNTHESIS_PERSONA}\n\n${CONSOLIDATOR_BLOCK}`,
    user: consolidatorContext,
    schema: ProConSynthesisSchema,
    schemaName: 'pro_con_synthesis',
    effort: 'high',
    maxTokens: 2000,
  })
}

// ── Ask-AI sidebar ───────────────────────────────────────────────────────
function serializeSynthesis(synthesis: ProConSynthesis): string {
  const pros = synthesis.pros.map((p) => `- ${p.point} (${p.basis})`).join('\n')
  const cons = synthesis.cons.map((p) => `- ${p.point} (${p.basis})`).join('\n')
  const openQuestions = synthesis.open_questions.map((q) => `- ${q}`).join('\n') || '(none)'
  return `## Pro/con synthesis\nPros:\n${pros}\n\nCons:\n${cons}\n\nKey tension: ${synthesis.key_tension}\n\nOpen questions:\n${openQuestions}`
}

function serializePriorChat(priorChat: SynthesisChatTurn[]): string {
  if (priorChat.length === 0) return ''
  const turns = priorChat.map((t) => `${t.role === 'user' ? 'Admin' : 'Assistant'}: ${t.content}`).join('\n')
  return `\n\n## Prior conversation\n${turns}`
}

export async function answerSynthesisQuestion(
  run: RunState,
  synthesis: ProConSynthesis,
  priorChat: SynthesisChatTurn[],
  question: string
): Promise<string> {
  const frameContext = run.frame ? serializeFrame(run.frame) : `Core question: ${run.originalQuery}`
  const perspectivesContext = run.perspectives ? serializePerspectives(run.perspectives) : '(none)'
  const context = `${frameContext}\n\n## Perspectives\n${perspectivesContext}\n\n${serializeSynthesis(synthesis)}${serializePriorChat(priorChat)}\n\n## Question\n${question}`

  const result = await completeJSON({
    role: 'coach',
    system: `${SYNTHESIS_PERSONA}\n\n${ASK_BLOCK}`,
    user: context,
    schema: SynthesisAskResponseSchema,
    schemaName: 'synthesis_ask_response',
    effort: 'low',
    maxTokens: 900,
  })
  return result.answer
}
