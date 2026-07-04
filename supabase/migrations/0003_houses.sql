-- 0003_houses.sql
-- Phase 1: the normalized house schema (single-owner scope) and its RLS.
-- Parent `houses` row + one child table per repeatable layer. Field names and
-- value sets track lib/build/types.ts and lib/dashboard/houses.ts. Idempotent.

-- ── Parent ────────────────────────────────────────────────────────────────
create table if not exists public.houses (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references auth.users (id) on delete cascade,
  title           text,          -- null = untitled
  question        text,          -- null = no question set yet
  status          text not null default 'empty'
                    check (status in ('empty', 'in-progress', 'complete')),
  layers_complete int  not null default 0 check (layers_complete between 0 and 7),
  concepts        text[] not null default '{}',  -- Frame layer: ordered strings
  watchpoints     text[] not null default '{}',  -- ordered strings, no attributes
  accepted        jsonb  not null default '{}'::jsonb,  -- accepted-suggestion map
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists houses_owner_id_idx on public.houses (owner_id);

-- Bump updated_at on any direct update to a house row. Note: writes to child
-- tables do NOT touch the parent — the app is responsible for bumping the
-- parent's updated_at when it saves child content (drives "Edited …" labels).
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists houses_touch_updated_at on public.houses;
create trigger houses_touch_updated_at
  before update on public.houses
  for each row execute function public.touch_updated_at();

-- owner_key is cosmetic attribution for now (single-owner scope); it maps to
-- real collaborator user ids when the collaborators milestone lands.
-- Values: lib/build/types.ts PersonKey.

-- ── Children ──────────────────────────────────────────────────────────────
create table if not exists public.house_perspectives (
  id        uuid primary key default gen_random_uuid(),
  house_id  uuid not null references public.houses (id) on delete cascade,
  name      text not null,
  summary   text,
  questions int  not null default 0,
  strength  int  not null default 0 check (strength between 0 and 100),
  owner_key text not null default 'you'
              check (owner_key in ('you', 'maya', 'devan', 'ai')),
  position  int  not null default 0
);

create table if not exists public.house_evidence (
  id        uuid primary key default gen_random_uuid(),
  house_id  uuid not null references public.houses (id) on delete cascade,
  text      text not null,
  source    text,
  owner_key text not null default 'you'
              check (owner_key in ('you', 'maya', 'devan', 'ai')),
  by_ai     boolean not null default false,
  position  int  not null default 0
);

create table if not exists public.house_assumptions (
  id        uuid primary key default gen_random_uuid(),
  house_id  uuid not null references public.houses (id) on delete cascade,
  text      text not null,
  owner_key text not null default 'you'
              check (owner_key in ('you', 'maya', 'devan', 'ai')),
  position  int  not null default 0
);

create table if not exists public.house_implications (
  id        uuid primary key default gen_random_uuid(),
  house_id  uuid not null references public.houses (id) on delete cascade,
  kind      text not null check (kind in ('pos', 'neg', 'unc')),
  text      text not null,
  horizon   text check (horizon in ('Near-term', 'Long-term')),
  who       text,
  position  int  not null default 0
);

create index if not exists house_perspectives_house_id_idx on public.house_perspectives (house_id);
create index if not exists house_evidence_house_id_idx     on public.house_evidence (house_id);
create index if not exists house_assumptions_house_id_idx  on public.house_assumptions (house_id);
create index if not exists house_implications_house_id_idx on public.house_implications (house_id);

-- ── RLS ───────────────────────────────────────────────────────────────────
alter table public.houses             enable row level security;
alter table public.house_perspectives enable row level security;
alter table public.house_evidence     enable row level security;
alter table public.house_assumptions  enable row level security;
alter table public.house_implications enable row level security;

-- Ownership check reused by every child policy.
create or replace function public.owns_house(hid uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.houses
    where id = hid and owner_id = auth.uid()
  );
$$;

-- Parent: full CRUD for the owner only.
drop policy if exists houses_select on public.houses;
create policy houses_select on public.houses for select using (auth.uid() = owner_id);
drop policy if exists houses_insert on public.houses;
create policy houses_insert on public.houses for insert with check (auth.uid() = owner_id);
drop policy if exists houses_update on public.houses;
create policy houses_update on public.houses for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
drop policy if exists houses_delete on public.houses;
create policy houses_delete on public.houses for delete using (auth.uid() = owner_id);

-- Children: access flows through ownership of the parent house.
do $$
declare t text;
begin
  foreach t in array array[
    'house_perspectives', 'house_evidence', 'house_assumptions', 'house_implications'
  ]
  loop
    execute format('drop policy if exists %I_select on public.%I', t, t);
    execute format('create policy %I_select on public.%I for select using (public.owns_house(house_id))', t, t);
    execute format('drop policy if exists %I_insert on public.%I', t, t);
    execute format('create policy %I_insert on public.%I for insert with check (public.owns_house(house_id))', t, t);
    execute format('drop policy if exists %I_update on public.%I', t, t);
    execute format('create policy %I_update on public.%I for update using (public.owns_house(house_id)) with check (public.owns_house(house_id))', t, t);
    execute format('drop policy if exists %I_delete on public.%I', t, t);
    execute format('create policy %I_delete on public.%I for delete using (public.owns_house(house_id))', t, t);
  end loop;
end $$;
