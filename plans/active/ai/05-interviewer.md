# 05 — The Interviewer: context intake in the rail

Phase 3. The foundation feature from decision 007's build sequence: a short
structured interview whose output (`aiContext`) makes every other AI call
specific instead of canned.

## Files

- **Read first:** `components/build/rail/CopilotPanel.tsx`,
  `lib/ai/prompts.ts`, `lib/ai/findings.ts`, `components/build/Editable.tsx`
  (reuse input styling where sensible).
- **Create:** `app/api/ai/interview/route.ts`,
  `components/build/rail/InterviewCard.tsx`.
- **Modify:** `CopilotPanel.tsx` (mount the card), `lib/ai/prompts.ts`,
  `lib/ai/serialize.ts` (include `aiContext` in the house serialization,
  labeled `CONTEXT (from interview)`), `app/api/ai/suggest/route.ts` (accept
  optional `aiContext` in the body — serializer picks it up).

## Route: `POST /api/ai/interview`

```json
{ "house": { … }, "transcript": [{ "role": "user"|"assistant", "content": "…" }],
  "forceSummary": false }
```

Response schema (zod):

```ts
{ reply: string,            // next question, or a 1-line close if done
  done: boolean,
  context: { summary: string, facts: string[] } | null }  // non-null iff done
```

- `effort: 'low'`, `maxTokens: 600`, body cap 100 KB, `maxDuration = 30`.
- Transcript capped at 12 entries server-side (413 beyond).
- `forceSummary: true` → system prompt appends "You must finish NOW: set
  done=true and produce the context."

Interview block (in `prompts.ts`), the essence:

> You are conducting a short intake interview so the co-pilot understands
> this house. Ask ONE question at a time, ≤ 2 sentences, warm and plain.
> Cover, adapting to what the house already shows: what the question really
> is and why now; who is affected; what they've tried or already believe;
> constraints (time, money, authority); what a good outcome looks like.
> Never propose answers or content for the house. After at most 5 questions —
> fewer if the picture is clear — set done=true, reply with a one-line
> close, and produce `context`: `summary` (≤ 120 words, second person:
> "You are deciding…") and 3–8 short `facts` (concrete, reusable:
> "Deadline: end of term", "Has authority over X, not Y").

Both modes get the interviewer (it elicits *their* thinking — Coach-safe).

## `InterviewCard.tsx` (rendered at the top of the co-pilot tab)

- **No `aiContext`:** card with "Give the co-pilot context" + "It asks a few
  questions so suggestions fit your house." + Start button.
- **In progress (local component state, not reducer):** transcript bubbles
  (user right / co-pilot left, existing palette), one text input + Send;
  disabled while in flight; error row with Retry (resends the same
  transcript). A quiet "Finish early" link sends `forceSummary: true`. Hard
  stop: after the 6th user turn the client only sends `forceSummary`.
- **On `done`:** dispatch `SET_AI_CONTEXT` (autosave persists it), collapse to
  the summary chip, and invalidate the suggestions cache (bump the
  `contentHash`) so the next fetch uses the context.
- **Has `aiContext`:** collapsed chip — "Context set ✓" + summary preview
  (2-line clamp) + "Redo" (clears local transcript, starts over; on the new
  `done`, overwrites via `SET_AI_CONTEXT`).

Transcript is deliberately ephemeral — only the distilled `context` persists
(keeps the DB clean and the privacy surface small).

## Acceptance

- Fresh `/house`: type a question → Start interview → it asks context-aware
  questions (references your question text), finishes ≤ 5 questions → chip
  appears; reload → chip persists (and `houses.ai_context` populated on
  `/build/[id]`).
- After the interview, Refresh suggestions → visibly more specific (uses
  interview facts).
- "Finish early" after one answer still yields a sane summary.
- `npx tsc --noEmit`, `npm run build` pass.
