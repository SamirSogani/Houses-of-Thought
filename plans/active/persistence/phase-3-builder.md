# Phase 3 — Builder persistence (execution handoff)

Refactor `/build` → `/build/[id]`: load a specific house into the reducer and
debounce-save changes back. The biggest piece of the milestone. Do the profile
handoff first.

## Read first
`lib/build/types.ts` (`State`, `Action`), `lib/build/state.ts` (`reducer`,
`initialState` — note ids are **integers** via `nextId`), `lib/build/strength.ts`
(`layerDone`/`doneCount`/`computeStrength`), `components/build/BuildHousePage.tsx`
(owns the reducer), `app/build/page.tsx`, and `supabase/migrations/0003_houses.sql`.

## Ground rules (important)
- **Do not touch the reducer or `lib/build/types.ts`.** The reducer uses integer
  ids; the DB uses uuids. Map only at the persistence boundary (new file below).
- **Never persist ephemeral fields:** `step, rightTab, inviteOpen, inviteInput,
  copied, notesOpen, toast, activePerspective`. Only content persists.
- `initialState` is **demo content** — never write it to a real house. New houses
  load blank.
- `owner_key`/`owner` values are exactly `you|maya|devan|ai` (DB CHECK matches the
  reducer). Pass through; real user mapping is deferred.

## New file: `lib/build/persistence.ts` (the mapping boundary)

**`blankState(): State`** — the `initialState` shape but with empty content
arrays (`concepts/perspectives/evidence/assumptions/pos/neg/unc/watchpoints` = [],
`accepted` = {}, `title` = ''), ephemeral defaults unchanged.

**`loadHouse(supabase, id): Promise<State | null>`** — fetch the `houses` row +
all 4 child tables `.eq('house_id', id).order('position')`, then:
- `title ← houses.title ?? ''`; `concepts ← houses.concepts`;
  `watchpoints ← houses.watchpoints`; `accepted ← houses.accepted`.
- `perspectives ← rows.map((r, i) => ({ id: i+1, name, summary, questions, strength, owner: r.owner_key }))`
- `evidence ← rows.map((r, i) => ({ id: i+1, text, source, owner: r.owner_key, byAI: r.by_ai }))`
- `assumptions ← rows.map((r, i) => ({ id: i+1, text, owner: r.owner_key }))`
- implications: split `house_implications` by `kind` into `pos/neg/unc`, each
  `→ { id: i+1, text, horizon, who }`.
- Integer ids are re-assigned sequentially by `position`; `nextId(max)+1` keeps
  working for later adds.

**`saveHouse(supabase, id, state): Promise<void>`** — whole-house **replace**
(simplest correct v1):
1. `update houses` set `title` (`state.title || null`), `concepts`, `watchpoints`,
   `accepted`, `layers_complete = doneCount(state)`, `status = deriveStatus(state)`.
   (`updated_at` is bumped by the 0003 trigger.)
2. For each child table: `delete().eq('house_id', id)`, then bulk `insert` the
   current array with `position = index`, `owner_key = owner`, plus `by_ai`
   (evidence) / `kind` (implications).

**`deriveStatus(state)`** — `doneCount === 7 → 'complete'`; else if any content
exists or `title` set → `'in-progress'`; else `'empty'`.

## Wiring
- **`app/build/[id]/page.tsx`** (new, client): read `params.id`, `loadHouse`,
  show the existing "Loading your house…" state until ready, then render
  `<BuildHousePage initialState={loaded} .../>`. 404/redirect to `/dashboard` if
  `loadHouse` returns null (not found or not yours — RLS makes both look empty).
- **`BuildHousePage.tsx`**: accept an `initialState: State` prop; change
  `useReducer(reducer, initialState)` → `useReducer(reducer, props.initialState)`.
  Add a **debounced autosave** effect (~800ms) that calls `saveHouse`. Debounce on
  a content-only key — add `serializeContent(state)` in persistence.ts (JSON of
  the persistable subset) and use it as the effect dependency so toast/step
  changes don't trigger saves. Pass the house `id` down.
- **`app/build/page.tsx`** (no id): insert a blank house for the user, then
  `router.replace('/build/${id}')` (keeps the AppBar "Collab" link working).
- **Dashboard** (`app/dashboard/page.tsx` + `components/dashboard/HouseCard.tsx`):
  card `href` → `/build/${h.id}`; `handleCreate` → after insert `.select('id').single()`,
  `router.push('/build/${id}')` instead of just refreshing.

## Gotchas
- delete+reinsert is **not atomic**; fine for single-user/single-tab. A failed
  insert after a delete could drop a layer. Acceptable for v1 — note it. Hardening:
  wrap the replace in a Postgres RPC (transaction). Optional, out of scope.
- Autosave should no-op when nothing persistable changed (the content-key guard).
- Don't run autosave on the very first render after load (guard with a ref, like
  ProfileForm's `firstRender`).

## Verify (needs a signed-in session)
Dashboard "Create" → lands in `/build/[id]` → add a perspective + evidence →
wait for autosave → refresh persists → dashboard card shows updated
layers/status/edited-time. `npx tsc --noEmit` clean; preview console/network clean.

## Out of scope (Phase 3)
Collaboration UI (invite wiring — table exists, unused), per-row `author_id`,
realtime, `/try` import, atomic-save RPC, real account deletion.
