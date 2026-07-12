-- 0014_classes.sql
-- Classrooms (plan phase 2): a teacher creates a class with a shareable join
-- code; students self-join; the teacher gets read-only visibility into each
-- student's houses.
--
-- Follows the SECURITY DEFINER access-helper pattern from 0004 (can_access_house)
-- so table policies never recurse. Idempotent — safe to re-run.

-- ── Tables ──────────────────────────────────────────────────────────────────
create table if not exists public.classes (
  id         uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  -- Short, human-shareable code. Auto-generated so the client just inserts a
  -- name; the unique constraint guards the (tiny) collision chance.
  join_code  text not null unique
               default upper(substring(md5(gen_random_uuid()::text) from 1 for 6)),
  created_at timestamptz not null default now()
);

create index if not exists classes_teacher_id_idx on public.classes (teacher_id);

create table if not exists public.class_members (
  class_id  uuid not null references public.classes (id)  on delete cascade,
  user_id   uuid not null references auth.users (id)      on delete cascade,
  role      text not null default 'student'
              check (role in ('student', 'co_teacher')),
  joined_at timestamptz not null default now(),
  primary key (class_id, user_id)  -- one membership row per user per class
);

create index if not exists class_members_user_id_idx on public.class_members (user_id);

-- ── Access helpers (SECURITY DEFINER, RLS-bypassing) ────────────────────────
create or replace function public.is_class_teacher(cid uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.classes where id = cid and teacher_id = auth.uid()
  );
$$;

create or replace function public.is_class_member(cid uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select public.is_class_teacher(cid)
      or exists (
        select 1 from public.class_members
        where class_id = cid and user_id = auth.uid()
      );
$$;

-- True when the caller is a teacher of some class the house's owner belongs to.
-- Drives the teacher's read-only visibility into student houses.
create or replace function public.can_view_student_house(hid uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1
    from public.houses h
    join public.class_members cm on cm.user_id = h.owner_id
    join public.classes c       on c.id = cm.class_id
    where h.id = hid and c.teacher_id = auth.uid()
  );
$$;

-- ── RLS: classes ────────────────────────────────────────────────────────────
alter table public.classes enable row level security;

drop policy if exists classes_select on public.classes;
create policy classes_select on public.classes
  for select using (public.is_class_member(id));

drop policy if exists classes_insert on public.classes;
create policy classes_insert on public.classes
  for insert with check (teacher_id = auth.uid());

drop policy if exists classes_update on public.classes;
create policy classes_update on public.classes
  for update using (public.is_class_teacher(id)) with check (public.is_class_teacher(id));

drop policy if exists classes_delete on public.classes;
create policy classes_delete on public.classes
  for delete using (public.is_class_teacher(id));

-- ── RLS: class_members ──────────────────────────────────────────────────────
alter table public.class_members enable row level security;

-- A teacher sees the whole roster; a member sees only their own row (keeps one
-- student from enumerating classmates — a minor-privacy default).
drop policy if exists class_members_select on public.class_members;
create policy class_members_select on public.class_members
  for select using (public.is_class_teacher(class_id) or user_id = auth.uid());

-- Direct inserts are teacher-only; student self-join goes through join_class()
-- (SECURITY DEFINER), so this policy stays tight.
drop policy if exists class_members_insert on public.class_members;
create policy class_members_insert on public.class_members
  for insert with check (public.is_class_teacher(class_id));

drop policy if exists class_members_update on public.class_members;
create policy class_members_update on public.class_members
  for update using (public.is_class_teacher(class_id)) with check (public.is_class_teacher(class_id));

-- Teacher removes anyone; a student can remove themselves (leave a class).
drop policy if exists class_members_delete on public.class_members;
create policy class_members_delete on public.class_members
  for delete using (public.is_class_teacher(class_id) or user_id = auth.uid());

-- ── Widen houses SELECT for teacher read-only visibility ────────────────────
-- Read-only by design: only SELECT is widened. UPDATE/INSERT/DELETE stay on the
-- owner + editor checks from 0004, so a teacher can view but never edit a
-- student's house. (Chosen over minting house_collaborators rows so visibility
-- stays correct automatically as students create houses — no triggers/backfill.)
--
-- ⚠ SUPERSEDED by 0020: can_access_house(id) self-queries houses (via owns_house)
-- and that breaks INSERT ... RETURNING (decision 004). 0020 replaces this policy
-- with a direct `owner_id = auth.uid()` check. Do not copy the version below.
drop policy if exists houses_select on public.houses;
create policy houses_select on public.houses
  for select using (public.can_access_house(id) or public.can_view_student_house(id));

do $$
declare t text;
begin
  foreach t in array array[
    'house_perspectives', 'house_evidence', 'house_assumptions', 'house_implications'
  ]
  loop
    execute format('drop policy if exists %I_select on public.%I', t, t);
    execute format(
      'create policy %I_select on public.%I for select using (public.can_access_house(house_id) or public.can_view_student_house(house_id))',
      t, t
    );
  end loop;
end $$;

-- ── Student self-join (bypasses the tight member-insert policy) ──────────────
create or replace function public.join_class(code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  select id into cid from public.classes where join_code = upper(code);
  if cid is null then
    raise exception 'class-not-found' using errcode = 'no_data_found';
  end if;
  -- The class's own teacher isn't enrolled as a student; just hand back the id.
  if exists (select 1 from public.classes where id = cid and teacher_id = auth.uid()) then
    return cid;
  end if;
  insert into public.class_members (class_id, user_id, role)
  values (cid, auth.uid(), 'student')
  on conflict (class_id, user_id) do nothing;
  return cid;
end;
$$;

-- ── Teacher roster read (teacher can't SELECT student profiles directly) ─────
create or replace function public.get_class_roster(cid uuid)
returns table (user_id uuid, username text, email text, joined_at timestamptz)
language sql security definer set search_path = public stable as $$
  select cm.user_id, p.username, p.email, cm.joined_at
  from public.class_members cm
  join public.profiles p on p.id = cm.user_id
  where cm.class_id = cid
    and public.is_class_teacher(cid)  -- empties the result for non-teachers
  order by cm.joined_at;
$$;

-- ── Grants ──────────────────────────────────────────────────────────────────
grant select, insert, update, delete on public.classes       to authenticated;
grant select, insert, update, delete on public.class_members to authenticated;
grant execute on function public.join_class(text)      to authenticated;
grant execute on function public.get_class_roster(uuid) to authenticated;
