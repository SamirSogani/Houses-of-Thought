-- 0005_houses_grants.sql
-- Grant table privileges on the house tables to the `authenticated` role.
--
-- 0003/0004 enabled RLS and wrote policies, but never granted the base table
-- privileges the API roles need. RLS filters rows *after* Postgres checks the
-- role's table privilege, so without a GRANT every request fails first with
-- `42501: permission denied for table houses` — before any policy runs. This is
-- what breaks "Create new house" (INSERT) and the dashboard load (SELECT).
--
-- Only `authenticated` is granted: houses are private to their signed-in owner,
-- and RLS (owner / collaborator checks from 0003-0004) still restricts which
-- rows that role can actually see or change. `anon` is intentionally left out.
--
-- Idempotent — GRANT is safe to re-run.

grant select, insert, update, delete on public.houses              to authenticated;
grant select, insert, update, delete on public.house_perspectives  to authenticated;
grant select, insert, update, delete on public.house_evidence      to authenticated;
grant select, insert, update, delete on public.house_assumptions   to authenticated;
grant select, insert, update, delete on public.house_implications  to authenticated;
grant select, insert, update, delete on public.house_collaborators to authenticated;
