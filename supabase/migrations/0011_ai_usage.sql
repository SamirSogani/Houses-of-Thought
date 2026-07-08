-- 0011_ai_usage.sql
-- Daily AI usage counters + an atomic increment RPC, backing the per-subject
-- rate limits (plans/active/ai Phase 6 / lib/ai/limits.ts). Deny-all RLS + revoked
-- execute: only the service-role key (server routes) ever touches this — no client,
-- anon or authenticated, can read counts or call the function. Idempotent.

create table if not exists public.ai_usage (
  day     date not null,
  subject text not null,          -- 'user:<uuid>' or 'ip:<sha256-16>' (hashed, no raw IPs)
  count   int  not null default 0,
  primary key (day, subject)
);

-- RLS on with NO policies → every row denied to anon/authenticated. The
-- service-role key bypasses RLS, so server routes still read/write.
alter table public.ai_usage enable row level security;

-- Atomic upsert-and-return-count. SECURITY DEFINER so the service role runs it
-- with a fixed search_path (0004 helper pattern).
create or replace function public.increment_ai_usage(sub text)
returns int language sql security definer set search_path = public as $$
  insert into ai_usage (day, subject, count) values (current_date, sub, 1)
  on conflict (day, subject) do update set count = ai_usage.count + 1
  returning count;
$$;

-- Only the service role may call it.
revoke execute on function public.increment_ai_usage(text) from anon, authenticated;
