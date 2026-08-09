// Content for the seven-node "constellation" diagram (components/marketing/
// Constellation.tsx), used on Home (compressed teaser) and How It Works
// (interactive). Ground truth for the layer order and the nine standards is
// lib/ai/reasoning/steps.ts and standards.ts — read there, never edited here,
// per the pre-login redesign brief's hard constraints.
//
// The per-layer standard meanings below are original plain-language copy for
// a general audience, written FROM (not quoted from) standards.ts's
// LAYER_STANDARD_CRITERIA — that file's criteria reference internal field
// names (core_question, supporting_chain, …) that mean nothing to a visitor,
// so this is a paraphrase, deliberately reworded rather than trimmed.

import { STANDARDS } from '@/lib/ai/reasoning/standards'
import type { StandardId } from '@/lib/ai/reasoning/contracts'

export type LayerId =
  | 'frame'
  | 'breadth-scoping'
  | 'perspectives'
  | 'global-assumptions'
  | 'global-evidence'
  | 'conclusions'
  | 'implications'

export const CONSTELLATION_STANDARDS = STANDARDS

export interface ConstellationLayer {
  id: LayerId
  name: string
  /** One line: what this layer actually does, in plain language. */
  job: string
  /** True for the six layers gated by the nine-standard review panel. */
  hasPanel: boolean
  /** Only set when hasPanel is true — one plain-language sentence per standard. */
  standardMeanings?: Record<StandardId, string>
}

export const CONSTELLATION_LAYERS: ConstellationLayer[] = [
  {
    id: 'frame',
    name: 'Frame',
    job: 'Pins down exactly what is being decided, defines the terms that matter, and sets the scope — without arguing for any side yet.',
    hasPanel: true,
    standardMeanings: {
      clarity: 'Is the question stated plainly enough that you would instantly know what is being decided?',
      accuracy: 'Does the framing faithfully capture what was actually asked, without quietly narrowing it?',
      precision: 'Are the key terms defined concretely, instead of in vague generalities?',
      relevance: 'Do the definitions and scope actually bear on answering the question?',
      depth: 'Does the framing account for how many considerations are genuinely at stake?',
      breadth: 'Does the scope leave room for genuinely different angles, rather than pre-narrowing toward one?',
      logic: 'Does the framing avoid quietly assuming the answer before the reasoning even starts?',
      significance: 'Is this question substantial enough to justify the full process?',
      fairness: 'Is the language neutral, rather than tilted toward one side?',
    },
  },
  {
    id: 'breadth-scoping',
    name: 'Breadth Scoping',
    job: 'A single judgment call: how many genuinely distinct, worthwhile perspectives does this question deserve? Made once — no review panel, no redundancy to fall back on for this step.',
    hasPanel: false,
  },
  {
    id: 'perspectives',
    name: 'Perspectives',
    job: 'Builds several independent, honestly-argued stances, each with its own claims, sub-questions, assumptions, evidence, and a real counterargument against itself.',
    hasPanel: true,
    standardMeanings: {
      clarity: 'Does the stance commit to one clear position, instead of hedging about what it even argues?',
      accuracy: 'Are its claims and evidence real and defensible, not overstated or misrepresented?',
      precision: 'Is the argument specific to this exact question, not generic pro/con boilerplate?',
      relevance: 'Does everything in the stance actually serve its own case, rather than drifting off-topic?',
      depth: 'Does it argue its strongest real form, and does its self-attack target real weaknesses?',
      breadth: 'Does it draw on a genuine range of angles, rather than one point repeated?',
      logic: 'Does the reasoning hold together, and does the counterargument actually land on the real claims?',
      significance: 'Does it focus on what would matter most to someone who actually holds this view?',
      fairness: 'Is the counterargument a real, honest attack — not a strawman — and are opposing views represented fairly?',
    },
  },
  {
    id: 'global-assumptions',
    name: 'Global Assumptions',
    job: 'Surfaces the assumptions sitting underneath the whole question — not just one stance’s.',
    hasPanel: true,
    standardMeanings: {
      clarity: 'Is each assumption stated as one clear claim, not a vague generality?',
      accuracy: 'Are these genuinely implicit in the question, rather than misattributed to it?',
      precision: 'Is each assumption named specifically, not a fuzzy gesture at a theme?',
      relevance: 'Does each one actually matter to answering the question?',
      depth: 'Do they surface non-obvious assumptions the conclusion would quietly depend on?',
      breadth: 'Do they genuinely cut across perspectives, rather than repeating one stance’s own list?',
      logic: 'Is the case for why these are cross-cutting actually coherent, not just asserted?',
      significance: 'Would the answer meaningfully change if one of these turned out false?',
      fairness: 'Do they scrutinize every side evenly, rather than singling one out?',
    },
  },
  {
    id: 'global-evidence',
    name: 'Global Evidence',
    job: 'Gathers evidence that bears on the question itself, not just one stance’s case.',
    hasPanel: true,
    standardMeanings: {
      clarity: 'Is it plain what each piece of evidence would actually show?',
      accuracy: 'Is anything not yet verified honestly flagged as such, rather than stated with false confidence?',
      precision: 'Is the kind of source needed specific, not a vague "some research shows"?',
      relevance: 'Does each item bear on the question itself, rather than just one stance’s argument?',
      depth: 'Does it engage the genuinely contested parts of the question, not just easy surface facts?',
      breadth: 'Does the evidence span a spread of angles, rather than all pointing one direction?',
      logic: 'Does each claim follow reasonably from its source, without an unjustified leap?',
      significance: 'Is this evidence that would actually move the answer, not tangential trivia?',
      fairness: 'Does it represent multiple sides, rather than being cherry-picked toward one?',
    },
  },
  {
    id: 'conclusions',
    name: 'Conclusions',
    job: 'Draws the verdict(s) that actually follow from everything that passed review.',
    hasPanel: true,
    standardMeanings: {
      clarity: 'Is the verdict direct and committed, not hedge-everything mush?',
      accuracy: 'Does it represent what the evidence and assumptions actually established, without overstating them?',
      precision: 'Is it specific about what it claims, and under what conditions?',
      relevance: 'Does it actually answer the question that was asked?',
      depth: 'Does it engage the real tension in the evidence, rather than a surface "the evidence supports X"?',
      breadth: 'Does it account for the range of perspectives and evidence gathered, including the ones that cut against it?',
      logic: 'Does it genuinely follow from what came before, without overreaching beyond what was established?',
      significance: 'Does it address what is actually at stake, not a minor corollary of it?',
      fairness: 'Does it weigh multiple sides, rather than reading as pre-decided?',
    },
  },
  {
    id: 'implications',
    name: 'Implications',
    job: 'Maps what follows if the conclusion is adopted — positive, negative, and uncertain — who is affected, and on what timeline.',
    hasPanel: true,
    standardMeanings: {
      clarity: 'Is each implication a clear, concrete statement of what follows, not hand-waving?',
      accuracy: 'Does it actually follow from the stated conclusion, rather than inventing an unrelated consequence?',
      precision: 'Are who is affected and the timeline named specifically, not generic?',
      relevance: 'Does it actually follow from adopting the conclusion, rather than being a tangent?',
      depth: 'Does it explore real downstream effects, not just the most obvious first-order one?',
      breadth: 'Does it span positive, negative, and uncertain, and different people affected?',
      logic: 'Does it logically follow if the conclusion is adopted, without a non-sequitur?',
      significance: 'Would this implication actually matter to someone deciding, not a trivial side-effect?',
      fairness: 'Are the upsides and downsides both explored honestly, rather than stacking the deck one way?',
    },
  },
]
