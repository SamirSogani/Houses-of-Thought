-- 0031_reasoning_runs_select_grant.sql
-- Adds SELECT on reasoning_runs to service_role, for the new "browse past
-- runs" admin UI (plans/active/reasoning-pipeline/15-persistence.md) —
-- lib/ai/reasoning/persistence.ts's listReasoningRuns/getReasoningRun, read
-- through app/api/admin/reasoning/runs/. 0030 deliberately granted only
-- insert/update ("nothing reads this table back yet"); that's no longer
-- true. RLS itself is unchanged (still deny-all to anon/authenticated) —
-- only the service-role grant widens. Idempotent.

grant select on public.reasoning_runs to service_role;
