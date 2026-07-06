-- 0007_houses_frame_conclusion.sql
-- Adds the editable Frame + Conclusion prose columns to `houses`, so the builder
-- can persist Purpose, Central conclusion, and Reasoning summary. `question`
-- already exists (0003); it was simply not read/written by the app until now.
-- Column-level access rides the existing table grants (0005) and RLS (0006), so
-- no new grants or policies are needed. Idempotent.

alter table public.houses add column if not exists purpose    text;  -- Frame: purpose prose
alter table public.houses add column if not exists conclusion text;  -- Conclusion: central conclusion
alter table public.houses add column if not exists reasoning  text;  -- Conclusion: reasoning summary
