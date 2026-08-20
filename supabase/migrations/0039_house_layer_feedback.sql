-- 0039_house_layer_feedback.sql
-- Post-draft Q&A/correction thread: after a layer has been drafted (Draft
-- Mode or the reasoning pipeline — both seed the same state.draft/DRAFT_STAGES
-- shape, lib/ai/draft.ts), the person can ask the co-pilot a question about it
-- or point out a mistake / missing context, right where they're reviewing it
-- (components/build/LayerFeedbackThread.tsx, wired into DraftClaimBanner).
-- One row per turn (both the person's message and the co-pilot's reply are
-- rows), so the thread is a plain ordered list — same "no realtime infra"
-- posture as house_direct_messages (0036): the client fetches on expand, no
-- polling needed since a reply only ever arrives as the direct result of this
-- same client's own POST.
--
-- RLS matches every other house-scoped table's read (can_access_house, 0004):
-- any collaborator with standing on the house can see what was asked about a
-- drafted layer, same visibility as house_activity. Unlike house_direct_messages
-- this is not a private 1:1 — it's commentary on the house's own content.
--
-- Both the human turn and the AI's reply are inserted by the SAME request
-- (app/api/houses/[id]/layer-feedback/route.ts), under the caller's own
-- session (not service role, unlike house_activity's triggers) — same class
-- of table as house_presence/house_direct_messages (0036/0037), which is why
-- this file also grants the table itself to `authenticated` below: RLS
-- policies alone never grant base table access (the same gap 0029, 0031,
-- 0034, 0035, and 0037 each had to fix separately after the fact). Confirmed
-- live as a real "permission denied for table house_layer_feedback" (42501)
-- error the first version of this file shipped without the grant — folded
-- in here so a fresh apply gets it right in one paste; there is no
-- table-and-grant split for this feature anymore.

create table if not exists public.house_layer_feedback (
  id         uuid primary key default gen_random_uuid(),
  house_id   uuid not null references public.houses (id) on delete cascade,
  -- DRAFT_STAGES (lib/ai/draft.ts) — not enforced as a foreign key (there is no
  -- stages table), just a value check.
  stage      text not null check (stage in ('concepts', 'perspectives', 'evidence', 'assumptions', 'implications')),
  role       text not null check (role in ('user', 'assistant')),
  message    text not null check (char_length(btrim(message)) > 0),
  -- The AiAction batch the co-pilot proposed with this reply (lib/ai/findings.ts
  -- AiActionSchema), null on every 'user' row and on an 'assistant' row that
  -- proposed nothing. Never applied automatically — see route + component.
  actions    jsonb,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists house_layer_feedback_house_stage_idx
  on public.house_layer_feedback (house_id, stage, created_at);

alter table public.house_layer_feedback enable row level security;

drop policy if exists house_layer_feedback_select on public.house_layer_feedback;
create policy house_layer_feedback_select on public.house_layer_feedback
  for select using (public.can_access_house(house_id));

drop policy if exists house_layer_feedback_insert on public.house_layer_feedback;
create policy house_layer_feedback_insert on public.house_layer_feedback
  for insert with check (public.can_access_house(house_id));

-- Base-table grant (see header comment) — matches exactly what the policies
-- above permit: select, insert, nothing else. GRANT is inherently
-- re-runnable, so re-pasting this whole file on a database that already has
-- the table (but not this line) is safe and is exactly the fix.
grant select, insert on public.house_layer_feedback to authenticated;
