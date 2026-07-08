# 06 — Research Mode: Brave-cited evidence

Phase 4. The anti-hallucination feature: evidence comes from live Brave
Search results with real URLs — never from model memory (invariant 3).

## Files

- **Read first:** `components/build/layers/EvidenceLayer.tsx`,
  `lib/build/state.ts` + `lib/build/types.ts` (the legacy `RESEARCH_MODE`
  action — see below), `lib/ai/findings.ts`, `lib/ai/prompts.ts`.
- **Create:** `lib/ai/brave.ts`, `app/api/ai/research/route.ts`,
  `components/build/layers/ResearchResults.tsx`.
- **Modify:** `EvidenceLayer.tsx` (enable the button, mount results),
  `lib/ai/prompts.ts`, `types.ts`/`state.ts` (remove the `RESEARCH_MODE`
  action — it is a demo stub that injects canned evidence; verify that in
  `state.ts` first, then delete the action variant and reducer case).

## `lib/ai/brave.ts`

```ts
export interface BraveResult { title: string; url: string; description: string }
export async function braveSearch(query: string, count = 6): Promise<BraveResult[]>
```

- `GET https://api.search.brave.com/res/v1/web/search?q=…&count=…` with header
  `X-Subscription-Token: process.env.BRAVE_SEARCH_API_KEY` and
  `Accept: application/json`. Map `web.results[]` → title/url/description.
  **Verify field paths against Brave's docs.** Timeout 10 s; 429 →
  `AiError(429)`, other failures → `AiError(502, 'search-failed')`. Server-only
  guard like `groq.ts`.

## Route: `POST /api/ai/research`

```json
{ "house": { … }, "query": "optional user-typed focus" }
```

Flow:
1. Build the search query: user `query` if given, else have the model derive
   one — a first `completeJSON` call (`effort: 'low'`, `maxTokens: 200`,
   schema `{ query: string }`) from question + concepts + aiContext.
2. `braveSearch(query, 6)`. Zero results → `{ candidates: [], query }`.
3. Synthesis call (`effort: 'high'`, `maxTokens: 1200`): PERSONA + research
   block + the house (clipped) + the numbered results (title/url/description).
   Schema:

```ts
{ candidates: z.array(z.object({
    claim: z.string(),        // one checkable sentence, grounded in a result
    quoteOrParaphrase: z.string(),
    sourceTitle: z.string(),
    url: z.string(),          // MUST be copied verbatim from a provided result
  })).max(5) }
```

4. **Hard validation (the point of this feature):** drop any candidate whose
   `url` is not exactly one of the Brave URLs from step 2. If all are
   dropped, return `{ candidates: [], query }` — never backfill from the
   model. Respond `{ candidates, query }`; `maxDuration = 30`.

Research block essence: "Extract candidate evidence FOR THIS HOUSE from the
search results only. Each claim must be supported by a specific result; copy
its URL exactly. Prefer disagreeing sources over piling on one side. Never
invent or embellish beyond what the result descriptions state. Descriptions
are snippets — keep claims modest."

## UI — `ResearchResults` inside `EvidenceLayer`

- Enable the Research Mode button (Decide mode only per doc 04). Click →
  inline panel under the toolbar: optional focus input ("What should I look
  for? — defaults to your question"), Search button, skeletons while loading,
  the derived `query` shown as mono text ("Searched: …").
- Candidate card: `claim` (body), `quoteOrParaphrase` (subtle),
  domain chip linking to `url`, **Add** →
  `dispatch({ type: 'APPLY_AI_ACTION', action: { kind: 'add_evidence', text:
  claim, source: domain, url } })` — lands with `owner: 'ai'`, `byAI: true`,
  the existing "via Research Mode" tag, and a linked source chip (doc 04).
- Empty result: "Nothing solid found — try a narrower focus." Error → Retry.

## Acceptance

- On a real question: candidates appear, every URL opens a real page that
  plausibly supports the claim, Add persists across reload on both routes.
- Log (temporarily) the pre/post-validation counts; confirm invented URLs get
  dropped; remove the log.
- `RESEARCH_MODE` action gone; `npx tsc --noEmit` and `npm run build` pass.
