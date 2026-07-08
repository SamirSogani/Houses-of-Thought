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

Append to `.env.example` (placeholders only):

```
# Groq — co-pilot inference (server-side only). console.groq.com
GROQ_API_KEY=your-groq-key
# Brave Search — evidence research (server-side only). brave.com/search/api
BRAVE_SEARCH_API_KEY=your-brave-key
```

Optional override honored by `groq.ts`: `GROQ_MODEL` (default
`openai/gpt-oss-120b`).

## `lib/ai/groq.ts` — server-only client wrapper

Server-only guard: throw at module load if `typeof window !== 'undefined'`
(no extra dep needed).

```ts
export const AI_MODEL = process.env.GROQ_MODEL ?? 'openai/gpt-oss-120b'
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

Behavior:
- One `Groq` client instance (`timeout: 25_000`, `maxRetries: 1`).
- `chat.completions.create({ model: AI_MODEL, reasoning_effort: opts.effort,
  response_format: { type: 'json_schema', json_schema: { name, schema } },
  max_completion_tokens, messages })`. Convert the zod schema with zod v4's
  `z.toJSONSchema()`. **Verify both param names against Groq's docs**; if
  `json_schema` mode misbehaves with gpt-oss, fall back to
  `{ type: 'json_object' }` + schema embedded in the system prompt.
- Parse content with `opts.schema.parse`. On parse failure, retry **once**
  appending the validation error to the user message; then throw
  `AiError(502, 'ai-invalid-output')`.
- Map Groq 429 → `AiError(429, …)`, timeouts/5xx → `AiError(502, …)`.
- Throw immediately if `!process.env.GROQ_API_KEY` (500, clear message).

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
- `.env.example` documents both keys; no real key values appear in any diff.
