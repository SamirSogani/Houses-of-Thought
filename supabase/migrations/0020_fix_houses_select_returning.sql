-- 0020_fix_houses_select_returning.sql
-- Regression fix: creating a house again failed with "new row violates row-level
-- security policy for table houses" (42501) on INSERT ... RETURNING — the app
-- inserts with `.select('id')`.
--
-- Cause: 0014 rewrote houses_select to lead with can_access_house(id), whose
-- owns_house() runs `select ... from public.houses where id = hid` — a self-query
-- on houses. During INSERT ... RETURNING that re-query runs under the statement
-- snapshot and cannot see the row being inserted, so the owner's new house can't
-- be returned. This is exactly the trap decision 004 documented and 0006 fixed;
-- 0014/0017 reintroduced it. (The classroom branches can_view_student_house /
-- can_view_assignment_strawman also self-query houses, but they are never the
-- path by which a user reads their OWN just-inserted house.)
--
-- Fix: authorize the owning row by its own column (owner_id = auth.uid(), visible
-- on the new row, no self-query), keep collaborator reads via the 0006
-- security-definer helper, and keep the classroom read branches (safe for a
-- normal SELECT where the row already exists; irrelevant to the owner's insert).
-- See decision 004's rule of thumb: an RLS policy must not sub-query its own table
-- to authorize a row. Idempotent.

drop policy if exists houses_select on public.houses;
create policy houses_select on public.houses
  for select using (
    owner_id = auth.uid()
    or public.is_house_collaborator(id)
    or public.can_view_student_house(id)
    or public.can_view_assignment_strawman(id)
  );
