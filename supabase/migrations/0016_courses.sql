-- 0016_courses.sql
-- Courses (plan phase 4): a teacher groups a class's assignments into ordered
-- units the class works through. A course is scoped to one class (course.class_id)
-- rather than a free-floating teacher template, so its RLS reuses the class
-- helpers from 0014 and an assignment's course always lives in the same class.
-- Idempotent — safe to re-run.

create table if not exists public.courses (
  id          uuid primary key default gen_random_uuid(),
  class_id    uuid not null references public.classes (id) on delete cascade,
  title       text not null,
  description text not null default '',
  position    int  not null default 0,  -- order of the course within the class
  created_at  timestamptz not null default now()
);

create index if not exists courses_class_id_idx on public.courses (class_id);

-- Assignments may belong to a course, ordered by position within it. ON DELETE
-- SET NULL: deleting a course un-groups its assignments (they aren't lost).
alter table public.assignments
  add column if not exists course_id uuid references public.courses (id) on delete set null;
alter table public.assignments
  add column if not exists position int not null default 0;

create index if not exists assignments_course_id_idx on public.assignments (course_id);

-- ── RLS: courses ────────────────────────────────────────────────────────────
alter table public.courses enable row level security;

drop policy if exists courses_select on public.courses;
create policy courses_select on public.courses
  for select using (public.is_class_member(class_id));

drop policy if exists courses_insert on public.courses;
create policy courses_insert on public.courses
  for insert with check (public.is_class_teacher(class_id));

drop policy if exists courses_update on public.courses;
create policy courses_update on public.courses
  for update using (public.is_class_teacher(class_id)) with check (public.is_class_teacher(class_id));

drop policy if exists courses_delete on public.courses;
create policy courses_delete on public.courses
  for delete using (public.is_class_teacher(class_id));

-- Assignment reordering (position) rides the existing assignments_update policy
-- from 0015 (teacher-only) — no new policy needed.

grant select, insert, update, delete on public.courses to authenticated;
