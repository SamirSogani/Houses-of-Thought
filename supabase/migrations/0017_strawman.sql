-- 0017_strawman.sql
-- "Attack the strawman" (plan phase 5, teacher-authored model): when a teacher
-- enables an assignment's strawman, the teacher generates ONE flawed argument
-- (tuned to a grade level / age / extra topics / free-text criteria), reviews and
-- revises it, then releases it. Every student in the class attacks that same
-- teacher-owned house. Idempotent — safe to re-run.

-- The strawman house holds the AI-written flawed argument. One per assignment,
-- owned by the teacher (so they can revise it); students get read-only access.
alter table public.houses
  add column if not exists is_strawman boolean not null default false;

-- Strawman authoring lives on the assignment: a link to its strawman house plus
-- the generation parameters the teacher sets before generating.
alter table public.assignments
  add column if not exists strawman_house_id   uuid references public.houses (id) on delete set null,
  add column if not exists strawman_grade_level text not null default '',
  add column if not exists strawman_age         text not null default '',
  add column if not exists strawman_topics      text not null default '',  -- extra topics to cover
  add column if not exists strawman_criteria    text not null default '';  -- free-text guidance

-- Redefine open_assignment (from 0015) to ignore strawman houses, so a student's
-- submission and the assignment's strawman never collide.
create or replace function public.open_assignment(aid uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  hid  uuid;
  acid uuid;
  aq   text;
  am   text;
begin
  select class_id, question, mode into acid, aq, am
  from public.assignments where id = aid;
  if acid is null then
    raise exception 'assignment-not-found' using errcode = 'no_data_found';
  end if;
  if not public.is_class_member(acid) then
    raise exception 'not-a-member' using errcode = 'insufficient_privilege';
  end if;

  select id into hid from public.houses
  where assignment_id = aid and owner_id = auth.uid() and is_strawman = false
  limit 1;
  if hid is not null then
    return hid;
  end if;

  insert into public.houses (owner_id, assignment_id, question, mode)
  values (auth.uid(), aid, aq, am)
  returning id into hid;
  return hid;
end;
$$;

-- Teacher-only: get-or-create the assignment's strawman house and link it. The
-- teacher owns it, so afterward they open it in the builder to review/revise (and
-- the client fills it with the generated content). Returns the house id.
create or replace function public.ensure_strawman_house(aid uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  hid     uuid;
  acid    uuid;
  aq      text;
  enabled boolean;
begin
  select class_id, question, ai_strawman_enabled, strawman_house_id
    into acid, aq, enabled, hid
  from public.assignments where id = aid;
  if acid is null then
    raise exception 'assignment-not-found' using errcode = 'no_data_found';
  end if;
  if not public.is_class_teacher(acid) then
    raise exception 'not-teacher' using errcode = 'insufficient_privilege';
  end if;
  if not coalesce(enabled, false) then
    raise exception 'strawman-not-enabled' using errcode = 'check_violation';
  end if;
  if hid is not null then
    return hid;
  end if;

  insert into public.houses (owner_id, assignment_id, question, mode, is_strawman)
  values (auth.uid(), aid, aq, 'learn', true)
  returning id into hid;
  update public.assignments set strawman_house_id = hid where id = aid;
  return hid;
end;
$$;

-- Read access for students to the strawman house of an assignment in their class
-- (they attack it, never edit it). SECURITY DEFINER to avoid RLS recursion.
create or replace function public.can_view_assignment_strawman(hid uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1
    from public.houses h
    join public.assignments a on a.id = h.assignment_id
    where h.id = hid and h.is_strawman = true and public.is_class_member(a.class_id)
  );
$$;

-- Widen houses + child SELECT to include strawman visibility (read-only: only
-- SELECT is touched; the teacher edits as owner, students cannot).
--
-- ⚠ The houses_select below is SUPERSEDED by 0020 (it leads with can_access_house,
-- which self-queries houses and breaks INSERT ... RETURNING — decision 004). The
-- child-table selects here are fine: they authorize via the parent house, never
-- the child row being inserted.
drop policy if exists houses_select on public.houses;
create policy houses_select on public.houses
  for select using (
    public.can_access_house(id)
    or public.can_view_student_house(id)
    or public.can_view_assignment_strawman(id)
  );

do $$
declare t text;
begin
  foreach t in array array[
    'house_perspectives', 'house_evidence', 'house_assumptions', 'house_implications'
  ]
  loop
    execute format('drop policy if exists %I_select on public.%I', t, t);
    execute format(
      'create policy %I_select on public.%I for select using (public.can_access_house(house_id) or public.can_view_student_house(house_id) or public.can_view_assignment_strawman(house_id))',
      t, t
    );
  end loop;
end $$;

grant execute on function public.ensure_strawman_house(uuid) to authenticated;
