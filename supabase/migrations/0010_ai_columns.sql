-- 0010_ai_columns.sql
-- AI wiring (plans/active/ai Phase 2). All forward columns the later AI phases
-- need, in one idempotent migration: co-pilot posture (mode), per-house AI
-- context (interviewer, doc 05), and a real citation URL on evidence (Research
-- Mode, doc 06). Column access rides existing grants (0005) and RLS (0003/0004/
-- 0006) — no policy changes. The 0003 owner_key CHECKs already include 'ai'.

alter table public.houses
  add column if not exists mode text not null default 'decide',
  add column if not exists ai_context jsonb;

alter table public.houses drop constraint if exists houses_mode_check;
alter table public.houses add constraint houses_mode_check
  check (mode in ('learn', 'decide'));

alter table public.house_evidence
  add column if not exists url text;
