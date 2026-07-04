-- 0002_profiles_extend.sql
-- Phase 1: extend public.profiles with the account/profile fields the /profile
-- page edits (see lib/profile/data.ts, ProfileData). Idempotent.

alter table public.profiles
  add column if not exists username        text,
  add column if not exists account_type    text  not null default 'standard',
  add column if not exists about_me         text  not null default '',
  add column if not exists current_project  text  not null default '',
  add column if not exists role             text  not null default '',
  add column if not exists location         text  not null default '',
  add column if not exists perspectives     jsonb not null
    default '{"biological":"","social":"","familial":"","individual":""}'::jsonb;

-- account_type is one of the three app roles (lib/profile/data.ts, AccountType).
-- Kept as text + CHECK (not a pg enum) so values match the TS literals exactly
-- and new roles can be added without an enum migration.
alter table public.profiles drop constraint if exists profiles_account_type_check;
alter table public.profiles add  constraint profiles_account_type_check
  check (account_type in ('standard', 'student', 'teacher'));

-- Username rule mirrors USERNAME_RE in lib/profile/data.ts (3-30 chars;
-- letters, numbers, underscore, dot, dash). Nullable: existing rows and fresh
-- signups have no username until the user sets one on the profile page.
alter table public.profiles drop constraint if exists profiles_username_check;
alter table public.profiles add  constraint profiles_username_check
  check (username is null or username ~ '^[A-Za-z0-9_.-]{3,30}$');

-- Case-insensitive uniqueness. NULLs are treated as distinct, so multiple
-- not-yet-named profiles coexist fine.
create unique index if not exists profiles_username_lower_idx
  on public.profiles (lower(username));
