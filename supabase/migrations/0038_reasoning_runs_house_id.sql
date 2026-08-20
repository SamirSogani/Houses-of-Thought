-- 0038_reasoning_runs_house_id.sql
-- Links reasoning_runs to a house (plan doc
-- plans/active/reasoning-pipeline/27-house-scoped-pipeline-integration.md,
-- decision 019): the new house-scoped route
-- (app/api/houses/[id]/reasoning/route.ts) persists runs the same way the
-- admin route always has (lib/ai/reasoning/persistence.ts's persistRunStep,
-- service-role-only writer), just with this column filled in. Nullable and
-- additive only — admin-triggered runs keep house_id: null, exactly as
-- before this migration; no existing column, RLS policy, or grant changes.
-- Idempotent.

alter table public.reasoning_runs
  add column if not exists house_id uuid references public.houses (id) on delete cascade;

-- Read pattern this unlocks later (not built yet — no route reads by house_id
-- today): "this house's own past runs." Added proactively so the shape is
-- right from the start rather than as a follow-up migration once that read
-- path exists.
create index if not exists reasoning_runs_house_id_idx
  on public.reasoning_runs (house_id) where house_id is not null;

-- No RLS/grant change: reasoning_runs stays deny-all RLS, service-role-only
-- insert/update/select (0030/0031) — house_id is just another column on an
-- already fully-locked-down table, not a new access path. The house-scoped
-- route's AUTHORIZATION (who may start/advance a run for a given house) is
-- enforced in the route itself against the caller's own session, not via
-- this table's RLS.
