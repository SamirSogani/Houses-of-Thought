-- 0040_house_layer_feedback_grant.sql
-- Same class of gap as 0005/0012/0019/0029/0031/0034/0035/0037: RLS policies
-- alone don't grant base table access — the connecting role still needs an
-- explicit GRANT regardless of what the policies say. 0039 created
-- house_layer_feedback with select/insert RLS policies but never granted the
-- table itself to `authenticated`, which is who actually connects here — both
-- the person's message and the co-pilot's reply are inserted by
-- app/api/houses/[id]/layer-feedback/route.ts under the CALLER's own session
-- (createClient(), not service role), same as house_presence/
-- house_direct_messages before 0037. Confirmed live as a real "permission
-- denied for table house_layer_feedback" (42501) error, not assumed.
--
-- Grant matches exactly what 0039's own RLS policies permit: select, insert
-- (no update/delete policy exists on this table). Idempotent (GRANT is
-- inherently re-runnable).

grant select, insert on public.house_layer_feedback to authenticated;
