-- 0025_dashboard_index.sql
-- Perf index for the dashboard "Your Houses" grid (DB-audit C1): the query is
-- owner-scoped (`owner_id = auth.uid()`, non-strawman, newest first), so give
-- the planner a partial index in exactly that shape instead of a seq scan +
-- sort. Pure perf helper — the app works without it. Idempotent.

create index if not exists houses_owner_updated_idx
  on public.houses (owner_id, updated_at desc)
  where is_strawman = false;
