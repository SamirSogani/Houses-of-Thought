-- 0040_house_console_messages.sql
-- Post-pipeline console (plan doc
-- plans/active/reasoning-pipeline/28-post-pipeline-console.md): a whole-house
-- chat, entered deliberately once a reasoning-pipeline run is done
-- (/build/[id]/console) — distinct from house_layer_feedback (0039), which
-- stays scoped to one layer at a time. One row per turn, same shape as
-- house_layer_feedback: the person's message and the co-pilot's reply are
-- both rows, no realtime infra (client fetches on load; a reply only ever
-- arrives as the direct result of this same client's own POST).
--
-- Two payload columns beyond house_layer_feedback's, both reflecting the
-- console's two extra capabilities (plan doc 28):
--   actions: the AiAction[] batch the reply proposed (now including the
--     remove_* kinds, lib/ai/findings.ts) — never applied automatically,
--     same click-to-accept posture as everywhere else.
--   rerun_proposal: set only when the reply thinks an earlier stage needs to
--     change — { stage, reason, guidance } — never executed automatically
--     either; the person confirms it explicitly before any pipeline step
--     actually runs (app/api/houses/[id]/reasoning's existing dispatcher,
--     resumed via the new consoleGuidance/masterReview injection, not a new
--     orchestration engine).
--
-- RLS + grant match house_layer_feedback (0039) exactly, INCLUDING the
-- `authenticated` grant in this same file — 0039 shipped without it and
-- needed a same-day follow-up migration (0040 at the time, since folded back
-- into 0039) to fix a real "permission denied for table" error; folding the
-- lesson in from the start here instead of repeating it.

create table if not exists public.house_console_messages (
  id             uuid primary key default gen_random_uuid(),
  house_id       uuid not null references public.houses (id) on delete cascade,
  role           text not null check (role in ('user', 'assistant')),
  message        text not null check (char_length(btrim(message)) > 0),
  actions        jsonb,
  rerun_proposal jsonb,
  created_by     uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now()
);

create index if not exists house_console_messages_house_idx
  on public.house_console_messages (house_id, created_at);

alter table public.house_console_messages enable row level security;

drop policy if exists house_console_messages_select on public.house_console_messages;
create policy house_console_messages_select on public.house_console_messages
  for select using (public.can_access_house(house_id));

drop policy if exists house_console_messages_insert on public.house_console_messages;
create policy house_console_messages_insert on public.house_console_messages
  for insert with check (public.can_access_house(house_id));

grant select, insert on public.house_console_messages to authenticated;
