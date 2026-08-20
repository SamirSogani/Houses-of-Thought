-- 0034_profiles_service_role_select_grant.sql
-- Adds SELECT on profiles to service_role, for Mechanism 1 ("Invite") of
-- plans/active/persistence/invite-share-panels.md —
-- app/api/collaborators/route.ts resolves an email to a user id and joins
-- collaborator display names, both service-role reads (profiles SELECT RLS
-- is owner-only, 0001, so a plain authenticated client can't do either).
-- 0001 (the original hand-run migration, predates this project's
-- service_role-grant pattern — see 0012/0029/0031 for the same fix on other
-- tables) never granted service_role anything on profiles; nothing needed
-- it until now. Live-verified missing via a real "permission denied for
-- table profiles" (Postgres 42501) error, not assumed. RLS itself is
-- unchanged (still owner-only to anon/authenticated) — only the
-- service-role grant widens. Idempotent.

grant select on public.profiles to service_role;
