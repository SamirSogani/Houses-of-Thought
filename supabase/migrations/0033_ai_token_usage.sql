-- 0033_ai_token_usage.sql
-- Per-call token usage + cost ledger for the admin "Token usage" panel
-- (`/admin/usage`, decision 020). One row per successful AI provider
-- response, written fire-and-forget by lib/ai/token-usage.ts right after
-- lib/ai/router.ts's callProvider succeeds — same service-role client +
-- VITEST hard-gate + never-throws contract as 0030_reasoning_runs.sql's
-- persistRunStep, same deny-all RLS + service-role grant as 0028's
-- ai_daily_exhaustion. cost_usd is computed and stored AT WRITE TIME from
-- the pricing table current when the call was made, so a later price-table
-- edit never rewrites history (matches how a real invoice works). Idempotent.

create table if not exists public.ai_token_usage (
  id             bigint generated always as identity primary key,
  day            date not null,
  provider       text not null,
  model          text not null,
  role           text not null,
  input_tokens   integer not null,
  output_tokens  integer not null,
  total_tokens   integer not null,
  cost_usd       numeric(12, 6) not null default 0,
  -- false when `model` had no entry in lib/ai/token-usage.ts's hand-maintained
  -- pricing table at write time (e.g. an env-overridden model id, see
  -- router-config.ts). cost_usd is 0 in that case — NOT a real zero-cost call
  -- — so the admin panel can show "cost unknown for N tokens" instead of
  -- silently undercounting.
  priced         boolean not null default true,
  created_at     timestamptz not null default now()
);

create index if not exists ai_token_usage_day_idx on public.ai_token_usage (day);
create index if not exists ai_token_usage_model_idx on public.ai_token_usage (provider, model);

-- RLS on with NO policies → every row denied to anon/authenticated. The
-- service-role key (server-only lib/ai/token-usage.ts) bypasses RLS.
alter table public.ai_token_usage enable row level security;

-- Grant exactly what token-usage.ts uses: insert for each recorded call,
-- select for the summary RPC below. Explicit in the same file per this
-- project's recurring grant-gap bug (0005, 0012, 0028/0029) — not a
-- follow-up fix discovered live.
grant insert, select on public.ai_token_usage to service_role;

-- Server-side group-by so the admin panel's read scales with the number of
-- distinct models (a handful) instead of the number of rows (one per AI
-- call, potentially thousands/day) — unlike 0011_ai_usage.sql's plain-select-
-- then-aggregate-in-JS pattern, which is fine for that table's low
-- cardinality (one row per subject per day) but would not be here. Mirrors
-- 0011's increment_ai_usage as this table's second RPC.
create or replace function public.ai_token_usage_summary(since_day date)
returns table (
  provider text,
  model text,
  calls bigint,
  input_tokens bigint,
  output_tokens bigint,
  total_tokens bigint,
  cost_usd numeric,
  unpriced_calls bigint
)
language sql
stable
as $$
  select
    provider,
    model,
    count(*) as calls,
    sum(input_tokens) as input_tokens,
    sum(output_tokens) as output_tokens,
    sum(total_tokens) as total_tokens,
    sum(cost_usd) as cost_usd,
    count(*) filter (where not priced) as unpriced_calls
  from public.ai_token_usage
  where since_day is null or day >= since_day
  group by provider, model
$$;

grant execute on function public.ai_token_usage_summary(date) to service_role;

-- Rows are only ever read through the summary RPC above over the last 90
-- days (matches 0023_ai_usage_retention.sql's window); prune weekly. Requires
-- pg_cron (ships with Supabase; enable it under Database → Extensions if the
-- create extension below errors — see 0023's comment for the same caveat).
create extension if not exists pg_cron;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'ai-token-usage-retention') then
    perform cron.unschedule('ai-token-usage-retention');
  end if;
end $$;

select cron.schedule(
  'ai-token-usage-retention',
  '29 3 * * 0', -- weekly, Sunday 03:29 UTC (offset from ai-usage-retention's 03:17)
  $$delete from public.ai_token_usage where day < current_date - interval '90 days'$$
);
