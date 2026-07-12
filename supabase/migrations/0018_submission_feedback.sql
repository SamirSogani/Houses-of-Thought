-- 0018_submission_feedback.sql
-- Teacher assessment (plan phase 6): a teacher records written feedback and an
-- optional grade on a student's submission, and the student sees it on their own
-- house. Kept in a separate table (not columns on houses) so teachers never gain
-- write access to a student's house content — they can only touch this row.
-- Idempotent — safe to re-run.

create table if not exists public.submission_feedback (
  house_id   uuid primary key references public.houses (id) on delete cascade,
  teacher_id uuid not null references auth.users (id),
  feedback   text not null default '',
  grade      text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.submission_feedback enable row level security;

-- Read: the house's owner (student) sees their feedback; a teacher who can view
-- the student's house (can_view_student_house, 0014) sees it too.
drop policy if exists submission_feedback_select on public.submission_feedback;
create policy submission_feedback_select on public.submission_feedback
  for select using (public.owns_house(house_id) or public.can_view_student_house(house_id));

-- Write: only a teacher of the student's class, recording under their own id.
drop policy if exists submission_feedback_insert on public.submission_feedback;
create policy submission_feedback_insert on public.submission_feedback
  for insert with check (public.can_view_student_house(house_id) and teacher_id = auth.uid());

drop policy if exists submission_feedback_update on public.submission_feedback;
create policy submission_feedback_update on public.submission_feedback
  for update using (public.can_view_student_house(house_id)) with check (public.can_view_student_house(house_id));

drop policy if exists submission_feedback_delete on public.submission_feedback;
create policy submission_feedback_delete on public.submission_feedback
  for delete using (public.can_view_student_house(house_id));

grant select, insert, update, delete on public.submission_feedback to authenticated;
