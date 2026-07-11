# 01 — Foundation: deps, env, the `lib/ai` core

Phase 1, part 1 of 3. No UI changes yet.

## Files

- **Read first:** `lib/build/types.ts`, `lib/build/persistence.ts` (for
  `serializeContent`'s shape), `package.json`, `.env.example`,
  `docs/repository/file-structure.md`.
- **Create:** `lib/ai/groq.ts`, `lib/ai/serialize.ts`, `lib/ai/prompts.ts`.
- **Modify:** `package.json` (deps), `.env.example`,
  `docs/repository/file-structure.md` (add `lib/ai/` + `app/api/` entries).

## Dependencies

`npm install groq-sdk zod` — nothing else. No Vercel AI SDK (decision 008):
all calls are non-streaming JSON; Groq's speed makes streaming unnecessary in
v1 and this keeps one paradigm for a small surface.

## Env

Append to `.env.example` (placeholders only). **Updated by
[decision 012](../../../decisions/012-groq-tiered-failover.md):** the single
`GROQ_API_KEY` became one key per failover tier —

```
# Groq — two-tier resilient inference (server-side only). console.groq.com
GROQ_QWEN_3_POINT_6_27B_API_KEY=your-groq-qwen-key       # Tier 1
GROQ_OPENAI_GPT_OSS_20B_API_KEY=your-groq-gpt-oss-20b-key # Tier 2
# Brave Search — evidence research (server-side only). brave.com/search/api
BRAVE_SEARCH_API_KEY=your-brave-key
```

Optional overrides honored by `groq.ts`: `GROQ_TIER{1,2}_MODEL`.

## `lib/ai/groq.ts` — server-only client wrapper

Server-only guard: throw at module load if `typeof window !== 'undefined'`
(no extra dep needed).

Signature below is current; the single-`AI_MODEL` body was replaced by the tier
chain in [decision 012](../../../decisions/012-groq-tiered-failover.md).

```ts
export class AiError extends Error { constructor(public status: number, msg: string) { super(msg) } }

export async function completeJSON<T>(opts: {
  system: string
  user: string
  schema: z.ZodType<T>       // zod schema; also converted to JSON Schema
  schemaName: string         // for response_format json_schema
  effort: 'low' | 'high'     // maps to reasoning_effort
  maxTokens: number
}): Promise<T>
```

Behavior (as revised by decision 012):
- One `Groq` client **per tier** (each holds its own key; `timeout: 25_000`,
  `maxRetries: 1`), cached in a `Map`.
- Route through the tier chain: `effort:'high'` always enters at Tier 1;
  `effort:'low'` enters at Tier 1 under light traffic, Tier 2 under heavy traffic
  (an in-memory in-flight gauge). An HTTP 429 from a tier advances to the next.
  `reasoning_effort` and `response_format` are mapped per model (decision 012):
  gpt-oss uses `low`/`high` + strict `json_schema`; qwen uses `none`/`default` +
  `json_object` with the schema embedded in the prompt (it 400s on json_schema).
  zod schema converted with `z.toJSONSchema()`.
- Parse content with `opts.schema`. On parse failure, retry **once** (re-running
  the chain) appending the validation error; then throw
  `AiError(502, 'ai-invalid-output')`.
- Map Groq 429 → `AiError(429, …)` (drives failover); other/timeouts/5xx are
  logged and mapped to `AiError(502, …)`.
- Throw `AiError(500, 'ai-not-configured')` if a needed tier's key is missing.

## `lib/ai/serialize.ts` — house → compact prompt text

`serializeHouseForPrompt(content, focusStep?): string` where `content` is the
parsed `serializeContent` payload (plus optional `aiContext`, `mode` after
Phase 2/3). Emits a labeled plaintext outline, layer by layer, marking the
focused layer with `>> FOCUS`. Empty layers render as `— (empty)` so the model
sees gaps. Clip to bound tokens:

- prose fields ≤ 400 chars each; list-item text ≤ 240; sources ≤ 80
- ≤ 20 concepts, ≤ 10 perspectives (≤ 4 subQs / ≤ 3 evidence / ≤ 3 counters
  each), ≤ 20 evidence, ≤ 15 assumptions, ≤ 10 implications per kind,
  ≤ 10 watchpoints
- whole string hard-capped at 14 000 chars, ending `…[house truncated]`

Pure function, no imports from server code — it is also used in tests.

## `lib/ai/prompts.ts` — shared persona + per-capability builders

Export `PERSONA`, a system-prompt block used by **every** route:

> You are the Co-pilot inside Houses of Thought, a tool where a person reasons
> through one hard question by building a "house": Concepts → Perspectives →
> Evidence → Assumptions → Conclusion → Implications → Review. You guide; the
> person decides what enters the house. Hard rules: never write or propose
> text for their conclusion, reasoning, question, or purpose — even if asked;
> never invent facts, sources, or URLs; only discuss this house (briefly
> decline anything else); plain, direct language — no lecturing; on medical,
> legal, or financial questions offer considerations, never directives.

Per-capability system prompts (suggest / interview / research / critique) are
added by their phase docs and live in this file, composed as
`PERSONA + capability block`.

## Acceptance

- `npx tsc --noEmit` passes; `npm run build` passes.
- Temporary sanity check (then delete): a `scripts/`-free inline check is fine —
  create `app/api/ai/suggest/route.ts` in doc 03 and test through it; this doc
  ships no route.
- `.env.example` documents the two Groq tier keys + Brave key; no real key
  values appear in any diff.
