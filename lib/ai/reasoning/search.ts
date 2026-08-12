// Server-only: lets a reasoning-pipeline generate step optionally ground its
// answer in real Brave search before finalizing (decision 019). Opt-in per
// call, not forced — most calls request zero queries and finish in a single
// round. Currently wired into the two evidence stages (PERSPECTIVE_EVIDENCE_BLOCK,
// GLOBAL_EVIDENCE_BLOCK in prompts.ts), the only prompts that offer it.

import { z } from 'zod'
import { completeJSON, type AiRole, type AiEffort } from '@/lib/ai/router'
import { braveSearch } from '@/lib/ai/brave'
import { log } from '@/lib/log'

if (typeof window !== 'undefined') {
  throw new Error('lib/ai/reasoning/search.ts is server-only and must not run in the browser')
}

const queryStr = z.string().min(1).max(200)

// Merged onto a call's own schema via .extend(SearchQueriesSchema.shape) so
// the model can request search alongside its normal structured output. Empty
// (the common case) means the model judged its own knowledge sufficient.
export const SearchQueriesSchema = z.object({
  search_queries: z.array(queryStr).max(3),
})

// Bounded rounds of "request queries -> search -> try again": normally a call
// finishes in round 0 with zero queries. When queries ARE requested, this is
// how many times the model gets to see results and ask for more before being
// forced to finalize (generateWithOptionalSearch's last round drops the
// search option entirely) — caps a model that keeps asking for "just one
// more search" from running a step's cost or latency away.
export const MAX_SEARCH_ROUNDS = 2

// Must stay comfortably under ContextGatherVerdictSchema's search_findings
// cap (contracts.ts, 4000 chars) regardless of how verbose Brave's own
// descriptions get — truncated per-description up front (not crudely at the
// very end, which could cut a result off mid-URL) so length is distributed
// evenly across results rather than the tail silently vanishing.
const MAX_DESCRIPTION_CHARS = 200
const MAX_FINDINGS_CHARS = 3800

// Sequential, not Promise.all: Brave's free tier is 1 rps (lib/ai/brave.ts).
// A failed query is dropped, not thrown — losing one search result shouldn't
// fail an entire generate step that already has a model-drafted fallback.
export async function runSearches(queries: string[]): Promise<string> {
  const blocks: string[] = []
  for (const q of queries) {
    try {
      const results = await braveSearch(q, 4)
      if (results.length) {
        const items = results
          .map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.description.slice(0, MAX_DESCRIPTION_CHARS)}`)
          .join('\n\n')
        blocks.push(`### "${q}"\n${items}`)
      }
    } catch (err) {
      log.error('ai/reasoning/search', 'search query failed, continuing without it', {
        query: q,
        error: (err as Error)?.message,
      })
    }
    // Stay under Brave's 1 rps even when a query above returned instantly.
    await new Promise((resolve) => setTimeout(resolve, 1100))
  }
  const joined = blocks.join('\n\n') || '(no results found)'
  return joined.length > MAX_FINDINGS_CHARS ? `${joined.slice(0, MAX_FINDINGS_CHARS)}…` : joined
}

export async function generateWithOptionalSearch<Shape extends z.ZodRawShape>(params: {
  role: AiRole
  system: string
  // Called fresh each round with the search results found so far (empty
  // string on round 0) so each call site controls exactly how its own base
  // context and the accumulating search findings are combined.
  buildUser: (searchContext: string) => string
  baseSchema: z.ZodObject<Shape>
  schemaName: string
  maxTokens: number
  // Was hardcoded 'high' unconditionally (2026-08-11: widened to match
  // orchestrator-perspectives.ts/orchestrator-global.ts's medium-first/
  // high-on-repair split — the two callers of this function,
  // perspective_evidence and global_evidence, are repair-eligible like every
  // other generate call, and there's no reason evidence generation alone
  // should sit outside that scheme). Defaults preserve the old behavior for
  // any caller that doesn't pass these.
  effort?: AiEffort
  allowHighReasoning?: boolean
}): Promise<z.infer<z.ZodObject<Shape>>> {
  type Base = z.infer<z.ZodObject<Shape>>
  type WithSearch = Base & z.infer<typeof SearchQueriesSchema>
  // TS can't resolve .extend()'s result through a generic Shape param cleanly
  // (produces an unusable conditional type) — cast to the concrete shape we
  // know this always produces (Base's own fields plus search_queries).
  const searchableSchema = params.baseSchema.extend(SearchQueriesSchema.shape) as z.ZodType<WithSearch>
  const effort = params.effort ?? 'high'
  let searchContext = ''

  for (let round = 0; round < MAX_SEARCH_ROUNDS; round++) {
    const out = await completeJSON<WithSearch>({
      role: params.role,
      system: params.system,
      user: params.buildUser(searchContext),
      schema: searchableSchema,
      schemaName: params.schemaName,
      effort,
      allowHighReasoning: params.allowHighReasoning,
      maxTokens: params.maxTokens,
    })
    // Defensive: catches a shape bug here rather than crashing on it — real
    // completeJSON calls always include search_queries (the schema requires
    // it), but a test double or a future refactor might not.
    const { search_queries, ...rest } = out
    if (!search_queries?.length) return rest as Base
    const results = await runSearches(search_queries)
    searchContext = `\n\n## Real search results\n${results}\n\nGround your answer in these where relevant. Return search_queries empty unless you genuinely still need more (you have ${MAX_SEARCH_ROUNDS - round - 1} more chance(s) to ask).`
  }

  // Forced final round: search option removed entirely, so the model must
  // finalize regardless of how it feels about the evidence gathered so far.
  return completeJSON({
    role: params.role,
    system: params.system,
    user: params.buildUser(searchContext),
    schema: params.baseSchema,
    schemaName: params.schemaName,
    effort,
    allowHighReasoning: params.allowHighReasoning,
    maxTokens: params.maxTokens,
  })
}
