// Server-only reasoning-pipeline primitive: gates one artifact through the
// nine-standard review panel (decisions/019 §3 — "review panel," not
// "critic," to avoid conflating with the shipped six-standard Socratic critic
// at /api/ai/critique). This is the ONE shared runner reused at every gate,
// including nested once per perspective bundle at perspectives-review.

import { completeJSON } from '@/lib/ai/router'
import { log } from '@/lib/log'
import { STANDARDS, LAYER_STANDARD_CRITERIA } from './standards'
import { buildReviewerPrompt } from './prompts'
import { SingleStandardVerdictSchema, ReviewPanelVerdictSchema, type ReviewPanelVerdict } from './contracts'
import type { ReviewGateStep } from './steps'

if (typeof window !== 'undefined') {
  throw new Error('lib/ai/reasoning/orchestrator-panel.ts is server-only and must not run in the browser')
}

// All 9 calls use 'critic' (Mistral-first, then Groq/Google/Cerebras — see
// lib/ai/router.ts realtimeAttempts()). A round-robin across 'critic' /
// 'suggestor' / 'drafter' was tried here first, on the theory that 9
// concurrent calls on one provider was causing malformed output; that theory
// was wrong (the real bug was a too-tight schema max-length, fixed in
// contracts.ts) and the round-robin turned out actively counterproductive
// live during Phase 1 verification (2026-07-30): heavy same-day testing
// pushed Gemini and Cerebras into real rate-limiting (confirmed via the AI
// monitor — both showing HTTP 429 with several failures) while Mistral
// stayed perfectly healthy throughout (100+ calls, zero failures) — so
// spreading 6 of 9 calls onto 'suggestor'/'drafter' was routing INTO the two
// providers already under load. 'critic' role's own 4-provider failover
// chain already gives resilience if Mistral itself gets rate-limited; a
// small stagger avoids firing all 9 in the same instant.
const REVIEWER_STAGGER_MS = 150

// A genuinely good artifact rarely satisfies all nine independent reviewers at
// once: each is a separate, noisy binary judgment, and AND-ing nine of them
// makes unanimity a near-coin-flip even on strong content — worse, the failing
// subset is DIFFERENT each attempt, which is what drove the observed
// regenerate-and-halt behaviour (a standard passes, a sibling in tension with
// it fails, the repair flips them, repeat). Tolerate up to this many failing
// standards so one noisy or finicky reviewer can't halt an otherwise-sound run.
// The integrity of the gate is preserved by the regeneration loop and the
// per-standard notes, not by demanding a perfect nine. Set to 0 to restore
// decision 019's original strict unanimity.
const MAX_PANEL_FAILURES = 1

function dryRunVerdict(subjectId: string): ReviewPanelVerdict {
  const standards = Object.fromEntries(
    STANDARDS.map((s) => [s.id, { pass: true, notes: `[dry run] ${s.name} not actually graded.` }])
  ) as ReviewPanelVerdict['standards']
  return { subject_id: subjectId, standards, overall_pass: true, degraded: false }
}

// Runs all 9 standard-reviewer calls in parallel (Promise.all) and aggregates.
// A batch's wall-clock time is bounded by its slowest single completeJSON call
// (~26s worst case), not the sum — see the Phase 1 plan for why this is safe
// inside one 30s route invocation even nested n-deep at perspectives-review.
export async function runReviewPanel(
  subjectId: string,
  stepId: ReviewGateStep,
  artifact: unknown,
  context: string,
  dryRun = false
): Promise<ReviewPanelVerdict> {
  if (dryRun) return dryRunVerdict(subjectId)

  const criteria = LAYER_STANDARD_CRITERIA[stepId]
  const entries = await Promise.all(
    STANDARDS.map(async (standard, i) => {
      if (i > 0) await new Promise((resolve) => setTimeout(resolve, i * REVIEWER_STAGGER_MS))
      const { system, user } = buildReviewerPrompt(standard, criteria[standard.id], artifact, context)
      try {
        const verdict = await completeJSON({
          role: 'critic',
          system,
          user,
          schema: SingleStandardVerdictSchema,
          schemaName: 'standard_verdict',
          // 'high' (was 'low'): app-wide effort is a strict 'low'|'high' binary
          // (router.ts), no 'medium' tier exists. A per-standard pass/fail is a
          // genuine judgment call, and more deliberation cuts the reviewer noise
          // the panel then AND-s nine-deep. Safe against doc 08's budget-
          // starvation bug: gpt-oss/qwen are hard-capped at their own floor by
          // reasoningEffortFor (router-shared.ts) regardless of what's requested
          // here, so 'high' only actually changes anything when Gemini serves
          // the call (low->none, high->low in reasoningEffortFor) — modest, but
          // free and directionally correct everywhere else in the chain.
          effort: 'high',
          maxTokens: 800,
        })
        return [standard.id, verdict] as const
      } catch (err) {
        log.error('ai/reasoning/panel', 'standard reviewer call failed', {
          stepId,
          subjectId,
          standard: standard.id,
          error: (err as Error)?.message,
        })
        throw err
      }
    })
  )
  const standards = Object.fromEntries(entries) as ReviewPanelVerdict['standards']
  const failing = STANDARDS.filter((s) => !standards[s.id].pass).map((s) => s.id)
  const overall_pass = failing.length <= MAX_PANEL_FAILURES
  const result: ReviewPanelVerdict = { subject_id: subjectId, standards, overall_pass, degraded: false }
  // Defensive: catches a shape bug here rather than surfacing downstream.
  ReviewPanelVerdictSchema.parse(result)

  log.info('ai/reasoning/panel', 'panel verdict', { stepId, subjectId, overall_pass, failing, tolerated: MAX_PANEL_FAILURES })
  return result
}
