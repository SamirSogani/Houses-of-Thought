-- 0021_houses_turned_in.sql
-- "Turn in" for assignment submissions (dashboard kebab menu). A student marks
-- their submission house as turned in; the teacher sees it on the roster. Plain
-- owner-updatable column — the existing owner-only houses_update policy (0003)
-- already governs who can set it, and can_view_student_house lets the teacher
-- read it. Idempotent.

alter table public.houses
  add column if not exists turned_in boolean not null default false;
