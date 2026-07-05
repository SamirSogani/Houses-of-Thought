# Decision 004 — "Create a house" RLS chain (postmortem + fixes)

**Date:** 2026-07-05
**Status:** Resolved

Creating a house from the dashboard failed with *"Could not create a new house.
Please try again."* Behind that one message were **four independent problems
stacked on top of each other** — each one hid the next, so every fix revealed a
new failure. This record captures each layer, how it was diagnosed, and the fix,
so the same rabbit hole is not re-run.

## Symptom

`POST` into `public.houses` (via `supabase.from('houses').insert(...).select('id')`
in [app/dashboard/page.tsx](../app/dashboard/page.tsx)) failed. The app swallowed
the real Postgres error behind a generic string, which is what made this slow —
**fix #0 was to log the actual error** (`code`/`message`/`hint`) as a flat string,
since the Next.js dev overlay collapses raw error objects to `{}`.

## The four layers

### 1. Missing table GRANT (`42501 permission denied for table houses`)
- **What:** `0003`/`0004` enabled RLS and wrote policies but never granted base
  table privileges to the `authenticated` role. A role must hold the table
  privilege *before* RLS is evaluated, so every request failed at the privilege
  check — before any policy ran.
- **Diagnosed:** direct `POST` to PostgREST returned `42501 permission denied`
  with the hint *"Grant the required privileges to the current role"*.
- **Fixed:** [0005_houses_grants.sql](../supabase/migrations/0005_houses_grants.sql)
  grants `select/insert/update/delete` on the house tables to `authenticated`.

### 2. RLS enabled but **no policies existed**
- **What:** the tables had RLS on with zero policies (tables had been created
  without the policy sections of the migrations ever being applied — the classic
  result of creating tables through the dashboard UI). RLS + no permissive policy
  = every row denied. This also silently returned an empty house list on the
  dashboard (a `SELECT` with no policy yields zero rows, not an error).
- **Diagnosed:** `select * from pg_policies where tablename = 'houses'` returned
  **zero rows** while `relrowsecurity` was `true`.
- **Fixed:** applied the full [0003](../supabase/migrations/0003_houses.sql) and
  [0004](../supabase/migrations/0004_collaborators.sql) in order (they are
  idempotent). Order matters: `0004` leaves `houses_insert`/`houses_delete` as
  created by `0003`, so `0003` must run first.

### 3. No real authenticated session (`auth.uid()` was null)
- **What:** the dashboard was reachable off a stale/expired cookie, not a live
  login, so the insert reached Postgres without a valid identity and the RLS
  check `auth.uid() = owner_id` failed.
- **Diagnosed:** a temporary client log showed `hasSession`/`tokenRole`; login
  itself returned *"Invalid login credentials"*. Project has
  `mailer_autoconfirm: true`, so the fix was simply to sign up / log in for real.
- **Fixed:** created a fresh account (auto-confirmed → immediate valid session).

### 4. `houses_select` broke `INSERT ... RETURNING` (the real create bug)
- **What:** the app inserts with `.select('id')`, i.e. `INSERT ... RETURNING`. To
  return the new row, Postgres re-checks the **SELECT** policy against it. `0004`
  had rewritten `houses_select` to `using (can_access_house(id))`, and
  `can_access_house` → `owns_house()` runs `select ... from houses where id = ...`.
  During the insert, that re-query cannot see the row being inserted (statement
  snapshot), returns false, and the row can't be returned — surfaced as
  *"new row violates row-level security policy for table houses"*. The insert
  itself was fine; only the returning-select failed.
- **Diagnosed:** an insert **without** `RETURNING` succeeded in an impersonated
  `authenticated` transaction, while the same insert **with** `RETURNING` failed —
  and `auth.uid()` / `(auth.uid() = owner_id)` were proven correct in that context.
- **Fixed:** [0006_fix_houses_select_returning.sql](../supabase/migrations/0006_fix_houses_select_returning.sql)
  rewrites `houses_select` to check `owner_id = auth.uid()` **directly** (visible on
  the new row, no self-query) and moves the collaborator check into a
  `is_house_collaborator()` `security definer` helper that reads only
  `house_collaborators` (no self-reference on `houses`, no policy recursion).

## Lessons

- **Never let a client swallow a DB error.** Surface `code`/`message`/`hint`; it
  would have collapsed this from hours to minutes.
- **RLS policies that re-query their own table break `INSERT ... RETURNING`.**
  Prefer direct column checks (`owner_id = auth.uid()`) for the owning row;
  reserve `security definer` helpers for *other* tables (collaborators).
- **Creating tables in the dashboard UI enables RLS with no policies.** Always
  apply the tracked migration files so policies and grants come with the table.

### Rule of thumb for RLS policies

> A table's RLS policy must not run a subquery against **its own table** to
> authorize a row. Check the row's own columns directly (`owner_id = auth.uid()`),
> or authorize via a **different** table (parent lookup, `house_collaborators`)
> through a `security definer` helper.

Self-querying a table inside its own policy is exactly what breaks
`INSERT ... RETURNING`: during the insert the subquery runs under the statement
snapshot and cannot see the new row.

**Child tables verified safe (no change needed).** `house_perspectives`,
`house_evidence`, `house_assumptions`, and `house_implications` authorize via the
**parent** through `can_access_house(house_id)` / `can_edit_house(house_id)`, which
query `houses` — never the child row being inserted. The parent house already
exists at insert time, so `INSERT ... RETURNING` on a child table works for owners
and editor-collaborators. The self-query trap only applied to `houses_select`.
