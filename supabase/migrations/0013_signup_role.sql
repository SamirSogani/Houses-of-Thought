-- 0013_signup_role.sql
-- Capture the account type chosen at signup. The login form passes account_type
-- in the Supabase signUp metadata (options.data.account_type); this teaches the
-- signup trigger to read it. See plan phase 1 and lib/auth/capabilities.ts.
--
-- NOTE (verified in E2E testing): this trigger is a best-effort DEFAULT, not the
-- source of truth. GoTrue can create the auth.users row before raw_user_meta_data
-- is populated, so this reads it as absent and falls back to 'standard'. The
-- authoritative write is client-side in app/login/page.tsx, which sets
-- account_type on the profile right after signup (when it has a session). Do not
-- rely on this trigger alone for the role.
--
-- Idempotent: only redefines the function (create or replace). The
-- on_auth_user_created trigger from 0001 is unchanged and keeps pointing here.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, account_type)
  values (
    new.id,
    new.email,
    -- Only trust a value that satisfies the profiles.account_type CHECK
    -- constraint (see 0002); anything else falls back to 'standard' so a
    -- malformed metadata value can never fail the insert or widen access.
    case
      when new.raw_user_meta_data ->> 'account_type' in ('standard', 'student', 'teacher')
        then new.raw_user_meta_data ->> 'account_type'
      else 'standard'
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
