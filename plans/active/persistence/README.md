# House Persistence Milestone

Move the logged-in app off in-memory seed data and onto Supabase. Houses,
dashboard summaries, and profiles become real, per-user, durable records.

**Status:** In progress (started 2026-07-04). Phases 0–1, 4 done; Phase 2/3
dashboard subsection done. Next: `/build` per-house load + autosave.

Schema shape and scope: **fully normalized** tables, **single-owner** scope
([decisions/002-house-schema.md](../../../decisions/002-house-schema.md),
[decisions/003-collaboration-model.md](../../../decisions/003-collaboration-model.md)).

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

✅ **Phase 0 — Migrations foundation** (2026-07-04).
Adopt `supabase/migrations/*.sql` as tracked source of truth. `0001_profiles.sql`
backfills the hand-run `profiles` SQL so repo == live DB.

✅ **Phase 1 — Schema + RLS** (2026-07-04).
- `0002_profiles_extend.sql`: profile columns + unique username.
- `0003_houses.sql`: houses + 4 child tables + owner-only RLS.
- `0004_collaborators.sql`: collaborators table + access helpers; RLS rewritten
  to honor collaborators (foundation only, no app feature yet).
All three migrations applied to live DB.

✅ **Phase 4 — Route protection** (2026-07-04).
`middleware.ts` now server-guards `/dashboard`, `/build`, `/profile` at the
middleware layer — unauthenticated requests redirect to `/login?next=<path>`.

⏳ **Phase 2 + Phase 3 (dashboard subsection)** (2026-07-04).
- Dashboard queries the signed-in user's `houses` on mount, ordered by
  `updated_at` desc.
- "Create New House" inserts a real row and refreshes the grid.
- Removed now-redundant client-side auth guard from `/dashboard/page.tsx`.
- `CreateHouseCard` Link → button with `onClick` + loading state.

⏳ **Phase 3 (profile + builder)** — planned, not started. Two execution-ready
handoffs; a fresh session can run either cold. Do profile first, then builder:
- [phase-3-profile.md](phase-3-profile.md) — `/profile` read/write to `profiles`.
  Small; re-proves the round-trip.
- [phase-3-builder.md](phase-3-builder.md) — `/build` → `/build/[id]`: load a
  house into the reducer, debounced autosave. The big one; watch the integer-id
  ↔ uuid mapping and the ephemeral-field exclusions called out there.

## Deferred to follow-up milestones

- `house_collaborators` table + wiring the invite/team flow to real users.
  Until then `owner_key` (`you`/`maya`/`devan`/`ai`) is a cosmetic text field.
- `/try` localStorage → account import on signup.
- Real-time multi-user co-editing.
