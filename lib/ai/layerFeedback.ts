// Client-safe contract for POST/GET /api/houses/[id]/layer-feedback — the
// post-draft Q&A/correction thread (migration 0039). Mirrors lib/ai/draft.ts's
// shape on purpose: same DraftStage enum, same AiAction vocabulary. A
// correction is a small, targeted, human-prompted version of the same stage
// draft, not a new capability, so it reuses Draft Mode's contract rather than
// inventing a parallel one.

import { z } from 'zod'
import { AiActionSchema } from './findings'
import { DRAFT_STAGES } from './draft'

// One person-typed message, at most a couple of sentences — this is a quick
// "wait, why..." or "you didn't know X", not a place to paste an essay.
export const LAYER_FEEDBACK_MESSAGE_MAX = 500

export const LayerFeedbackResponseSchema = z.object({
  answer: z.string().min(1).max(600),
  // Capped well below a stage draft's own batch (lib/ai/draft.ts's actions.max(12))
  // — a single correction turn should be a small, targeted fix, not a re-draft.
  actions: z.array(AiActionSchema).max(4),
})
export type LayerFeedbackResponse = z.infer<typeof LayerFeedbackResponseSchema>

export interface LayerFeedbackTurn {
  id: string
  role: 'user' | 'assistant'
  message: string
  // Only ever populated on an 'assistant' turn; null otherwise or when the
  // reply proposed nothing.
  actions: z.infer<typeof AiActionSchema>[] | null
  createdAt: string
}

export const LayerFeedbackStageSchema = z.enum(DRAFT_STAGES)
