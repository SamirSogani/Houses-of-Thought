-- 0009_perspective_detail.sql
-- Per-perspective drill-in detail becomes user-editable: a stance plus ordered
-- lists of sub-questions, supporting evidence, and counterarguments. Stored as
-- jsonb on house_perspectives (the app already rewrites these rows wholesale on
-- save). The existing `questions` int column is kept as the sub-question count.
-- Rides the existing grants (0005) and RLS (0003); no new grants/policies.
-- Idempotent.

alter table public.house_perspectives
  add column if not exists stance             text,
  add column if not exists sub_questions      jsonb not null default '[]'::jsonb,  -- [{ q, note }]
  add column if not exists supporting_evidence jsonb not null default '[]'::jsonb, -- [{ text, source }]
  add column if not exists counters           jsonb not null default '[]'::jsonb;  -- [string]
