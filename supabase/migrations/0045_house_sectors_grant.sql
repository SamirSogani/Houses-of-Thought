-- 0045_house_sectors_grant.sql
-- Grant table privileges on house_sectors to the `authenticated` role.
--
-- 0044 created the table with RLS policies but omitted the base-table GRANT.
-- Postgres checks the role's table privilege *before* RLS, so without this
-- GRANT every authenticated request fails with `42501: permission denied for
-- table house_sectors` — before any policy runs. Same issue as 0005 fixed for
-- the original house tables.
--
-- Idempotent — GRANT is safe to re-run.

grant select, insert, update, delete on public.house_sectors to authenticated;
