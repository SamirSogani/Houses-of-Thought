-- 0032_reasoning_runs_panels_off.sql
-- Adds a panels_off column to reasoning_runs so the browse-past-runs admin UI
-- (plans/active/reasoning-pipeline/16-ab-review-panel.md, Phase 2 item 3) can
-- show which runs used the panels-off A/B mode without parsing run_state.
-- A run-level fact (set once, fixed for that run's lifetime), same tier as
-- the existing status/last_step columns rather than something to infer from
-- JSONB — the run_state blob (0030) stays the single source of truth for
-- packet/verdict content; this is metadata about the run itself. Defaults
-- false so every pre-existing row (all real runs before this feature
-- existed) reads correctly as panels-on. No RLS/grant change needed — same
-- deny-all/service-role-only access as the rest of the table (0030/0031).
-- Idempotent.

alter table public.reasoning_runs add column if not exists panels_off boolean not null default false;
