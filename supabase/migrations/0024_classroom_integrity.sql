-- 0024_classroom_integrity.sql
-- Classroom-boundary correctness (analysis/business-logic-edge-cases-plan.md
-- Phase 0 §3/§4/§6). Idempotent. ⚠ Apply BEFORE deploying the code that ships
-- with it — the client selects/writes these columns (expand → deploy → contract).

-- ── Turn-in integrity (bl-H2) ────────────────────────────────────────────────
-- When the submission was turned in; cleared on undo. Lets the teacher view
-- show a "late" marker (turned_in_at > due_at) and future trust UI compare
-- against feedback timestamps.
alter table public.houses add column if not exists turned_in_at timestamptz;

-- ── Strawman release gate (bl-H1) ────────────────────────────────────────────
-- Students used to see "Attack strawman" the moment ensure_strawman_house
-- linked the (still empty, unreviewed) house. Now nothing is visible until the
-- teacher explicitly releases; regeneration un-releases (client sets it false).
alter table public.assignments
  add column if not exists strawman_released boolean not null default false;

-- Grandfather strawmen that were already live so an in-flight class doesn't
-- lose its exercise the moment this lands.
update public.assignments
  set strawman_released = true
  where strawman_house_id is not null and strawman_released = false;

-- Students may see the strawman house only once released. (The teacher owns the
-- house, so their access rides the owner check, not this function.)
create or replace function public.can_view_assignment_strawman(hid uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1
    from public.houses h
    join public.assignments a on a.id = h.assignment_id
    where h.id = hid
      and h.is_strawman = true
      and a.strawman_released = true
      and public.is_class_member(a.class_id)
  );
$$;

-- ── Roster shows account types (bl-H5) ───────────────────────────────────────
-- The student AI clamp binds to self-selected account type; until capabilities
-- are relationship-based, the teacher at least gets to SEE that one member is
-- on a Standard account (full AI) and ask them to switch.
-- Return type changes require drop-and-recreate (CREATE OR REPLACE would fail).
drop function if exists public.get_class_roster(uuid);
create function public.get_class_roster(cid uuid)
returns table (user_id uuid, username text, email text, account_type text, joined_at timestamptz)
language sql security definer set search_path = public stable as $$
  select cm.user_id, p.username, p.email, p.account_type, cm.joined_at
  from public.class_members cm
  join public.profiles p on p.id = cm.user_id
  where cm.class_id = cid
    and public.is_class_teacher(cid)  -- empties the result for non-teachers
  order by cm.joined_at;
$$;
grant execute on function public.get_class_roster(uuid) to authenticated;
