# House Persistence Milestone

Move the logged-in app off in-memory seed data and onto Supabase. Houses,
dashboard summaries, and profiles become real, per-user, durable records.

**Status:** Core complete (2026-07-04). All phases (0–4) done: `/profile` and
`/build` now read/write real per-user rows. Remaining work is the follow-up
items below (collaboration UI, `/try` import, atomic-save RPC).

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

✅ **Phase 4 — Route protection** (2026-07-04; **actually wired 2026-08-15/16**).
`proxy.ts` server-guards `/dashboard`, `/build`, `/profile`, `/classroom`,
`/classes`, `/join` — unauthenticated requests redirect to
`/login?next=<path>`. **Correction, part 1 (2026-08-15):** from 2026-07-04
the file sat as `proxy.ts` with an export named `proxy`, which the
then-resolved Next.js version (16.2.9) didn't recognize as any file
convention at all — confirmed via an empty `middleware-manifest.json` — so
it silently did nothing for six weeks. Renamed to `middleware.ts` and
verified live. **Correction, part 2 (2026-08-16, hours later):**
`package.json` pins Next at `^16.2.9` (unpinned patch range); a routine
`npm`/`next dev` run floated the resolved version to 16.2.10, which
introduced official support for a *new* `proxy.ts`/`export function proxy()`
convention and marked `middleware.ts` deprecated in favor of it (confirmed
against Next's own docs, nextjs.org/docs/messages/middleware-to-proxy, and
`PROXY_FILENAME` alongside `MIDDLEWARE_FILENAME` in the installed package
source). Renamed back to `proxy.ts` — this time as the framework's actual
current convention, not the original bug. Every downstream page's route-
protection comment now says `proxy.ts` again, correctly. Moral: this file's
name has now been correct under three different meanings in six weeks —
don't assume either name is stable; check the installed Next.js version's
own constants/docs before touching it again.

⏳ **Phase 2 + Phase 3 (dashboard subsection)** (2026-07-04).
- Dashboard queries the signed-in user's `houses` on mount, ordered by
  `updated_at` desc.
- "Create New House" inserts a real row and refreshes the grid.
- Removed now-redundant client-side auth guard from `/dashboard/page.tsx`.
- `CreateHouseCard` Link → button with `onClick` + loading state.

✅ **Phase 3 (profile + builder)** (2026-07-04).
- [phase-3-profile.md](phase-3-profile.md) — `/profile` reads its `profiles` row
  and debounce-saves edits (`rowToProfile`/`profileToRow`); blocks invalid
  usernames, surfaces `23505` as "taken".
- [phase-3-builder.md](phase-3-builder.md) — `/build` → `/build/[id]`: `loadHouse`
  seeds the reducer, ~800ms debounced `saveHouse` (whole-house replace). Mapping
  lives at `lib/build/persistence.ts`; the reducer's integer ids ↔ uuids and the
  ephemeral-field exclusions are handled there. New houses load blank.

## Deferred to follow-up milestones

- ~~`house_collaborators` table + wiring the invite/team flow to real
  users.~~ **Shipped 2026-08-16**, fully verified live:
  [invite-share-panels.md](invite-share-panels.md). `owner_key`
  (`you`/`maya`/`devan`/`ai`) is still cosmetic — real per-item attribution
  remains a separate, deferred change.
- **v2 in progress:** real presence, DMs, activity log, always-on Team tab
  — [team-panel-v2.md](team-panel-v2.md).
- `/try` localStorage → account import on signup.
- Real-time multi-user co-editing.
