# Decision 005 — `/house`: no-login local builder + a fully editable house

**Date:** 2026-07-05
**Status:** Implemented

`/house` was a standalone shell that reused the Build chrome but had no
persistence and an empty right rail. This change makes it a real, editable,
persistent builder — and, because the Build components are shared, extends
inline editing to the authenticated `/build` workspace too.

## What changed

### 1. `/house` is the first version of the no-login `/try` builder
- `BuildHousePage` no longer hard-codes Supabase persistence. It takes an
  injected `onSave(state)` adapter and a `mode: 'local' | 'account'` prop, so
  one workspace root backs both routes.
  - `/build/[id]` passes `mode="account"` + `saveHouse(...)` (Supabase).
  - `/house` passes `mode="local"` + `saveLocalHouse` (localStorage).
- Local persistence lives in [lib/build/persistence.ts](../lib/build/persistence.ts):
  `saveLocalHouse` / `loadLocalHouse` / `LOCAL_HOUSE_KEY = 'hot:house:draft'`,
  storing only `serializeContent`'s persistable subset. No Supabase, no auth, no
  RLS — a deliberate contrast to `save/loadHouse`. See
  [plans/active/pre-login-ux/page-try-and-auth.md](../plans/active/pre-login-ux/page-try-and-auth.md).
- `/house` loads `loadLocalHouse() ?? blankState()` after mount (client-only, to
  avoid a hydration mismatch) and starts **empty**.

### 2. Everything is inline-editable
- New editable prose fields on `State`: `purpose`, `question`, `conclusion`,
  `reasoning` (start empty; `initialState` keeps the demo copy). Frame and
  Conclusion layers render them via the shared
  [components/build/Editable.tsx](../components/build/Editable.tsx)
  (`InlineText` auto-grows; `RemoveButton`).
- All list layers gained inline text editing + delete (+ add where missing):
  concepts, perspectives (name/summary), evidence (text/source), assumptions,
  implications (text/who + horizon toggle), and watchpoints. New reducer
  `EDIT_*` / `REMOVE_*` / `TOGGLE_*` actions in
  [lib/build/state.ts](../lib/build/state.ts).
- Perspective cards open a detail on click, so their editable fields
  `stopPropagation` on click/keydown.

### 3. Title falls back to the question
- An unnamed house shows its overarching question as the ContextBar title
  placeholder (`question.trim() || 'Name your house'`).

### 4. Co-pilot suggestions are inert (pending Groq)
- The Co-pilot "Add" buttons are disabled. The static suggestion bank is
  illustrative until the co-pilot is wired to the Groq API.

### 5. Local-mode Team tab
- In `mode="local"`, the Team tab is a single centered "Invite people" prompt
  (button intentionally inert — invite/publish are not built yet). `account`
  mode keeps the seeded `TeamPanel`.

## Persistence (DB)
- The `houses.question` column already existed (`0003`) but was unused;
  `saveHouse`/`loadHouse` now read/write it.
- [0007_houses_frame_conclusion.sql](../supabase/migrations/0007_houses_frame_conclusion.sql)
  adds `purpose` / `conclusion` / `reasoning` columns. Column access rides the
  existing table grants (`0005`) and RLS (`0006`); no new policies needed. It
  has been applied to the live DB.

## Notes / follow-ups
- `layerDone(5)` (Conclusion) now requires content rather than always being
  true, so an empty conclusion reads "not set" and does not inflate strength.
- Full inline editing and the disabled Co-pilot Add apply to `/build` too
  (shared components); the empty Team state is local-only.
- Not built yet: real invite/publish, and the signup pre-select + local→account
  carry described in the pre-login-ux plan.
