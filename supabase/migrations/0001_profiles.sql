-- 0001_profiles.sql
-- Backfill of the profiles table, signup trigger, and RLS that were originally
-- applied by hand in the Supabase SQL editor (see
-- context/architecture/tech-stack.md, "Auth UI status").
--
-- Reconstructed from the documented schema, NOT dumped from the live database.
-- Diff this against the live DB before treating it as authoritative. Written
-- idempotently so re-running is safe.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- A user can read their own profile row.
drop policy if exists "Profiles are viewable by owner" on public.profiles;
create policy "Profiles are viewable by owner"
  on public.profiles for select
  using (auth.uid() = id);

-- A user can update their own profile row.
drop policy if exists "Profiles are updatable by owner" on public.profiles;
create policy "Profiles are updatable by owner"
  on public.profiles for update
  using (auth.uid() = id);

-- Mirror new auth.users into public.profiles on signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
