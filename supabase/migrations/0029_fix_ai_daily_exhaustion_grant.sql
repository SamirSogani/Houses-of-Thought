-- 0029_fix_ai_daily_exhaustion_grant.sql
-- FUNCTIONALITY FIX for 0028. RLS enabled with no policies denies row access
-- to everyone except a role with BYPASSRLS — but Postgres still requires an
-- explicit table-level GRANT independent of RLS, and this project's Supabase
-- instance does not auto-grant that to service_role for newly created
-- tables (same root cause as 0005's houses-tables fix and 0012's ai_usage
-- EXECUTE fix — this is the third time this exact class of bug has hit this
-- project). Confirmed live: markDailyExhausted's persist write failed with
-- "permission denied for table ai_daily_exhaustion" the first time a real
-- Groq daily-quota exhaustion actually occurred after 0028 shipped — caught
-- non-fatally (lib/ai/router-state.ts's fire-and-forget write just logs and
-- moves on), so no run ever broke, but the cross-restart persistence 0028
-- exists for silently never wrote a row.
--
-- Fix: grant exactly what lib/ai/router-state.ts uses (select for hydration,
-- insert for the upsert-with-ignoreDuplicates write — no update, since
-- ignoreDuplicates never issues one) to service_role only. Idempotent.

grant select, insert on public.ai_daily_exhaustion to service_role;
