-- 0030_reasoning_runs.sql
-- Persists the reasoning pipeline's packets/verdicts (decision 019, Phase 2
-- item 1 — plans/active/reasoning-pipeline/04-verification-and-open-questions.md's
-- "whether packets and panel verdicts are persisted" was left open; resolved
-- yes, see plans/active/reasoning-pipeline/15-persistence.md for the full
-- rationale). One JSONB row per run, upserted by lib/ai/reasoning/persistence.ts
-- after every real (non-dry-run) step response — not just on completion, so a
-- halted run is captured too, matching 13/14's real incidents (both of which
-- halted mid-run). Mirrors 0022_houses_draft.sql (jsonb progress-state
-- precedent) for shape and 0028_ai_daily_exhaustion.sql (deny-all RLS +
-- service-role-only grant, server-only writer) for access. Idempotent.

create table if not exists public.reasoning_runs (
  id           uuid primary key,
  original_query text not null,
  status       text not null,
  last_step    text not null,
  halt_reason  text,
  run_state    jsonb not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- RLS on with NO policies → every row denied to anon/authenticated. The
-- service-role key (server-only lib/ai/reasoning/persistence.ts) bypasses RLS.
alter table public.reasoning_runs enable row level security;

-- Grant exactly what persistence.ts uses: insert for a new run's first
-- write, update for every subsequent upsert on the same id (Postgres's
-- INSERT ... ON CONFLICT DO UPDATE needs no separate SELECT grant — conflict
-- detection is an internal index check, not a privilege-checked read). No
-- select: nothing reads this table back yet, see 15-persistence.md's scope
-- note. Explicit in the same file per this project's recurring grant-gap bug
-- (0005, 0012, 0028/0029) — not a follow-up fix discovered live.
grant insert, update on public.reasoning_runs to service_role;
