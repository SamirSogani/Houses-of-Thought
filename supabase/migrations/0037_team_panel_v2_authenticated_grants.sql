-- 0037_team_panel_v2_authenticated_grants.sql
-- Same class of gap as 0005/0012/0019/0029/0031/0034/0035, missed for two
-- more tables in 0036: house_presence and house_direct_messages are both
-- written by the CALLER's own RLS-respecting session (not service role,
-- unlike house_activity) — but 0036 only ever granted service_role anything
-- (on house_activity). RLS policies alone don't grant base table access; the
-- connecting role still needs an explicit GRANT regardless of what the
-- policies say. Confirmed live as real "permission denied for table
-- house_presence" (42501) errors from `authenticated`, not assumed.
--
-- Grants match exactly what each table's own RLS policies permit (0036):
--   house_presence: select, insert, update (no delete policy exists)
--   house_direct_messages: select, insert (no update/delete policy exists)
-- house_activity is untouched here — its only writers are SECURITY DEFINER
-- triggers (which run as the function owner, not the calling role, so no
-- authenticated grant is needed) and the share-link route (service_role,
-- already granted in 0036). Idempotent.

grant select, insert, update on public.house_presence to authenticated;
grant select, insert on public.house_direct_messages to authenticated;
