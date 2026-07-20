# House Chat — admin-only beta (decision 017)

**Status:** Complete. Implemented 2026-07-18 (decisions 017 + 018); authed E2E
pass by the operator confirmed working 2026-07-20. Deferred follow-ups live in
the decision records, not here.

## Scope

A chat at `/admin/chat`: the admin asks a question; the product builds a real
house live (Claude-style checklist, real per-stage progress) and the card opens
the house in `/build/[id]` for the standard claim pass. The chat never answers
the question — decision 017 records the choices.

## Flow

1. `/admin/chat` (server component) → `isCallerAdmin()` or 404.
2. Composer → `POST /api/admin/chat-intake` with the turns since the last
   build. Response: one clarify message (max one round, server-enforced) or
   `{ question, purpose, context }` — question/purpose clamped to verbatim
   spans of the person's words (`lib/ai/chat.ts`).
3. On ready: insert `houses` row (`owner_id` only, same as `/build`), seed
   reducer state — question, purpose, `aiContext`, `mode: 'decide'`,
   `draft: { ...emptyDraft(), via: 'chat' }` — and mount `ChatBuildCard`.
4. The card auto-starts the shared `useDraftRunner` (016 loop, one
   `POST /api/ai/draft` per stage) and autosaves via `saveHouse`
   (single-flight, first save immediate, flush on unmount).
5. Settled → templated hand-off notice; composer unlocks; next question starts
   a new house. Older cards link to the builder for resume/claim.
6. Optional (decision 018): with the composer toggle on, the card then fetches
   `POST /api/admin/chat-conclusions` — 2–4 disagreeing conclusion candidates
   grounded in the whole house, each with trailing implications. Adopt is a
   one-shot human click (existing reducer actions); the composer stays locked
   until candidates arrive.

## Verification (all passed)

- `pnpm test` — 60 tests incl. `lib/ai/chat.test.ts` (verbatim-span clamps,
  conclusion-candidate schema); `tsc --noEmit` clean; production build clean.
- Unauthed: `/admin/chat` → 404; `POST /api/admin/chat-intake` → 403;
  `POST /api/admin/chat-conclusions` → 403.
- Authed E2E (operator, 2026-07-20): clarify round, live counts per stage,
  pause/stop, claim pass + publish unlock in the builder; with the 018 toggle
  on — candidates rendered, disagreed, and Adopt wrote conclusion + reasoning
  and landed the implications. **Confirmed working.**

## Follow-ups (deferred)

See decision 017 §Deferred: standard-account graduation, follow-up turns that
edit an existing house, transcript persistence, `via` as a real column.
