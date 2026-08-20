// Maps the reasoning pipeline's finished packets onto the house schema
// (plans/active/reasoning-pipeline/27-house-scoped-pipeline-integration.md
// §3), riding Draft Mode's existing AiAction/claim mechanism (decision 016)
// rather than a new insertion path — every mapped item lands as an
// AiAction, dispatched once via APPLY_REASONING_RESULT (lib/build/state.ts),
// which seeds a fresh, unclaimed DraftState exactly like an ordinary Draft
// Mode run. Pure + client-safe: no server imports, mirrors lib/ai/draft.ts.
//
// Judgment calls made here (flagged in the implementation report, not
// silently decided):
//
//  - houses.question / houses.conclusion / houses.reasoning are deliberately
//    NOT produced by this module, even though the plan doc's own mapping
//    table names FramePacket.core_question / ConclusionsPacket.conclusions /
//    FinalAnswer.answer as their sources. Invariant 1
//    (plans/active/ai/README.md): "The AI never writes the conclusion. No AI
//    output may set conclusion, reasoning, question, or purpose... enforced
//    in the AiAction type (no variant targets those fields) — not just in
//    prompts." Decision 018's one precedent for AI-authored conclusion text
//    is a narrow, fenced, ADMIN-ONLY exception ("no public route, no other
//    surface, and no non-admin account gains this"); this route is reachable
//    by any standard/teacher account owner, so silently writing those three
//    fields here would be a materially bigger breach of that invariant than
//    anything previously shipped. Instead: `houses.question` is set by the
//    HUMAN's own typed prompt at run-start time (see
//    components/build/rail/ReasoningPipelineCard.tsx — dispatches
//    SET_QUESTION with literally what the person typed, never the AI's
//    core_question); `houses.conclusion` / `houses.reasoning` are offered as
//    a one-click "Use as my conclusion" suggestion the person must
//    explicitly click (same file), dispatching the pre-existing
//    SET_CONCLUSION/SET_REASONING actions — never through AiActionSchema,
//    never automatic. This is a deviation from the plan doc's literal table
//    and needs Samir's sign-off.
//  - PerspectiveBundle.key_claims has no destination in the plan's own
//    mapping table (only stance_label/stance_summary/sub_questions/rebuttals
//    are named). Rather than drop it, it's folded into add_perspective's
//    `stance` field (joined with '; ') — Perspective already has a separate
//    `stance` string the plan doesn't otherwise fill, and losing every
//    perspective's key claims entirely seemed worse than repurposing that
//    field.
//  - PerspectiveBundle.evidence (nested) and counterargument.rebuttals
//    needed two AiAction kinds that didn't exist before this change
//    (add_perspective_evidence, add_counter — lib/ai/findings.ts +
//    lib/build/aiActions.ts) since Perspective.supportingEvidence/counters
//    are nested per-perspective, not the flat house_evidence table, and no
//    existing AiAction could reach them.
//  - Evidence packets (both per-perspective and global) only ever carry
//    claim_id (documented in lib/ai/reasoning/prompts.ts as "a short slug
//    naming what it supports", not prose) and source_ref (a URL OR a plain
//    source name) — neither packet has a long-form evidentiary text field.
//    claim_id becomes the house evidence `text`; source_ref becomes both
//    `source` and `url` (the closest available string to a citation link,
//    even when it isn't literally a URL). Per-perspective evidence's
//    confidence/caveats have no matching nested house field
//    (supportingEvidence is {text, source} only) and are dropped.
//  - Per-perspective PerspectiveBundle.assumptions have no house destination
//    either — only the GLOBAL assumptions packet is named in the plan's
//    table (→ house_assumptions) — so per-perspective assumptions are
//    dropped, not folded anywhere.
//  - A degraded perspective (review panel never passed it, 03-orchestration-
//    and-failure-handling.md) is still mapped like any other bundle — same
//    posture as the pipeline itself, which forwards degraded bundles to
//    every downstream layer rather than discarding them; the house-side
//    claim step is exactly where a person can catch and edit/remove one.
//  - Every string field is defensively re-capped to the target AiAction
//    field's own declared max length (findings.ts) before being emitted,
//    since several packet fields (contracts.ts) are allowed to run longer
//    (600, sometimes 1000+ chars) than the AiAction schema's shared 300-char
//    `str`. Nothing currently re-validates a reducer-dispatched action
//    against AiActionSchema, so this never throws either way — the
//    truncation is just hygiene so the emitted actions stay honestly
//    schema-conformant.

import type { AiAction } from '../findings'
import type {
  FramePacket,
  PerspectiveBundle,
  GlobalAssumptionsPacket,
  GlobalEvidencePacket,
  ImplicationsPacket,
} from './contracts'

// The subset of RunState (app/api/admin/reasoning/route-schema.ts /
// components/admin/reasoning/ReasoningStagesList.tsx's client mirror) this
// module actually reads — kept as its own narrow interface rather than
// importing either of those so this stays a leaf module with no dependency
// on a 'use client' component file or a Next.js route module.
export interface ReasoningResultPackets {
  frame?: FramePacket | null
  perspectives?: PerspectiveBundle[] | null
  globalAssumptions?: GlobalAssumptionsPacket | null
  globalEvidence?: GlobalEvidencePacket | null
  implications?: ImplicationsPacket | null
}

const SHORT_MAX = 300 // findings.ts's shared `str`
const LONG_MAX = 1000 // findings.ts's `longStr` (add_perspective_evidence/add_counter)

function cap(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) : s
}

// Flattens every mapped packet into ONE ordered AiAction batch — ordering
// (perspectives before anything that targets one by name) is handled by the
// reducer (lib/build/state.ts's APPLY_REASONING_RESULT), not here, so this
// function can emit in natural packet order.
export function mapReasoningRunToActions(run: ReasoningResultPackets): AiAction[] {
  const actions: AiAction[] = []

  for (const def of run.frame?.definitions ?? []) {
    actions.push({ kind: 'add_concept', term: cap(def.term, SHORT_MAX), definition: cap(def.definition, SHORT_MAX) })
  }

  for (const p of run.perspectives ?? []) {
    actions.push({
      kind: 'add_perspective',
      name: cap(p.stance_label, SHORT_MAX),
      summary: cap(p.stance_summary, SHORT_MAX),
      // key_claims has no dedicated destination in the plan's mapping table
      // — folded in here rather than dropped (see module comment).
      stance: cap(p.key_claims.join('; '), SHORT_MAX),
    })
    for (const q of p.sub_questions) {
      actions.push({ kind: 'add_subquestion', perspectiveName: p.stance_label, q: cap(q, SHORT_MAX) })
    }
    for (const e of p.evidence) {
      actions.push({
        kind: 'add_perspective_evidence',
        perspectiveName: p.stance_label,
        text: cap(e.claim_id, LONG_MAX),
        source: cap(e.source_ref, LONG_MAX),
      })
    }
    for (const r of p.counterargument.rebuttals) {
      actions.push({ kind: 'add_counter', perspectiveName: p.stance_label, text: cap(r, LONG_MAX) })
    }
  }

  for (const e of run.globalEvidence?.question_level_evidence ?? []) {
    const source = cap(e.source_ref, SHORT_MAX)
    actions.push({ kind: 'add_evidence', text: cap(e.claim_id, SHORT_MAX), source, url: source })
  }

  for (const a of run.globalAssumptions?.question_level_assumptions ?? []) {
    actions.push({ kind: 'add_assumption', text: cap(a, SHORT_MAX) })
  }

  for (const imp of run.implications?.implications ?? []) {
    actions.push({
      kind: 'add_implication',
      ikind: imp.ikind,
      text: cap(imp.text, SHORT_MAX),
      horizon: imp.horizon,
      who: cap(imp.who, SHORT_MAX),
    })
  }

  return actions
}
