-- 0035_invite_share_service_role_grants.sql
-- Same class of gap as 0034, for the rest of the tables Mechanism 1
-- ("Invite") and Mechanism 2 ("Share") of
-- plans/active/persistence/invite-share-panels.md read via service role:
--
--   - app/api/collaborators/route.ts (GET) reads house_collaborators —
--     confirmed live as "permission denied for table house_collaborators"
--     (42501) the first time the membership list actually loaded.
--   - app/api/shared/[token]/route.ts reads houses + its four child tables
--     by service role (deliberately not through RLS — see 0033's own
--     comment). Grepped every migration for an existing service_role grant
--     on any of these six tables: none exists, anywhere, ever — this
--     project's Supabase instance doesn't auto-grant new tables to
--     service_role (0029's own finding), and nothing before this feature
--     ever needed service-role access to house data. Granting proactively
--     here rather than waiting to hit each one individually.
--
-- RLS itself is unchanged on every one of these tables — only the
-- service-role grant widens. Idempotent.

grant select on public.house_collaborators to service_role;
grant select on public.houses to service_role;
grant select on public.house_perspectives to service_role;
grant select on public.house_evidence to service_role;
grant select on public.house_assumptions to service_role;
grant select on public.house_implications to service_role;
