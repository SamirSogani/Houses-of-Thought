-- 0043_reasoning_runs_candidate.sql
-- Loop C — sandbox reruns with a diff (plan doc
-- plans/active/reasoning-pipeline/31-console-sandbox-reruns.md). Today
-- getReasoningRunByHouseId just takes the most-recently-updated
-- reasoning_runs row for a house_id, so a rerun into a "candidate" — writing
-- nothing to the house, offered for promote/discard — would silently become
-- "the" run for every existing reader (the console's rerun-confirm starting
-- point, the "stale chat" badge, every bookkeeping write). These five
-- columns give a candidate row an explicit marker so it can be excluded
-- everywhere that matters, and addressed (which chat, which stage, what to
-- diff against) everywhere Loop C's own UI needs it.
--
-- No RLS/grant change: reasoning_runs has been deny-all RLS with NO grant to
-- `authenticated` since 0030/0031 — every read and write goes through
-- lib/ai/reasoning/persistence.ts's service-role client, and that stays true
-- for every function this migration's columns enable. A candidate row is
-- just another jsonb-adjacent set of columns on an already fully-locked-down
-- table, not a new access path.
--
-- Local dev and production SHARE one Supabase database (no separate
-- environments) — same posture as 0038/0041/0042: every statement here is
-- additive/idempotent (`add column if not exists`, a guarded drop-then-add
-- CHECK, `create ... if not exists`), safe to re-run.
--
-- THIS MIGRATION IS UNAPPLIED. Per this task's own hard prohibition, nothing
-- here has been run against the shared dev/production database — this file
-- is written only. Apply it deliberately, the same way 0040/0041/0042 were
-- applied, before Loop C's routes are exercised against real data.

alter table public.reasoning_runs
  add column if not exists is_candidate boolean not null default false;

-- Provenance/addressability only (doc 31's "which chat owns a candidate") —
-- the diff card renders in this chat and nowhere else. ON DELETE SET NULL,
-- not CASCADE: a chat getting soft-deleted (house_console_chats.deleted_at)
-- doesn't touch this row at all (soft delete, not a real delete), and even a
-- hard delete of the chat should leave the run row itself alone — it is
-- still a real, billed pipeline run and a discard/promote decision may still
-- be pending.
alter table public.reasoning_runs
  add column if not exists candidate_chat_id uuid references public.house_console_chats (id) on delete set null;

-- The DraftStage the rerun proposal targeted (lib/ai/draft.ts's
-- DRAFT_STAGES) — stored as plain text rather than referencing a DB enum
-- (this app has none for DraftStage; the Zod enum in lib/ai/console.ts is
-- the single source of truth, same posture as every other stage-name column
-- in this schema). Needed to recompute cascadeStages() at diff/promote time
-- without re-deriving it from run_state.
alter table public.reasoning_runs
  add column if not exists candidate_stage text;

-- serializeContent(state) (lib/build/persistence.ts) at the moment the
-- sandbox run STARTED — the diff/staleness baseline. Compared against a
-- fresh serializeContent() at render/promote time: unequal means the house
-- changed since this candidate was computed (doc 31 "Staleness"), and the
-- diff card says so instead of offering a misleading Promote.
alter table public.reasoning_runs
  add column if not exists candidate_base_content jsonb;

-- null = live (undecided); 'promoted' | 'discarded' once resolved. Rows are
-- marked, never deleted (doc 31 "Discarded and abandoned candidates").
alter table public.reasoning_runs
  drop constraint if exists reasoning_runs_candidate_resolution_check;
alter table public.reasoning_runs
  add column if not exists candidate_resolution text;
alter table public.reasoning_runs
  add constraint reasoning_runs_candidate_resolution_check
  check (candidate_resolution in ('promoted', 'discarded'));

-- At most one LIVE candidate per house (doc 31 "one candidate at a time"),
-- enforced by Postgres, not just the application's own pre-flight check
-- (app/api/houses/[id]/reasoning/route.ts) — belt-and-suspenders: the
-- pre-flight check is what actually saves the wasted AI spend (it runs
-- before any orchestrator call), this index is what guarantees the data
-- never ends up in a state the application-level check failed to prevent.
create unique index if not exists reasoning_runs_house_live_candidate_uidx
  on public.reasoning_runs (house_id)
  where is_candidate and candidate_resolution is null;

-- The existing house-scoped lookup (getReasoningRunByHouseId,
-- getConflictingRunningRun) already filters on house_id; this index serves
-- the NEW is_candidate = true reads (getLiveCandidateRun) the same way.
create index if not exists reasoning_runs_house_candidate_idx
  on public.reasoning_runs (house_id, updated_at)
  where is_candidate;
