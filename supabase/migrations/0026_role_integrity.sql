-- 0026_role_integrity.sql
-- Close the two broken-access-control findings that let the client decide who is
-- a teacher (security audit C1 + H1). Idempotent. ⚠ Apply BEFORE deploying the
-- code that ships with it: app/login/page.tsx switches from a direct
-- account_type UPDATE to the reconcile_signup_role() RPC below, and the profile
-- page stops writing account_type at all.
--
-- The model this enforces:
--   • account_type is chosen ONCE, at signup, and is then IMMUTABLE to the
--     client. There is no self-service role change anymore — a student account
--     can no longer promote itself to teacher by editing its own profile row
--     (audit C1: the UPDATE policy had no WITH CHECK, so RLS allowed it).
--   • "Who may create a class" is enforced at the DATA layer, not just the UI:
--     classes_insert now also requires public.is_teacher() (audit H1).
--   • Legitimate role changes are an out-of-band/admin action (a direct DB
--     UPDATE by service_role), exactly as the audit recommends.

-- ── Role helpers (SECURITY DEFINER, RLS-bypassing, stable) ───────────────────

-- The caller's currently-stored account_type. Used by the profiles WITH CHECK
-- to pin the column: a SELECT here sees the pre-UPDATE value (READ COMMITTED),
-- so "new.account_type = current_account_type()" means "unchanged".
create or replace function public.current_account_type()
returns text language sql security definer set search_path = public stable as $$
  select account_type from public.profiles where id = auth.uid();
$$;

-- True when the caller's account_type is 'teacher'. The DB-level source of truth
-- for teacher capability, replacing the UI-only check in app/classroom/page.tsx.
create or replace function public.is_teacher()
returns boolean language sql security definer set search_path = public stable as $$
  select coalesce(
    (select account_type = 'teacher' from public.profiles where id = auth.uid()),
    false
  );
$$;

grant execute on function public.current_account_type() to authenticated;
grant execute on function public.is_teacher() to authenticated;

-- ── Pin account_type: self-updates allowed, role changes are not ─────────────
-- The 0001 UPDATE policy had only `using (auth.uid() = id)` and no WITH CHECK,
-- so the owner could PATCH any column — including account_type — to any value.
-- Re-create it with a WITH CHECK that forbids changing account_type. Every other
-- profile field (username, about_me, perspectives, …) still updates freely.
drop policy if exists "Profiles are updatable by owner" on public.profiles;
create policy "Profiles are updatable by owner"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id and account_type = public.current_account_type());

-- ── One-time signup reconciliation ───────────────────────────────────────────
-- The signup trigger (0013) sets account_type from signup metadata, but its own
-- note records that GoTrue timing can leave the metadata unread, falling back to
-- 'standard'. The client used to fix that with a direct UPDATE — which the pin
-- above now blocks. This RPC is the replacement: it promotes the fresh account
-- to the role chosen at signup, and ONLY then:
--   • only from 'standard' (the trigger's fallback) — a 'student' can never use
--     it to reach 'teacher', which is the whole point of C1;
--   • only within 10 minutes of the profile being created — an established
--     'standard' user cannot call it later to self-escalate.
-- Setting the same value the trigger already stored is a harmless no-op (the
-- 'standard' guard just doesn't match for teacher/student rows).
create or replace function public.reconcile_signup_role(p_type text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_type not in ('standard', 'student', 'teacher') then
    raise exception 'invalid account_type: %', p_type;
  end if;
  update public.profiles
     set account_type = p_type
   where id = auth.uid()
     and account_type = 'standard'
     and created_at > now() - interval '10 minutes';
end;
$$;
grant execute on function public.reconcile_signup_role(text) to authenticated;

-- ── Gate class creation on teacher role (audit H1) ───────────────────────────
-- Was `with check (teacher_id = auth.uid())` — any authenticated user could
-- insert a class and become its teacher. Now the DB also requires the caller to
-- actually be a teacher. (Only meaningful once account_type is trustworthy,
-- which the pin above establishes.)
drop policy if exists classes_insert on public.classes;
create policy classes_insert on public.classes
  for insert with check (teacher_id = auth.uid() and public.is_teacher());
