-- 0015_assignments.sql
-- Assignments (plan phase 3): a teacher poses a question to a class; each student
-- gets their own house to answer it. Houses are created lazily — the first time a
-- student opens the assignment — via open_assignment(), which keeps ownership on
-- the student (RLS never lets a teacher insert a student-owned row) and handles
-- late joiners for free. Idempotent — safe to re-run.

create table if not exists public.assignments (
  id                  uuid primary key default gen_random_uuid(),
  class_id            uuid not null references public.classes (id) on delete cascade,
  question            text not null,
  -- Default 'learn' — assignments are coursework; students are Learn-pinned anyway.
  mode                text not null default 'learn' check (mode in ('learn', 'decide')),
  ai_strawman_enabled boolean not null default false,  -- wired in phase 5
  due_at              timestamptz,
  created_at          timestamptz not null default now()
);

create index if not exists assignments_class_id_idx on public.assignments (class_id);

-- Link a student's house back to its assignment. Nullable = a self-started house.
-- ON DELETE SET NULL: deleting an assignment leaves the student's work intact.
alter table public.houses
  add column if not exists assignment_id uuid references public.assignments (id) on delete set null;
create index if not exists houses_assignment_id_idx on public.houses (assignment_id);

-- ── RLS: assignments ────────────────────────────────────────────────────────
alter table public.assignments enable row level security;

-- Members (students + teacher) of the class can read its assignments.
drop policy if exists assignments_select on public.assignments;
create policy assignments_select on public.assignments
  for select using (public.is_class_member(class_id));

-- Only the teacher creates / edits / removes assignments.
drop policy if exists assignments_insert on public.assignments;
create policy assignments_insert on public.assignments
  for insert with check (public.is_class_teacher(class_id));

drop policy if exists assignments_update on public.assignments;
create policy assignments_update on public.assignments
  for update using (public.is_class_teacher(class_id)) with check (public.is_class_teacher(class_id));

drop policy if exists assignments_delete on public.assignments;
create policy assignments_delete on public.assignments
  for delete using (public.is_class_teacher(class_id));

-- ── Get-or-create the caller's submission for an assignment ─────────────────
-- SECURITY DEFINER so the seeded house is owned by the student even though this
-- validates class membership first. Returns the house id to open in the builder.
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

  -- Existing submission wins (one house per student per assignment).
  select id into hid from public.houses
  where assignment_id = aid and owner_id = auth.uid()
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

-- ── Grants ──────────────────────────────────────────────────────────────────
grant select, insert, update, delete on public.assignments to authenticated;
grant execute on function public.open_assignment(uuid) to authenticated;
