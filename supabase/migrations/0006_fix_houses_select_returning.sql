-- 0006_fix_houses_select_returning.sql
-- Fix: creating a house fails with "new row violates row-level security policy
-- for table houses" on INSERT ... RETURNING (which is what the app does via
-- `.insert().select()`).
--
-- Cause: 0004 rewrote houses_select to `using (can_access_house(id))`. That
-- function calls owns_house(), which runs `select ... from public.houses where
-- id = hid`. During an INSERT ... RETURNING, this re-query of `houses` runs under
-- the statement's snapshot and cannot see the row currently being inserted, so it
-- returns false, the new row can't be returned, and Postgres reports an RLS
-- violation. (0003's original `using (auth.uid() = owner_id)` didn't self-query,
-- so it never hit this.)
--
-- Fix: check ownership by referencing the row's own `owner_id` column directly
-- (visible on the new row, no self-query), and keep collaborator read access via
-- a SECURITY DEFINER helper that only reads house_collaborators — never houses —
-- so there is no self-reference and no policy recursion.
--
-- Idempotent.

create or replace function public.is_house_collaborator(hid uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists (
    select 1 from public.house_collaborators
    where house_id = hid and user_id = auth.uid()
  );
$$;

grant execute on function public.is_house_collaborator(uuid) to authenticated, anon;

drop policy if exists houses_select on public.houses;
create policy houses_select on public.houses
  for select using (
    owner_id = auth.uid()
    or public.is_house_collaborator(id)
  );
