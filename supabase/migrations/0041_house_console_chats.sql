-- 0041_house_console_chats.sql
-- Multiple chats inside the post-pipeline console (plan doc
-- plans/active/reasoning-pipeline/29-console-multi-chat.md): the console
-- (migration 0040) held exactly one implicit transcript per house — every
-- row was keyed by house_id alone. This adds house_console_chats, so a chat
-- is now a first-class row, plus the two columns house_console_messages
-- needs to belong to one: chat_id (which chat) and origin_message_id (set
-- only on a row copied by a fork, see below).
--
-- Branch = fork at a message (doc 29's confirmed decision), implemented as a
-- COPY, not a reference: forking inserts a duplicate of every message up to
-- and including the fork point into the new chat, each stamped with
-- origin_message_id pointing at the row it was copied from.
-- parent_chat_id / branched_from_message_id therefore exist ONLY for
-- provenance — rendering "branched from Chat 2" and the sidebar's one-level
-- indent — nothing reads them to reconstruct a transcript. The alternative
-- (a recursive read up parent_chat_id at GET time) was rejected: every
-- transcript read becomes a recursive CTE, and soft-deleting a parent turns
-- into a read-path problem instead of a list-path one. Copying costs
-- duplicated text rows, the cheapest thing in this schema.
--
-- deleted_at is this repo's first soft delete — no precedent table to match.
-- Delete = soft delete; a deleted chat's own children are re-parented to ITS
-- OWN parent (app/api/houses/[id]/console/chats/[chatId]/route.ts's DELETE),
-- not cascaded — "branches survive deletion."
--
-- role's CHECK widens to include 'system', for a future rerun-completion
-- marker (doc 30's Loop B, explicitly out of scope for this phase) — not
-- written by anything in this migration or this phase, just making room so
-- that follow-up doesn't need its own constraint migration.
--
-- Local dev and production SHARE one Supabase database (no separate
-- environments), so this migration runs against real data: every statement
-- is additive/idempotent (create table if not exists, add column if not
-- exists, guarded constraint drop-then-add), and the backfill below only
-- ever touches rows whose chat_id is still null, so re-pasting this file is
-- safe. chat_id stays nullable for exactly one deploy after this; a
-- follow-up migration sets it NOT NULL once every row has been backfilled.
--
-- RLS/grant posture mirrors 0039/0040 exactly (can_access_house for
-- select/insert) plus an UPDATE policy (rename, soft delete, restore) — same
-- function, no new authorization surface; the route's own authorize()
-- (owner/editor + canAuthorDraft) is the real gate, same as every other
-- console route. The `authenticated` grant ships in THIS file, not a
-- follow-up: 0029/0031/0034/0035/0037/0039 each had to fix a missing
-- base-table grant after RLS alone turned out not to be enough (0039's own
-- header tells the story) — folding the lesson in here instead of repeating
-- it a seventh time.

-- ── house_console_chats ─────────────────────────────────────────────────────
create table if not exists public.house_console_chats (
  id                        uuid primary key default gen_random_uuid(),
  house_id                  uuid not null references public.houses (id) on delete cascade,
  -- Derived from the first user message on send; renameable afterward
  -- (PATCH .../chats/[chatId]). Blank until that first message lands.
  title                     text not null default '',
  -- Provenance only — see header comment. NOT the source of this chat's
  -- transcript (fork copies rows instead).
  parent_chat_id            uuid references public.house_console_chats (id) on delete set null,
  -- Provenance only — the message a fork was taken from. Stays valid even
  -- after the source chat is later soft-deleted (a chat's own soft delete
  -- never touches its messages).
  branched_from_message_id  uuid references public.house_console_messages (id) on delete set null,
  origin                    text not null check (origin in ('root', 'fork', 'seed')),
  -- null = active. This repo's first soft delete.
  deleted_at                timestamptz,
  -- Which reasoning_runs row was current when this chat last got a reply —
  -- compared against the house's current run (getReasoningRunByHouseId) to
  -- decide the "stale" badge shown above the composer. Null until the
  -- chat's first assistant reply.
  run_id_at_last_reply      uuid references public.reasoning_runs (id) on delete set null,
  created_by                uuid references auth.users (id) on delete set null,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  last_message_at           timestamptz not null default now()
);

-- Active-chat listing + the 20-active-chats-per-house cap — the common query
-- (GET .../chats, and every cap check before an insert/restore).
create index if not exists house_console_chats_house_active_idx
  on public.house_console_chats (house_id, last_message_at)
  where deleted_at is null;

-- touch_updated_at() already exists as of 0003_houses.sql; re-declaring with
-- create-or-replace is a no-op against the shared database (which already
-- has it) and keeps this file runnable standalone against a hypothetical
-- fresh schema.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists house_console_chats_touch_updated_at on public.house_console_chats;
create trigger house_console_chats_touch_updated_at
  before update on public.house_console_chats
  for each row execute function public.touch_updated_at();

alter table public.house_console_chats enable row level security;

drop policy if exists house_console_chats_select on public.house_console_chats;
create policy house_console_chats_select on public.house_console_chats
  for select using (public.can_access_house(house_id));

drop policy if exists house_console_chats_insert on public.house_console_chats;
create policy house_console_chats_insert on public.house_console_chats
  for insert with check (public.can_access_house(house_id));

-- Rename / soft-delete / restore — same access class as insert (any
-- collaborator with standing on the house), matching 0039/0040's own choice
-- of can_access_house over the narrower can_edit_house for this kind of
-- table. Real write authorization is the route's own authorize() gate, not
-- this policy.
drop policy if exists house_console_chats_update on public.house_console_chats;
create policy house_console_chats_update on public.house_console_chats
  for update using (public.can_access_house(house_id));

grant select, insert, update on public.house_console_chats to authenticated;

-- ── house_console_messages gains chat_id + origin_message_id ───────────────
alter table public.house_console_messages
  add column if not exists chat_id uuid references public.house_console_chats (id) on delete cascade;

alter table public.house_console_messages
  add column if not exists origin_message_id uuid references public.house_console_messages (id) on delete set null;

create index if not exists house_console_messages_chat_idx
  on public.house_console_messages (chat_id, created_at);

-- role CHECK widens to include 'system' (doc 30's Loop B rerun marker — not
-- written by anything yet). Guarded drop-then-add: Postgres names an inline,
-- unnamed check constraint <table>_<column>_check by default, which is
-- exactly what 0040 shipped, so this is the real constraint's name.
alter table public.house_console_messages
  drop constraint if exists house_console_messages_role_check;
alter table public.house_console_messages
  add constraint house_console_messages_role_check check (role in ('user', 'assistant', 'system'));

-- ── Backfill: one 'root' chat per house that already has console rows ──────
-- Scoped entirely to rows whose chat_id is still null, so this is safe to
-- re-run: a second pass finds nothing left to backfill (the SELECT inside
-- the CTE returns no groups) and both statements become no-ops.
with backfilled_chats as (
  insert into public.house_console_chats (house_id, title, origin, created_at, updated_at, last_message_at)
  select house_id, '', 'root', min(created_at), now(), max(created_at)
  from public.house_console_messages
  where chat_id is null
  group by house_id
  returning id, house_id
)
update public.house_console_messages m
set chat_id = bc.id
from backfilled_chats bc
where m.house_id = bc.house_id and m.chat_id is null;
