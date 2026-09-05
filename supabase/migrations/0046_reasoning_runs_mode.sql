-- 0046_reasoning_runs_mode.sql
-- Add a mode column to reasoning_runs so persistence records whether a run
-- used the thorough (22-step) or express (7-step) pipeline. Defaults to
-- 'thorough' so every existing row keeps its current meaning without a
-- backfill.
--
-- Idempotent — ALTER TABLE … ADD COLUMN IF NOT EXISTS is safe to re-run.

alter table public.reasoning_runs
  add column if not exists mode text not null default 'thorough';
