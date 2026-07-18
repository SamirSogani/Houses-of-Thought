-- 0023_ai_usage_retention.sql
-- ai_usage grows one row per subject per day forever (DB-audit L1), and the
-- layered IP ceiling in lib/ai/limits.ts roughly doubles anonymous row writes
-- (ai-subsystem plan 0.2 / 3.3). Rows are only ever read for "today", so keep
-- 90 days and prune weekly.
--
-- pg_cron ships with Supabase; if `create extension` errors, enable it under
-- Database → Extensions first. If pg_cron is unavailable in your environment,
-- skip this file and run the DELETE below from the ops plan's nightly GitHub
-- Action instead. Idempotent: re-running replaces the schedule.

create extension if not exists pg_cron;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'ai-usage-retention') then
    perform cron.unschedule('ai-usage-retention');
  end if;
end $$;

select cron.schedule(
  'ai-usage-retention',
  '17 3 * * 0', -- weekly, Sunday 03:17 UTC
  $$delete from public.ai_usage where day < current_date - interval '90 days'$$
);
