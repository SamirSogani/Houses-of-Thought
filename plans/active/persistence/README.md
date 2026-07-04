# House Persistence Milestone

Move the logged-in app off in-memory seed data and onto Supabase. Houses,
dashboard summaries, and profiles become real, per-user, durable records.

**Status:** Planned (2026-07-04). Schema shape and scope decided in
[decisions/002-house-schema.md](../../../decisions/002-house-schema.md):
**fully normalized** tables, **single-owner** scope for this first cut.

## Starting point

- Auth works; `@supabase/ssr` browser + server clients exist (`lib/supabase/`).
- Only `public.profiles` (id, email, created_at) exists in the DB.
- Everything else is seed data: `lib/build/state.ts` (the house document),
  `lib/dashboard/houses.ts` (summaries), `lib/profile/data.ts` (profile fields).
- No route protection (`/dashboard` is client-guarded only); no `middleware.ts`.
- `/build` has no house id in its route — it always loads the same seed.

## Target schema (normalized, single-owner)

| Table | Key columns |
|---|---|
| `profiles` *(extend)* | `username` (unique), `account_type`, `about_me`, `current_project`, `role`, `location`, `perspectives` (jsonb) |
| `houses` | `id`, `owner_id → auth.users`, `title`, `question`, `status`, `layers_complete`, `concepts` (text[]), `watchpoints` (text[]), `accepted` (jsonb), `created_at`, `updated_at` |
| `house_perspectives` | `house_id`, `name`, `summary`, `questions`, `strength`, `owner_key`, `position` |
| `house_evidence` | `house_id`, `text`, `source`, `owner_key`, `by_ai`, `position` |
| `house_assumptions` | `house_id`, `text`, `owner_key`, `position` |
| `house_implications` | `house_id`, `kind` (pos/neg/unc), `text`, `horizon`, `who`, `position` |

**RLS:** `houses` → `owner_id = auth.uid()`. Child tables → `house_id in
(select id from houses where owner_id = auth.uid())`.

## Phases

**Phase 0 — Migrations foundation.** Adopt `supabase/migrations/*.sql` as the
tracked source of truth. `0001_profiles.sql` backfills the hand-run `profiles`
SQL so repo == live DB. *(Scaffolded 2026-07-04; diff `0001` against live DB.)*

**Phase 1 — Schema + RLS.** `0002_profiles_extend.sql` (profile columns +
unique username), `0003_houses.sql` (houses + child tables + RLS).

**Phase 2 — Data-access layer.** Replace the three seed modules with typed
Supabase queries; keep `lib/build/types.ts` shapes as the row contracts. Derive
`layers_complete`/`status` via existing `computeStrength`/`layerKey` helpers.

**Phase 3 — Wire the UI.**
- Dashboard lists the user's houses; "create house" inserts a row.
- Refactor `/build` → `/build/[id]`: hydrate the reducer from rows,
  debounced autosave back. UI-only reducer fields (step, tabs, toast,
  inviteOpen) stay ephemeral — never persisted.
- Profile reads/writes `profiles`.

**Phase 4 — Route protection.** `middleware.ts` (`@supabase/ssr`
`updateSession`) refreshes tokens and server-guards `/dashboard`, `/build`,
`/profile`.

## Deferred to follow-up milestones

- `house_collaborators` table + wiring the invite/team flow to real users.
  Until then `owner_key` (`you`/`maya`/`devan`/`ai`) is a cosmetic text field.
- `/try` localStorage → account import on signup.
- Real-time multi-user co-editing.
