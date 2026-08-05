// Maps a finished reasoning-pipeline run into a real, editable House State
// ("View in house", plan 020-ish). Sibling to lib/classroom/strawman.ts's
// strawmanToState — same shape of job (AI-generated content → State), same
// house-of-cards principle: pure function, no server imports, easy to test
// and reuse. blankState() + emptyDraft() give every field a safe default so
// this never has to special-case a run that stopped partway (halted runs
// never reach here anyway — RunActions.tsx gates on finalAnswer != null).

import { blankState } from '@/lib/build/persistence'
import { emptyDraft, DRAFT_STAGES } from '@/lib/ai/draft'
import type { State, Perspective, Evidence, Assumption, Implication } from '@/lib/build/types'
import type { RunState } from '@/components/admin/reasoning/ReasoningStagesList'

// Preserves the multi-conclusion trail that State.conclusion (below) already
// compresses into one packaged answer — conclusions.conclusions[] can name
// more than one live conclusion (CONCLUSIONS_BLOCK, prompts.ts), and
// supporting_chain is the trail from assumptions/evidence to each.
function formatReasoning(conclusions: RunState['conclusions']): string {
  if (!conclusions) return ''
  const conclusionLines = conclusions.conclusions.map((c) => `- ${c}`).join('\n')
  const chainLines = conclusions.supporting_chain.map((c) => `- ${c}`).join('\n')
  return `Conclusions:\n${conclusionLines}\n\nSupporting chain:\n${chainLines}`
}

function mapPerspectives(bundles: RunState['perspectives']): Perspective[] {
  return (bundles ?? []).map((b, i) => ({
    id: i + 1,
    name: b.stance_label,
    summary: '',
    stance: b.stance_summary,
    // note carries the AI's own working answer (contracts.ts's
    // PerspectiveSubQuestionSchema, 2026-08-05) — no longer left blank.
    subQuestions: b.sub_questions.map((sq) => ({ q: sq.question, note: sq.answer })),
    // text is the concrete finding itself (a real stat/study/quote), source
    // the MLA 9 citation — both real, search-grounded content now, not a slug.
    supportingEvidence: b.evidence.map((e) => ({ text: e.finding, source: e.source_ref })),
    counters: b.counterargument.rebuttals,
    strength: 0,
    owner: 'ai',
  }))
}

function mapEvidence(globalEvidence: RunState['globalEvidence']): Evidence[] {
  return (globalEvidence?.question_level_evidence ?? []).map((e, i) => ({
    id: i + 1,
    text: e.claim_id,
    source: e.source_ref,
    owner: 'ai',
    byAI: true,
  }))
}

function mapAssumptions(globalAssumptions: RunState['globalAssumptions']): Assumption[] {
  return (globalAssumptions?.question_level_assumptions ?? []).map((a, i) => ({
    id: i + 1,
    text: a,
    owner: 'ai',
  }))
}

function mapImplications(
  implications: RunState['implications'],
  kind: 'pos' | 'neg' | 'unc'
): Implication[] {
  return (implications?.implications ?? [])
    .filter((i) => i.ikind === kind)
    .map((i, idx) => ({ id: idx + 1, text: i.text, horizon: i.horizon, who: i.who }))
}

// Pure mapping — no persistence. RunActions.tsx creates the house row, calls
// this to build its State, then saveHouse()s it (no expectedRev — first save
// of a fresh house).
export function reasoningRunToState(runState: RunState): State {
  const s = blankState()
  const frame = runState.frame

  s.title = frame?.core_question ?? runState.originalQuery
  s.question = frame?.core_question ?? runState.originalQuery
  s.purpose = frame?.purpose ?? ''
  s.concepts = (frame?.definitions ?? []).map((d) => ({ term: d.term, definition: d.definition }))

  s.conclusion = runState.finalAnswer?.answer ?? ''
  s.reasoning = formatReasoning(runState.conclusions)
  s.watchpoints = runState.finalAnswer?.caveats ?? []

  s.perspectives = mapPerspectives(runState.perspectives)
  s.evidence = mapEvidence(runState.globalEvidence)
  s.assumptions = mapAssumptions(runState.globalAssumptions)
  s.pos = mapImplications(runState.implications, 'pos')
  s.neg = mapImplications(runState.implications, 'neg')
  s.unc = mapImplications(runState.implications, 'unc')

  // Reuses the existing claim-gate/"provisional" House Strength UX for free:
  // every layer arrives already 'drafted' but 'claimed: false', so
  // DraftClaimBanner prompts the same per-layer review a Draft Mode house
  // gets. Safe against useDraftRunner ever firing — it only auto-continues
  // when state.draft.stage !== 'done' (useDraftRunner.ts), which this isn't.
  const draft = emptyDraft()
  s.draft = {
    ...draft,
    via: 'reasoning-pipeline',
    stage: 'done',
    drafted: Object.fromEntries(DRAFT_STAGES.map((stage) => [stage, true])) as typeof draft.drafted,
  }

  return s
}
