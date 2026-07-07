# Decision 005 — `/house`: no-login local builder + a fully editable house

**Date:** 2026-07-05
**Status:** Implemented

`/house` was a standalone shell that reused the Build chrome but had no
persistence and an empty right rail. It is now a real, editable, persistent
builder. Because the Build components are shared, the editing and the inert
demo/AI affordances also apply to the authenticated `/build` workspace.

## What changed

### 1. `/house` is the first version of the no-login `/try` builder
- `BuildHousePage` no longer hard-codes Supabase persistence. It takes an
  injected `onSave(state)` adapter, so one workspace root backs both routes:
  - `/build/[id]` passes `saveHouse(...)` (Supabase).
  - `/house` passes `saveLocalHouse` (localStorage).
- Local persistence: `saveLocalHouse` / `loadLocalHouse` /
  `LOCAL_HOUSE_KEY = 'hot:house:draft'` in [persistence.ts](../lib/build/persistence.ts)
  store only `serializeContent`'s subset. No Supabase / auth / RLS.
- `/house` loads `loadLocalHouse() ?? blankState()` after mount (client-only,
  to avoid a hydration mismatch) and starts empty.
- The chrome matches `/build`: AppBar **Sign out** and the ContextBar
  **Invite / Publish** buttons show on both routes. (An earlier local-only
  `mode` prop that hid them / swapped in a Save→account CTA was reverted, and
  the prop removed.)

### 2. Everything is inline-editable
Editing is seamless in-place via a shared [Editable.tsx](../components/build/Editable.tsx)
(`InlineText` auto-grows; `RemoveButton`).
- New editable prose fields on `State`: `purpose`, `question`, `conclusion`,
  `reasoning` (Frame + Conclusion layers), starting empty.
- Concepts are `{ term, definition }`; the Frame section reads "Concepts /
  definitions" and each concept has a term field plus a definition space.
- Every list layer edits + deletes inline: concepts, perspectives, evidence
  (text/source), assumptions, implications (text/who + horizon toggle), and
  watchpoints.
- Perspective drill-in detail is editable: each perspective owns its `stance`,
  `subQuestions` ({q, note}), `supportingEvidence` ({text, source}), and
  `counters`, edited in `PerspectiveDetail` with add/remove. The card's question
  count derives from `subQuestions.length`. (These moved out of the static
  `perspectiveDetails` in content.ts, which now only seeds the demo house.)
- "Add" buttons insert **blank** items (no canned/demo text), now that fields
  are editable.

### 3. Title falls back to the question
An unnamed house shows its overarching question as the ContextBar title
placeholder (`question.trim() || 'Name your house'`).

### 4. AI affordances are inert (pending Groq)
The Co-pilot "Add" suggestions and the Evidence "Research Mode" button are
disabled — both injected demo content and will be wired to the Groq API later.

### 5. Team tab
The Team tab shows a single centered, **inert** "Invite people" prompt on both
routes (the seeded people / activity feed were removed). Invite/Publish are not
wired yet.

## Persistence (DB)
Local mode round-trips everything through localStorage, with normalizers that
tolerate older saved shapes (`string[]` concepts, pre-detail perspectives). For
`/build`, three idempotent migrations add the columns (all applied to the live
DB); column access rides the existing grants (`0005`) and RLS (`0003`/`0006`):
- `0007` — `purpose` / `conclusion` / `reasoning` on `houses` (`question`
  already existed in `0003`; save/load now use it).
- `0008` — `concept_definitions text[]` on `houses`, parallel to `concepts`.
- `0009` — `stance` / `sub_questions` / `supporting_evidence` / `counters` on
  `house_perspectives` (jsonb).

## Notes / follow-ups
- `layerDone(5)` (Conclusion) now requires content, so an empty conclusion
  reads "not set" and does not inflate strength.
- `components/build/rail/TeamPanel.tsx` is now unused (kept in place, not
  deleted).
- Not built yet: real invite/publish; the co-pilot / Research Mode Groq wiring;
  and the signup pre-select + local→account carry from
  [plans/active/pre-login-ux/page-try-and-auth.md](../plans/active/pre-login-ux/page-try-and-auth.md).
