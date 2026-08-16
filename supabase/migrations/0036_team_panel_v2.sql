-- 0036_team_panel_v2.sql
-- Team panel v2 (plans/active/persistence/team-panel-v2.md): presence,
-- house-scoped direct messages, and a team/collaboration activity log. Three
-- new tables, all RLS-scoped to can_access_house (0004) for reads, matching
-- every existing house-scoped table. Idempotent.

-- ── Presence ─────────────────────────────────────────────────────────────
-- Covers the owner and every collaborator uniformly (not folded into
-- house_collaborators, since presence isn't a role and applies to the owner
-- too, who has no row there). One row per (house, user); TeamPanel upserts
-- its own row on mount and every ~60s while open — see module comment in
-- components/build/rail/TeamPanel.tsx.
create table if not exists public.house_presence (
  house_id     uuid not null references public.houses (id)  on delete cascade,
  user_id      uuid not null references auth.users (id)     on delete cascade,
  last_seen_at timestamptz not null default now(),
  primary key (house_id, user_id)
);

alter table public.house_presence enable row level security;

drop policy if exists house_presence_select on public.house_presence;
create policy house_presence_select on public.house_presence
  for select using (public.can_access_house(house_id));

-- Self-only upsert: a user may ping only their OWN presence row, and only on
-- a house they actually have standing on.
drop policy if exists house_presence_insert on public.house_presence;
create policy house_presence_insert on public.house_presence
  for insert with check (user_id = auth.uid() and public.can_access_house(house_id));

drop policy if exists house_presence_update on public.house_presence;
create policy house_presence_update on public.house_presence
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.can_access_house(house_id));

-- ── Direct messages ──────────────────────────────────────────────────────
-- House-scoped, not a general cross-house inbox (explicit scope line). Simple
-- send + poll-based list — no realtime infra anywhere in this codebase.
create table if not exists public.house_direct_messages (
  id           uuid primary key default gen_random_uuid(),
  house_id     uuid not null references public.houses (id)  on delete cascade,
  -- Identity columns (who the row is ABOUT), not pure attribution — cascade,
  -- same as house_collaborators.user_id (0004): a message is meaningless once
  -- either party's account is gone, rather than an orphaned row blocking that
  -- account's deletion the way a plain "invited_by"-style column would.
  sender_id    uuid not null references auth.users (id) on delete cascade,
  recipient_id uuid not null references auth.users (id) on delete cascade,
  body         text not null check (char_length(btrim(body)) > 0),
  created_at   timestamptz not null default now(),
  check (sender_id <> recipient_id)
);

create index if not exists house_direct_messages_house_id_idx
  on public.house_direct_messages (house_id, created_at);

-- Reused by the insert policy below to check the RECIPIENT side (the sender
-- side is already covered by can_access_house + sender_id = auth.uid()).
create or replace function public.has_house_standing(hid uuid, uid uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists (select 1 from public.houses where id = hid and owner_id = uid)
      or exists (select 1 from public.house_collaborators where house_id = hid and user_id = uid);
$$;

alter table public.house_direct_messages enable row level security;

-- Sender/recipient only — NOT can_access_house. A DM is a private 1:1 thread;
-- unlike the roster, activity log, or presence (legitimately visible to
-- every collaborator), a third teammate having house access is not consent
-- to read someone else's private messages on that house. (Caught in review,
-- 2026-08-16: the plan doc's blanket "match can_access_house on every new
-- table" instruction was right for the other two tables and wrong for this
-- one — flagging the correction here rather than silently narrowing it.)
drop policy if exists house_direct_messages_select on public.house_direct_messages;
create policy house_direct_messages_select on public.house_direct_messages
  for select using (sender_id = auth.uid() or recipient_id = auth.uid());

drop policy if exists house_direct_messages_insert on public.house_direct_messages;
create policy house_direct_messages_insert on public.house_direct_messages
  for insert with check (
    sender_id = auth.uid()
    and public.can_access_house(house_id)
    and public.has_house_standing(house_id, recipient_id)
  );

-- ── Activity log ─────────────────────────────────────────────────────────
-- Team/collaboration events only (invited, removed, left, role changed, share
-- link created/revoked, message sent) — NOT a full content-edit history of
-- house fields, which is a separable, bigger feature if wanted later.
-- Populated by triggers below (house_collaborators, house_direct_messages)
-- plus one explicit insert from app/api/share-link/route.ts (not a natural
-- trigger hook, since houses.share_token is a plain column on a table with no
-- other reason to fire a house_activity row on every update).
create table if not exists public.house_activity (
  id         uuid primary key default gen_random_uuid(),
  house_id   uuid not null references public.houses (id) on delete cascade,
  actor_id   uuid references auth.users (id),
  kind       text not null,
  detail     jsonb,
  created_at timestamptz not null default now()
);

create index if not exists house_activity_house_id_idx
  on public.house_activity (house_id, created_at desc);

alter table public.house_activity enable row level security;

drop policy if exists house_activity_select on public.house_activity;
create policy house_activity_select on public.house_activity
  for select using (public.can_access_house(house_id));

-- No insert/update/delete policy for anon/authenticated at all: only the
-- SECURITY DEFINER trigger functions below (which run as the table owner and
-- so bypass RLS entirely — the same mechanism 0004's can_access_house itself
-- relies on to read house_collaborators without recursing) and the
-- share-link route (service_role, granted explicitly below) ever write here.
-- This project's Supabase instance does not auto-grant new tables to
-- service_role (0035's own finding) — granting proactively now rather than
-- waiting to hit a live "permission denied" error the way v1 did twice.
grant select, insert on public.house_activity to service_role;

-- ── Triggers: house_collaborators → house_activity ──────────────────────
create or replace function public.log_collaborator_activity()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.house_activity (house_id, actor_id, kind, detail)
    values (new.house_id, auth.uid(), 'invited',
            jsonb_build_object('user_id', new.user_id, 'role', new.role));
    return new;
  elsif tg_op = 'UPDATE' then
    if new.role is distinct from old.role then
      insert into public.house_activity (house_id, actor_id, kind, detail)
      values (new.house_id, auth.uid(), 'role_changed',
              jsonb_build_object('user_id', new.user_id, 'old_role', old.role, 'new_role', new.role));
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    -- Cascade-delete guard: a house delete (houses_delete, owner-only) cascades
    -- to this row too (house_collaborators.house_id references houses(id) on
    -- delete cascade) — but the houses row is already gone BEFORE that cascade
    -- fires, so an activity insert referencing it here would violate
    -- house_activity's own FK and abort the house deletion entirely. Skip
    -- logging when the house no longer exists; a plain removal/leave (house
    -- still exists) is unaffected and logs as before.
    if not exists (select 1 from public.houses where id = old.house_id) then
      return old;
    end if;
    insert into public.house_activity (house_id, actor_id, kind, detail)
    values (
      old.house_id,
      auth.uid(),
      case when auth.uid() = old.user_id then 'left' else 'removed' end,
      jsonb_build_object('user_id', old.user_id, 'role', old.role)
    );
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists house_collaborators_activity on public.house_collaborators;
create trigger house_collaborators_activity
  after insert or update or delete on public.house_collaborators
  for each row execute function public.log_collaborator_activity();

-- ── Trigger: house_direct_messages → house_activity ─────────────────────
create or replace function public.log_message_activity()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.house_activity (house_id, actor_id, kind, detail)
  values (new.house_id, new.sender_id, 'message_sent',
          jsonb_build_object('recipient_id', new.recipient_id));
  return new;
end;
$$;

drop trigger if exists house_direct_messages_activity on public.house_direct_messages;
create trigger house_direct_messages_activity
  after insert on public.house_direct_messages
  for each row execute function public.log_message_activity();
