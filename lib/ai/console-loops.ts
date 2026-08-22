// Client-safe contracts for the console's bounded SUBAGENT LOOPS (plan doc
// plans/active/reasoning-pipeline/30-console-subagent-loops.md, migration
// 0042), all DB-free for the same reason the rest of this family is — routes
// stay thin, the logic here is what lib/ai/console.test.ts covers:
//   - Loop B item 1a, the single-flight-per-house rerun lock: runLockBlocks /
//     STALE_RUN_LOCK_MS. The actual DB read (getConflictingRunningRun) lives
//     in lib/ai/reasoning/persistence.ts (server-only) — this module stays
//     import-clean of anything touching Supabase.
//   - Loop B item 1b, the rerun-completion marker every active chat gets:
//     rerunMarkerMessage + RerunCompleteRequestSchema.
//   - Loop A, bounded revise: the Revise* schemas, MAX_REVISE_ITERATIONS /
//     revisionCapReached, and groupRevisionChains (the "earlier attempts
//     collapse under a disclosure" grouping ConsoleTranscript renders).
//
// Split out of console.ts once that file passed the repo's ~600-line
// guideline; re-exported from it, so existing import sites are unaffected.

import { z } from 'zod'
import { DRAFT_STAGES, DRAFT_STAGE_STEP, type DraftStage } from './draft'
import { layerKey } from '@/lib/build/content'
import { CONSOLE_MESSAGE_MAX } from './console-shared'

// ─────────────────────────────────────────────────────────────────────────
// Loop B item 1a — single-flight rerun lock (doc 30)
// ─────────────────────────────────────────────────────────────────────────

// The pipeline is client-driven — useReasoningPipelineRunner POSTs to
// app/api/houses/[id]/reasoning/route.ts once per step, and that route's own
// persistRunStep (lib/ai/reasoning/persistence.ts) runs in `after()`,
// fire-and-forget. Someone who closes the tab mid-run leaves their
// reasoning_runs row at status:'running' forever — doc 30's own guess at how
// old is "clearly abandoned," to be checked against a real halted run before
// this ships (see this file's own header comment / the plan doc's "Open
// questions"). 5 minutes, not 30 seconds or 30 minutes: long enough that a
// slow-but-alive step (this route's own maxDuration is 280s) never gets
// mistaken for abandoned, short enough that someone who genuinely walked
// away doesn't lock their own house for the rest of the afternoon.
export const STALE_RUN_LOCK_MS = 5 * 60 * 1000

// Decides whether `other` — the most-recently-updated OTHER 'running' row
// for this house (lib/ai/reasoning/persistence.ts's getConflictingRunningRun,
// already filtered to exclude the incoming runId) — should block the
// incoming request from starting. Three cases, in order:
//   1. No other running row at all → nothing to block on.
//   2. `other.id === incomingRunId` can't actually happen here (the caller
//      already excluded it via the DB query's own `.neq`), but the check
//      stays IN this function too, not just in the query, because this is
//      the one line the whole lock's correctness rests on — "a running row
//      belonging to the same runId as the incoming request is that
//      request's own run and must always pass" (doc 30) — and a pure,
//      tested function is the cheapest place to make that literally
//      impossible to get backwards, independent of how the caller queries.
//   3. Otherwise: blocks only if `other` is still fresh (younger than
//      STALE_RUN_LOCK_MS) — a stale row is treated as abandoned and never
//      blocks a new start.
// `now` defaults to Date.now() so this is testable without faking the
// system clock.
export function runLockBlocks(
  other: { id: string; updatedAt: string } | null,
  incomingRunId: string,
  now: number = Date.now()
): boolean {
  if (!other) return false
  if (other.id === incomingRunId) return false
  const age = now - new Date(other.updatedAt).getTime()
  return age < STALE_RUN_LOCK_MS
}

// ─────────────────────────────────────────────────────────────────────────
// Loop B item 1b — rerun-completion marker (doc 30)
// ─────────────────────────────────────────────────────────────────────────

// POST .../console/rerun-complete body — the client calls this once a
// confirmed rerun finishes (useReasoningPipelineRunner's phase reaching
// 'done'; see ConsolePage's own effect). `stage` is the ORIGINAL stage the
// person's rerun proposal named (RerunProposal.stage) — the route derives
// the marker text server-side from it, per this phase's instruction to keep
// "which chats are active" and the marker text off the client.
export const RerunCompleteRequestSchema = z.object({ stage: z.enum(DRAFT_STAGES) })
export type RerunCompleteRequest = z.infer<typeof RerunCompleteRequestSchema>

// Doc 30's own example text is "Perspectives onward were regenerated;
// answers above may refer to the previous version." — generalized to
// whichever stage actually cascaded. Uses the SAME label RerunPanel's own
// stageLabel() already showed the person on the confirm card
// (layerKey(DRAFT_STAGE_STEP[stage]) — e.g. concepts renders as "Frame", not
// "Concepts") so the marker names the layer using the exact word the person
// already agreed to, not a second vocabulary for the same thing.
export function rerunMarkerMessage(stage: DraftStage): string {
  const label = layerKey(DRAFT_STAGE_STEP[stage])
  return `${label} onward were regenerated; answers above may refer to the previous version.`
}

// ─────────────────────────────────────────────────────────────────────────
// Loop A — bounded revise (doc 30)
// ─────────────────────────────────────────────────────────────────────────

// "Hard cap of 3 iterations, then the button disables and says so" (doc 30).
// Enforced server-side (app/api/houses/[id]/console/revise/route.ts, against
// the TARGET turn's own stored revision_iteration — never trusts the
// client's disabled button alone) and mirrored client-side so the control
// disables before the person even tries.
export const MAX_REVISE_ITERATIONS = 3

export function revisionCapReached(currentIteration: number): boolean {
  return currentIteration >= MAX_REVISE_ITERATIONS
}

// POST .../console/revise body. `mode: 'revise'` is a literal discriminant
// even though the route's own path already says as much (matches
// CreateChatRequestSchema's own discriminated-union idiom above, and reads
// the same as doc 30's own wording: "one POST with mode: 'revise'").
// `targetTurnId` is the assistant row being revised — the route loads it to
// read its current text AND its revision_iteration (the cap check), so the
// wire shape doesn't need to duplicate either.
export const ReviseRequestSchema = z.object({
  mode: z.literal('revise'),
  chatId: z.string().uuid(),
  targetTurnId: z.string().uuid(),
  instruction: z.string().trim().min(1).max(CONSOLE_MESSAGE_MAX),
  house: z.record(z.string(), z.unknown()),
})
export type ReviseRequest = z.infer<typeof ReviseRequestSchema>

const ReviseStandardVerdictSchema = z.object({
  pass: z.boolean(),
  note: z.string().min(1).max(400),
})

// The critic-role call's own output shape — three of the pipeline's nine
// Paul-Elder standards (lib/ai/reasoning/contracts.ts's STANDARD_IDS),
// reusing the existing AiRole: 'critic' rather than inventing a role or a
// parallel critique vocabulary (doc 30's own instruction). Deliberately NOT
// the pipeline's own ReviewPanelVerdict shape — that's one reviewer PER
// standard across 9 separate calls; this is one call scoring three
// standards together, a genuinely different shape, not a subset slice of
// the same one. `guidance` is what actually drives the rewrite call, not the
// raw per-standard notes — same synthesis-before-rewrite pattern the
// pipeline's own master-review step already uses
// (lib/ai/reasoning/prompts.ts).
export const ReviseCritiqueSchema = z.object({
  standards: z.object({
    clarity: ReviseStandardVerdictSchema,
    relevance: ReviseStandardVerdictSchema,
    depth: ReviseStandardVerdictSchema,
  }),
  guidance: z.string().min(1).max(600),
})
export type ReviseCritique = z.infer<typeof ReviseCritiqueSchema>

// The console-role rewrite call's own output — deliberately just the answer
// text, not the full ConsoleResponseSchema shape (no actions, no
// rerunProposal): Loop A is scoped to improving ONE answer's text given a
// critique, not a second general-purpose console turn that happens to also
// carry a critique. A revision that genuinely implies an action or a rerun
// is still reachable — the person can say so as an ordinary console message
// once the revised answer lands.
export const ReviseResponseSchema = z.object({
  answer: z.string().min(1).max(800),
})
export type ReviseResponse = z.infer<typeof ReviseResponseSchema>

export interface RevisionChainGroup {
  // The latest turn in a completed revision chain — what ConsoleTranscript
  // renders in place, full-size, exactly where it falls chronologically.
  headId: string
  // Every earlier link in the SAME chain (the original answer plus any
  // intermediate revisions), oldest first — what the "N earlier attempts"
  // disclosure reveals when opened. Never includes headId itself.
  earlierIds: string[]
}

// "Earlier attempts collapse under a disclosure rather than vanishing" (doc
// 30) — groups every revision chain present in `turns` by its head (the one
// link nothing else in the transcript revises). A turn with no revision
// relationship at all is simply absent from the result;
// ConsoleTranscript renders those exactly as it always has. Pure and
// DB-free: `turns` is whatever a GET already returned, in whatever order —
// unlike chatDepth's tree (parentChatId), a revision chain is a simple
// linked list per lineage, so this only ever walks backward from a head, no
// forward traversal needed. `seen` guards a corrupt/cyclic chain the same
// way chatDepth does.
export function groupRevisionChains(turns: { id: string; revisesMessageId: string | null }[]): RevisionChainGroup[] {
  const supersededBy = new Set<string>()
  for (const t of turns) {
    if (t.revisesMessageId) supersededBy.add(t.revisesMessageId)
  }
  const byId = new Map(turns.map((t) => [t.id, t]))
  const groups: RevisionChainGroup[] = []
  for (const t of turns) {
    if (!t.revisesMessageId) continue // not part of any chain
    if (supersededBy.has(t.id)) continue // an earlier link, not the head
    const earlierIds: string[] = []
    let cursorId: string | null = t.revisesMessageId
    const seen = new Set<string>()
    while (cursorId && byId.has(cursorId) && !seen.has(cursorId)) {
      seen.add(cursorId)
      earlierIds.unshift(cursorId)
      cursorId = byId.get(cursorId)!.revisesMessageId
    }
    groups.push({ headId: t.id, earlierIds })
  }
  return groups
}

// One line of the "Conversation so far" block the console POST sends the
// model (app/api/houses/[id]/console/route.ts). Three roles, not two: doc
// 30's Loop B added product-generated `system` markers ("Frame onward was
// regenerated…") that neither party actually said. Labelling those
// `Co-pilot:` — what a two-way `role === 'user' ? … : …` mapping does with
// any non-user row — tells the model it said something it never said, and
// invites it to refer back to that as its own prior statement. A marker is
// context about the house changing underneath the conversation, so it is
// framed as exactly that.
export function transcriptLine(role: string, message: string): string {
  if (role === 'user') return `Person: ${message}`
  if (role === 'system') return `[System note] ${message}`
  return `Co-pilot: ${message}`
}
