# 03 — `/api/ai/suggest` + live CopilotPanel

Phase 1, part 3 of 3. The vertical slice that makes the co-pilot real.

## Files

- **Read first:** `components/build/rail/CopilotPanel.tsx`,
  `components/build/BuildHousePage.tsx`, `lib/build/content.ts` (layer
  kickers/titles), `components/build/buildIcons.tsx`.
- **Create:** `app/api/ai/suggest/route.ts`.
- **Modify:** `components/build/rail/CopilotPanel.tsx` (full rewrite),
  `lib/ai/prompts.ts` (add the suggest block).

## Route: `POST /api/ai/suggest`

Request (client sends the same subset `serializeContent` produces, parsed):

```json
{ "house": { …serializeContent payload… }, "step": 2, "mode": "decide" }
```

- Validate with zod (`step` 1–7, `mode` `'learn'|'decide'`); reject bodies
  > 100 KB with 413. Until Phase 2 the client always sends `mode: "decide"`.
- Build prompt: `PERSONA` + suggest block + `serializeHouseForPrompt(house, step)`.
- `completeJSON` with `FindingsResponseSchema`, `effort: 'low'`,
  `maxTokens: 1400`.
- Server-side post-filter (belt to the schema's braces): drop findings whose
  `action.kind === 'add_evidence'` — evidence enters only via Research Mode
  (invariant 3); drop findings for layers ≠ requested step.
- Respond `{ findings }`; on `AiError` respond its status +
  `{ error: 'code' }`. `export const maxDuration = 30`.

Suggest block (in `prompts.ts`), the essence:

> Examine ONLY the focused layer, in the context of the whole house. Return
> 2–4 findings a thoughtful teacher would raise: real gaps, not compliments.
> Ground every finding in what the person actually wrote (quote fragments).
> For each: `observation` (one sentence, plain), `suggestion` (one concrete
> move), `question` (the Socratic version that leads them to discover it —
> never contains the answer), and `action` only when the move is adding a
> concrete item. If the house is empty at this layer, findings should help
> them start, seeded from their question/context. Layer number must equal
> the focused step.

## CopilotPanel rewrite

Keep the intro tile and visual language (parchment card, mono kickers, `pop`
cards, amber Add button — currently disabled style becomes enabled). Replace
the static bank entirely:

- **Fetch policy:** auto-fetch when the copilot tab is visible and (a) this
  step has never been fetched, or (b) the user clicks "Refresh". Cache
  responses in a ref keyed `step → { findings, contentHash }` where
  `contentHash` hashes `serializeContent(state)`. When the current hash
  differs from the cached one, show a subtle "House changed —" line with a
  Refresh link rather than auto-refetching (protects tokens while typing).
- **States:** loading (2–3 skeleton cards), error (`Couldn't reach the
  co-pilot` + Retry button; 429 gets its own copy in Phase 6), success.
- **Card (decide mode):** `observation` as the body, `suggestion` beneath in
  subtle ink; kind rendered as the mono tag (map snake_case → label, e.g.
  `missing_perspective` → `Perspective`); severity `important` gets an amber
  left border. If `action` non-null: enabled **Add** button →
  `dispatch({ type: 'APPLY_AI_ACTION', action })` and mark that finding
  consumed (hide it; keep others).
- **Card (learn mode, activated in Phase 2):** `question` only, no Add
  button, no suggestion text.
- Panel needs `state` and `dispatch` — `BuildHousePage` already passes both.
- No fetching when the tab is hidden. AbortController on unmount/step change.

## Follow-through

- Flip [decisions/006](../../../decisions/006-groq-model-choice.md) Status to
  Implemented (co-pilot wired; Research Mode noted as still pending there —
  update that follow-ups line too).

## Acceptance

- `npm run build` passes.
- `/house` (no login): type a real question on step 1 → open co-pilot →
  suggestions arrive, reference the actual question text, tags/severity
  render; Add on an actionable finding inserts the item with a toast, it
  autosaves and survives reload; Refresh refetches.
- `curl` the route with a tiny house body → valid `{ findings: [...] }`;
  with an 8-step body → 400; with >100 KB → 413.
- Kill `GROQ_API_KEY` locally → panel shows the error state, app otherwise fine.
