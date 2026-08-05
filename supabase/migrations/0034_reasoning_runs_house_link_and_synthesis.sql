-- 0034_reasoning_runs_house_link_and_synthesis.sql
-- Two capabilities for a finished reasoning-pipeline run: materializing it into
-- a real, editable House ("View in house"), and a cached multi-agent pro/con
-- synthesis with a persisted ask-AI sidebar transcript. Three nullable/
-- defaulted columns on reasoning_runs, matching 0031/0032's style — no new
-- grants needed, service_role already has table-wide insert/update/select
-- from 0030/0031. Idempotent.

-- Links a run to the house it was materialized into (RunActions.tsx), so a
-- second click reuses the same house instead of duplicating one. on delete
-- set null: deleting the house should never take the run's own record with
-- it — the run stays a valid, readable artifact on its own.
alter table public.reasoning_runs
  add column if not exists house_id uuid references public.houses(id) on delete set null;

-- Caches the generated pro/con synthesis (lib/ai/reasoning/synthesis.ts) so
-- repeat visits to the synthesis page don't re-spend the 4 AI calls that
-- built it. Null until first generated.
alter table public.reasoning_runs
  add column if not exists synthesis jsonb;

-- The synthesis page's persisted ask-AI sidebar transcript. Starts empty, not
-- null, so appendSynthesisChat() (persistence.ts) never has to null-check
-- before appending.
alter table public.reasoning_runs
  add column if not exists synthesis_chat jsonb not null default '[]'::jsonb;
