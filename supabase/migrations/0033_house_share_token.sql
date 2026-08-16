-- 0033_house_share_token.sql
-- Mechanism 2 ("Share") of plans/active/persistence/invite-share-panels.md: a
-- read-only, no-account link for a single house. `share_token` is nullable —
-- null means "not shared" — and unique so a token round-trips to at most one
-- house. Set by the owner (from the dashboard) to a fresh uuid to create a
-- link, cleared back to null to revoke it; both are plain owner-gated UPDATEs
-- via the existing houses_update policy (0004/0006/0020) — no new policy.
--
-- Deliberately NO RLS or grant changes: `anon` keeps its existing zero table
-- grants on houses (0005), and `authenticated` already has full owner-gated
-- read/write via houses_select/houses_update. The share link is never looked
-- up through PostgREST/RLS at all — a Route Handler
-- (app/api/shared/[token]/route.ts) reads it with the service-role key, which
-- bypasses RLS entirely. So "does this row have this share_token" is
-- authorized by TOKEN POSSESSION in application code, not by a table policy —
-- unauthenticated visitors still cannot query public.houses directly.
--
-- Idempotent — safe to re-run.

alter table public.houses
  add column if not exists share_token uuid unique;
