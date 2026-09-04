// Sector deep-dive analysis types and zod schemas. Client-safe (no server
// imports). Each sector type has its own analysis shape; findings are shared.

import { z } from 'zod'

// ── Shared ──────────────────────────────────────────────────────────────────

export type SectorType = 'implications' | 'perspectives'

export const SectorFindingSchema = z.object({
  severity: z.enum(['insight', 'warning', 'critical']),
  text: z.string().max(500),
})
export type SectorFinding = z.infer<typeof SectorFindingSchema>

// ── Implications sector ─────────────────────────────────────────────────────

const CausalChainSchema = z.object({
  trigger: z.string().max(600),
  secondOrder: z.array(z.object({
    text: z.string().max(600),
    likelihood: z.enum(['likely', 'possible', 'unlikely']),
  })).min(1).max(5),
  thirdOrder: z.array(z.object({
    text: z.string().max(600),
    likelihood: z.enum(['likely', 'possible', 'unlikely']),
  })).max(5),
})

const TimelineBandSchema = z.array(z.object({
  text: z.string().max(600),
  timeframe: z.string().max(100),
})).max(8)

const ScenarioSchema = z.object({
  name: z.string().max(120),
  condition: z.string().max(500),
  implications: z.array(z.object({
    text: z.string().max(600),
    kind: z.enum(['pos', 'neg', 'unc']),
  })).min(1).max(6),
  likelihood: z.enum(['likely', 'possible', 'unlikely']),
})

const InteractionSchema = z.object({
  pair: z.tuple([z.string().max(400), z.string().max(400)]),
  effect: z.string().max(600),
  nature: z.enum(['amplifying', 'canceling', 'neutral']),
})

export const ImplicationsSectorSchema = z.object({
  causalChains: z.array(CausalChainSchema).min(1).max(6),
  timeline: z.object({
    shortTerm: TimelineBandSchema,
    mediumTerm: TimelineBandSchema,
    longTerm: TimelineBandSchema,
  }),
  scenarios: z.array(ScenarioSchema).min(2).max(4),
  interactions: z.array(InteractionSchema).max(6),
  findings: z.array(SectorFindingSchema).min(1).max(5),
})
export type ImplicationsSectorAnalysis = z.infer<typeof ImplicationsSectorSchema>

// ── Perspectives sector ─────────────────────────────────────────────────────

const TensionSchema = z.object({
  perspective1: z.string().max(200),
  perspective2: z.string().max(200),
  conflictPoint: z.string().max(600),
  nature: z.enum(['value-based', 'factual', 'priority', 'methodological']),
  resolvable: z.boolean(),
  resolutionPath: z.string().max(600).optional(),
})

const AgreementSchema = z.object({
  perspectives: z.array(z.string().max(200)).min(2).max(8),
  commonGround: z.string().max(600),
  strength: z.enum(['strong', 'moderate', 'weak']),
})

const MissingVoiceSchema = z.object({
  voice: z.string().max(200),
  whyRelevant: z.string().max(600),
  likelyStance: z.string().max(600),
  impactOnConclusion: z.string().max(600),
})

const SteelManSchema = z.object({
  perspective: z.string().max(200),
  originalStance: z.string().max(600),
  strengthened: z.string().max(800),
  additionalEvidence: z.string().max(600),
  whatChanges: z.string().max(600),
})

const StakeholderMapEntrySchema = z.object({
  perspective: z.string().max(200),
  power: z.enum(['high', 'medium', 'low']),
  interest: z.enum(['high', 'medium', 'low']),
  influence: z.string().max(600),
})

export const PerspectivesSectorSchema = z.object({
  tensions: z.array(TensionSchema).min(1).max(8),
  agreements: z.array(AgreementSchema).max(6),
  missingVoices: z.array(MissingVoiceSchema).min(1).max(4),
  steelManned: z.array(SteelManSchema).min(1).max(4),
  stakeholderMap: z.array(StakeholderMapEntrySchema).min(2).max(12),
  findings: z.array(SectorFindingSchema).min(1).max(5),
})
export type PerspectivesSectorAnalysis = z.infer<typeof PerspectivesSectorSchema>

// ── Loaded sector row (from DB) ─────────────────────────────────────────────

export interface SectorRow {
  id: string
  house_id: string
  sector_type: SectorType
  status: 'generating' | 'complete' | 'failed'
  analysis: ImplicationsSectorAnalysis | PerspectivesSectorAnalysis | null
  findings: SectorFinding[] | null
  error: string | null
  created_at: string
  updated_at: string
}

// Labels and metadata for each sector type.
export const SECTOR_META: Record<SectorType, { label: string; description: string }> = {
  implications: {
    label: 'Implications deep-dive',
    description: 'Causal chains, timelines, scenarios, and interaction effects',
  },
  perspectives: {
    label: 'Perspectives deep-dive',
    description: 'Tensions, agreements, missing voices, and steel-manned arguments',
  },
}
