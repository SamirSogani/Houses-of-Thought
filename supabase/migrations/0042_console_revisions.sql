-- 0042_console_revisions.sql
-- Loop A — bounded revise (plan doc
-- plans/active/reasoning-pipeline/30-console-subagent-loops.md): "that
-- answer is thin, try again but shorter" without opening a fresh chat or
-- confirming a pipeline rerun. Each iteration writes a REAL
-- house_console_messages row rather than overwriting the one before it —
-- "a loop whose inside the person cannot see is a loop they cannot check"
-- (doc 30) — so a revision has to be addressable (which turn it revises),
-- orderable (which attempt number it is), and inspectable (the critique
-- that produced it). 0040's shape could express none of the three.
--
-- revises_message_id: the row a revision replaces. ON DELETE SET NULL, never
-- CASCADE — the row being revised staying around IS the point (doc 30:
-- "earlier attempts collapse under a disclosure rather than vanishing");
-- losing the pointer some other way should orphan the child as a
-- normal-looking turn, not delete it out from under the transcript.
--
-- revision_iteration: 0 for an ordinary, never-revised answer; 1-3 for
-- successive revisions of the SAME lineage.
-- app/api/houses/[id]/console/revise/route.ts derives a new row's iteration
-- as target.revision_iteration + 1 and rejects (400) once the TARGET is
-- already at MAX_REVISE_ITERATIONS (3, lib/ai/console.ts) rather than
-- trusting the client's disabled button alone. The CHECK below enforces the
-- same cap a second time at the data layer, in case a future caller ever
-- forgets the app-level one.
--
-- critique: the critic-role verdict that produced THIS row — three of the
-- reasoning pipeline's own nine standards (clarity/relevance/depth) plus
-- synthesized rewrite guidance, ReviseCritiqueSchema in lib/ai/console.ts —
-- stored as jsonb (same convention as this table's existing actions/
-- rerun_proposal columns) so "the critique text is ... shown on expand" (doc
-- 30) has something real behind it. Null on every non-revision row.
--
-- Local dev and production SHARE one Supabase database (no separate
-- environments), so — same posture as 0041 — every statement here is
-- additive/idempotent: `add column if not exists`, a guarded
-- drop-then-add CHECK. No RLS/grant change: house_console_messages already
-- grants `select, insert` to `authenticated` with can_access_house-scoped
-- RLS covering the whole row (0040), and this migration adds no new access
-- pattern — a revision is still just an INSERT, never an UPDATE or DELETE of
-- a message row — so nothing here needs a wider grant than 0040 already has.

alter table public.house_console_messages
  add column if not exists revises_message_id uuid references public.house_console_messages (id) on delete set null;

alter table public.house_console_messages
  add column if not exists revision_iteration integer not null default 0;

alter table public.house_console_messages
  add column if not exists critique jsonb;

-- Guarded drop-then-add, same pattern 0041 uses for house_console_messages'
-- own role CHECK: safe to re-paste even once the constraint already exists.
alter table public.house_console_messages
  drop constraint if exists house_console_messages_revision_iteration_check;
alter table public.house_console_messages
  add constraint house_console_messages_revision_iteration_check
  check (revision_iteration between 0 and 3);
