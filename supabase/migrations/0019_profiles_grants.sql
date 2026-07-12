-- 0019_profiles_grants.sql
-- Grant table privileges on public.profiles to the `authenticated` role.
--
-- profiles has had RLS + policies since 0001, but never a base-table GRANT — the
-- same gap 0005 fixed for the houses tables. RLS filters rows only AFTER Postgres
-- checks the role's table privilege, so without this GRANT every authenticated
-- request to profiles fails first with `42501: permission denied for table
-- profiles` (a 403 over PostgREST) — before any policy runs. This blocks reading
-- account_type (teacher detection, capability gating) and every profile save.
--
-- INSERT stays covered by the SECURITY DEFINER signup trigger (handle_new_user),
-- but is granted too for parity; the owner-only RLS from 0001 still governs which
-- rows this role can actually see or change. `anon` is intentionally excluded —
-- profiles are private to their signed-in owner.
--
-- Idempotent — GRANT is safe to re-run.

grant select, insert, update, delete on public.profiles to authenticated;
