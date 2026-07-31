// The nine Universal Intellectual Standards (Paul-Elder) and where each is
// particularly diagnostic, per 01-layers-and-standards.md. Client-safe (no
// server imports) — shared by the review-panel prompt builder and the UI.
//
// This is a DIFFERENT concept from the six-standard Socratic critic already
// shipped at /api/ai/critique (lib/ai/prompts.ts CRITIQUE_BLOCK): that one
// bundles six standards into a single session reviewing finished house
// content. Here, each of the nine standards is graded by its OWN independent
// reviewer call, seeing only its own definition — see decisions/019 §3 for
// why this repo calls the group the "review panel," never "critics."

import type { StandardId } from './contracts'
import { REVIEW_GATE_STEPS, type ReviewGateStep } from './steps'

export interface StandardDef {
  id: StandardId
  name: string
  // Generic, layer-agnostic gloss — kept for reference/documentation only.
  // Every actual reviewer prompt uses LAYER_STANDARD_CRITERIA below instead,
  // since what each standard means differs by what the layer is even for
  // (2026-07-30: found live that grading Frame's "depth" against the generic
  // "engages real complexities" definition unfairly penalizes framing, whose
  // job is to pose the question, not argue it).
  definition: string
}

export const STANDARDS: StandardDef[] = [
  { id: 'clarity', name: 'Clarity', definition: 'Is it understandable, free of vagueness and ambiguity?' },
  { id: 'accuracy', name: 'Accuracy', definition: 'Is it true, and free of distortion or error?' },
  { id: 'precision', name: 'Precision', definition: 'Is it specific enough — exact details, not loose approximation?' },
  { id: 'relevance', name: 'Relevance', definition: 'Does it actually bear on the question at hand?' },
  { id: 'depth', name: 'Depth', definition: 'Does it engage the real complexities, not just the surface?' },
  { id: 'breadth', name: 'Breadth', definition: 'Does it consider other relevant viewpoints, not just one?' },
  { id: 'logic', name: 'Logic', definition: 'Does the reasoning actually follow — no contradictions, no non-sequiturs?' },
  { id: 'significance', name: 'Significance', definition: 'Does it focus on what actually matters most, not a minor point?' },
  { id: 'fairness', name: 'Fairness', definition: 'Is it even-handed, not self-serving or one-sided?' },
]

// Per-layer, per-standard criteria — what each of the nine standards actually
// means AT THIS SPECIFIC LAYER, given what that layer's artifact is and is
// for. This REPLACES the standard's generic definition in the reviewer prompt
// (buildReviewerPrompt), not just supplements it — e.g. "depth" at Frame asks
// how many considerations the framing accounts for and whether the question
// is crisp or vague, never whether it argues anything (framing shouldn't
// argue yet); "depth" at Perspectives asks whether the stance engages its
// strongest form. `Record<ReviewGateStep, Record<StandardId, string>>` is
// exhaustive by construction — a missing gate or standard is a type error.
export const LAYER_STANDARD_CRITERIA: Record<ReviewGateStep, Record<StandardId, string>> = {
  // Frame produces: core_question, definitions[], purpose, scope_notes.
  // Job: pose the question clearly and set up terms/scope — NOT argue it.
  'frame-review': {
    clarity:
      "Is core_question phrased so a reader immediately grasps what's being decided — no ambiguous pronouns, no compound multi-part question?",
    accuracy:
      'Does core_question and purpose faithfully restate what was actually asked, without silently narrowing, broadening, or shifting it?',
    precision:
      'Are the definitions concrete and specific to this question (not circular or generic dictionary text), and does scope_notes name specifics rather than hand-wave?',
    relevance:
      'Do the definitions and scope_notes actually bear on resolving core_question, rather than pulling in tangential background?',
    depth:
      'How many of the concepts and considerations genuinely at stake in this question does the framing account for (in definitions/scope_notes)? Depth here means breadth of what has been considered, NOT argumentative depth — framing should not argue yet.',
    breadth:
      'Does scope_notes leave room for genuinely different angles to be explored later, rather than pre-narrowing toward one side of the question?',
    logic:
      'Does the framing avoid begging the question — does core_question pose the issue neutrally rather than presupposing an answer?',
    significance:
      'Is this core_question substantial enough to justify the full pipeline, not a trivial or already-settled matter?',
    fairness:
      'Is the framing neutral in language and scope, avoiding wording or a scope that already tilts toward one conclusion?',
  },

  // Perspectives (per bundle) produce: stance_summary, key_claims,
  // sub_questions, assumptions, evidence, counterargument. Job: argue ONE
  // stance as strongly and honestly as possible, then attack it for real.
  'perspectives-review': {
    clarity:
      "Is the stance stated as one clear, committed position, not hedged or ambiguous about what it's actually arguing?",
    accuracy:
      'Do the key_claims and evidence represent real, defensible claims rather than overstated or misrepresented certainty?',
    precision:
      'Are key_claims and sub_questions specific to this exact question, not generic pro/con boilerplate that could apply to any debate?',
    relevance:
      "Do the sub_questions, assumptions, and evidence actually serve THIS stance's case, rather than drifting into unrelated territory?",
    depth:
      'Does the stance engage its strongest, most substantive form (not a shallow take), and does the counterargument attack the actual key_claims rather than a strawman?',
    breadth:
      'Does this stance draw on a genuine range of sub-questions and evidence, rather than resting on one narrow point repeated?',
    logic:
      "Do the rebuttals in counterargument logically address the specific target_claims, and does the stance's own reasoning hold together without contradiction?",
    significance:
      'Do the key_claims focus on what would actually matter most to someone holding this view, not peripheral details?',
    fairness:
      'Is the counterargument a genuine, serious attack rather than a strawman, and does the stance represent opposing views honestly rather than caricaturing them?',
  },

  // Global assumptions produce: question_level_assumptions[],
  // cross_perspective_notes. Job: surface assumptions that cut across or
  // beyond individual perspectives — question-scoped, not stance-scoped.
  'global-assumptions-review': {
    clarity: 'Is each assumption stated as one clear claim, not a vague generality?',
    accuracy: 'Are these assumptions genuinely implicit in the perspectives or the question, not misattributed to them?',
    precision: 'Is each assumption named specifically — the actual claim being assumed — not a fuzzy gesture at a theme?',
    relevance:
      'Do these assumptions actually matter to answering the core question, rather than being incidental background beliefs?',
    depth:
      "Do they surface non-obvious, load-bearing assumptions the conclusion would depend on, rather than restating what a perspective already stated explicitly?",
    breadth:
      "Do these assumptions genuinely cut ACROSS perspectives (question-level), rather than duplicating one perspective's own already-listed assumptions?",
    logic:
      'Is cross_perspective_notes\' reasoning for why these assumptions are cross-cutting actually coherent and demonstrated, not merely asserted?',
    significance: 'Are these the assumptions that would most change the answer if they turned out false, not trivial ones?',
    fairness: "Do the assumptions avoid disproportionately scrutinizing one perspective's side over the others?",
  },

  // Global evidence produces: question_level_evidence[]. Job: name evidence
  // relevant to the question itself, not confined to one stance. No live
  // search in Phase 1 — items describe what evidence would be needed.
  'global-evidence-review': {
    clarity: "Is each item's claim_id and source_ref stated plainly, leaving no ambiguity about what it would show?",
    accuracy:
      "Is each item honestly flagged as not-yet-verified (there's no live search here), rather than presented with false confidence?",
    precision: "Is source_ref specific about what kind of source or study is needed, not a generic 'some research shows'?",
    relevance: "Does each item actually bear on the core question itself, not just one stance's argument?",
    depth: 'Does the evidence engage substantive, genuinely contested aspects of the question, not just easy surface facts?',
    breadth: 'Does the evidence list span a spread of angles, rather than all implicitly supporting one side?',
    logic: "Does each item's claim follow reasonably from its stated source_ref, without an unjustified leap?",
    significance: 'Is this the evidence that would actually move the needle on the question, not tangential trivia?',
    fairness: 'Does the evidence list represent multiple sides fairly, rather than being cherry-picked toward one?',
  },

  // Conclusions produce: conclusions[], supporting_chain[]. Job: draw the
  // verdict(s) that actually follow from the vetted assumptions and evidence.
  'conclusions-review': {
    clarity: 'Is the conclusion stated as a direct, committed verdict, not hedge-everything mush?',
    accuracy:
      'Does supporting_chain correctly represent what the assumptions and evidence actually established, without misquoting or overstating them?',
    precision: 'Is the conclusion specific about what it claims and under what conditions, not vague?',
    relevance: 'Does the conclusion actually answer core_question, not a nearby-but-different question?',
    depth:
      "Does supporting_chain engage the real tension or tradeoffs in the evidence, rather than a superficial 'evidence supports X' assertion?",
    breadth:
      'Does the conclusion account for the range of perspectives and evidence gathered, rather than ignoring ones that cut against it?',
    logic:
      'Does the conclusion genuinely follow from supporting_chain, without overreaching beyond what the assumptions and evidence support?',
    significance: "Does the conclusion address what's actually at stake in the question, not a minor corollary of it?",
    fairness:
      'Does the conclusion fairly weigh evidence and perspectives on multiple sides, rather than reading as pre-decided?',
  },

  // Implications produce: implications[] (ikind/text/horizon/who),
  // confidence, caveats. Job: map consequences IF the conclusion(s) adopted.
  'implications-review': {
    clarity: "Is each implication's text a clear, concrete statement of what follows, not vague hand-waving?",
    accuracy: 'Do the implications correctly follow from the actual stated conclusions, rather than inventing unrelated consequences?',
    precision:
      "Are who and horizon specific — a named party and a concrete near-/long-term claim — rather than generic ('society', 'eventually')?",
    relevance: "Does each implication actually follow from adopting the stated conclusion(s), rather than being a tangent?",
    depth: 'Do the implications explore genuine second-order/downstream effects, not just the most obvious first-order ones?',
    breadth:
      'Do the implications span multiple kinds (pos/neg/unc) and different affected parties, rather than clustering on one type?',
    logic: 'Does each implication logically follow IF the conclusion is adopted, without a non-sequitur?',
    significance: "Are these the implications that would actually matter to someone deciding, not trivial side-effects?",
    fairness: 'Are positive and negative implications both explored honestly, rather than stacking the deck one way?',
  },
}

// Defensive: every gate × every standard has a non-empty criterion. Throws at
// module load (import time) rather than silently shipping a gap.
for (const gate of REVIEW_GATE_STEPS) {
  for (const standard of STANDARDS) {
    if (!LAYER_STANDARD_CRITERIA[gate]?.[standard.id]?.trim()) {
      throw new Error(`Missing per-layer criterion: ${gate} / ${standard.id}`)
    }
  }
}
