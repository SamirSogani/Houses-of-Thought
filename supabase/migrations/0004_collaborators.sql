-- 0004_collaborators.sql
-- Collaboration FOUNDATION (schema + RLS only — no app feature is wired to this
-- yet). Adds a house_collaborators table and rewrites the house/child RLS to
-- honor collaborators.
--
-- Behavior-preserving today: with house_collaborators empty, can_access_house /
-- can_edit_house reduce to the existing owner-only checks, so nothing changes
-- until collaborator rows are inserted.
--
-- Roles: 'viewer' (read) and 'editor' (read + write). The owner is tracked via
-- houses.owner_id, NOT this table. Idempotent — safe to re-run.

-- ── Collaborators table ─────────────────────────────────────────────────────
create table if not exists public.house_collaborators (
  house_id   uuid not null references public.houses (id)   on delete cascade,
  user_id    uuid not null references auth.users (id)      on delete cascade,
  role       text not null default 'editor'
               check (role in ('viewer', 'editor')),
  invited_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  primary key (house_id, user_id)  -- one membership row per user per house
);

-- "Houses shared with me" lookups.
create index if not exists house_collaborators_user_id_idx
  on public.house_collaborators (user_id);

-- ── Access helpers ──────────────────────────────────────────────────────────
-- SECURITY DEFINER so these read house_collaborators/houses with RLS bypassed.
-- That is what prevents infinite recursion: the tables' own policies call these
-- functions, and the functions read the tables as the definer, not the caller.

create or replace function public.can_access_house(hid uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  select public.owns_house(hid)
      or exists (
        select 1 from public.house_collaborators
        where house_id = hid and user_id = auth.uid()
      );
$$;

create or replace function public.can_edit_house(hid uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  select public.owns_house(hid)
      or exists (
        select 1 from public.house_collaborators
        where house_id = hid and user_id = auth.uid() and role = 'editor'
      );
$$;

-- ── RLS on house_collaborators ──────────────────────────────────────────────
alter table public.house_collaborators enable row level security;

-- Read: anyone who can access the house, or your own membership row.
drop policy if exists house_collaborators_select on public.house_collaborators;
create policy house_collaborators_select on public.house_collaborators
  for select using (public.can_access_house(house_id) or user_id = auth.uid());

-- Add/change collaborators: house owner only.
drop policy if exists house_collaborators_insert on public.house_collaborators;
create policy house_collaborators_insert on public.house_collaborators
  for insert with check (public.owns_house(house_id));

drop policy if exists house_collaborators_update on public.house_collaborators;
create policy house_collaborators_update on public.house_collaborators
  for update using (public.owns_house(house_id))
  with check (public.owns_house(house_id));

-- Remove: owner can remove anyone; a collaborator can remove themselves (leave).
drop policy if exists house_collaborators_delete on public.house_collaborators;
create policy house_collaborators_delete on public.house_collaborators
  for delete using (public.owns_house(house_id) or user_id = auth.uid());

-- ── Rewrite houses RLS to honor collaborators ───────────────────────────────
-- SELECT/UPDATE widen from owner-only to access/edit checks. INSERT and DELETE
-- stay owner-only (you create your own houses; only the owner deletes one).
drop policy if exists houses_select on public.houses;
create policy houses_select on public.houses
  for select using (public.can_access_house(id));

drop policy if exists houses_update on public.houses;
create policy houses_update on public.houses
  for update using (public.can_edit_house(id))
  with check (public.can_edit_house(id));

-- (houses_insert and houses_delete are unchanged from 0003 — owner-only.)

-- ── Rewrite child-table RLS to honor collaborators ──────────────────────────
-- Read for anyone with access; write for owner + editors.
do $$
declare t text;
begin
  foreach t in array array[
    'house_perspectives', 'house_evidence', 'house_assumptions', 'house_implications'
  ]
  loop
    execute format('drop policy if exists %I_select on public.%I', t, t);
    execute format('create policy %I_select on public.%I for select using (public.can_access_house(house_id))', t, t);
    execute format('drop policy if exists %I_insert on public.%I', t, t);
    execute format('create policy %I_insert on public.%I for insert with check (public.can_edit_house(house_id))', t, t);
    execute format('drop policy if exists %I_update on public.%I', t, t);
    execute format('create policy %I_update on public.%I for update using (public.can_edit_house(house_id)) with check (public.can_edit_house(house_id))', t, t);
    execute format('drop policy if exists %I_delete on public.%I', t, t);
    execute format('create policy %I_delete on public.%I for delete using (public.can_edit_house(house_id))', t, t);
  end loop;
end $$;
