-- 0028_ai_daily_exhaustion.sql
-- Persists which AI providers tripped their daily quota today, so the
-- in-memory router-state cache (lib/ai/router-state.ts) survives a dev-server
-- restart or a fresh serverless cold start instead of re-discovering the same
-- exhaustion with one more real (failing, but not free) API call per provider.
-- Deny-all RLS: only the service-role key (server-only router-state.ts) ever
-- touches this — same pattern as 0011_ai_usage.sql. Idempotent.

create table if not exists public.ai_daily_exhaustion (
  provider text not null,
  day      date not null,
  primary key (provider, day)
);

-- RLS on with NO policies → every row denied to anon/authenticated. The
-- service-role key bypasses RLS, so server-only code still reads/writes.
alter table public.ai_daily_exhaustion enable row level security;
