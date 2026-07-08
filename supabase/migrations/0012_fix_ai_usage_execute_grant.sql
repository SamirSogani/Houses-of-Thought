-- 0012_fix_ai_usage_execute_grant.sql
-- SECURITY FIX for 0011. Postgres auto-grants EXECUTE on every function to PUBLIC,
-- and Supabase's `anon` / `authenticated` roles inherit it through PUBLIC. So
-- 0011's `revoke execute ... from anon, authenticated` was INEFFECTIVE — an
-- anonymous caller could still POST /rest/v1/rpc/increment_ai_usage and inflate
-- any subject's counter (a targeted rate-limit DoS + count read-back).
--
-- Fix: revoke the PUBLIC grant, then grant EXECUTE only to service_role (the app's
-- server routes). Idempotent.

revoke execute on function public.increment_ai_usage(text) from public;
revoke execute on function public.increment_ai_usage(text) from anon, authenticated;
grant  execute on function public.increment_ai_usage(text) to   service_role;
