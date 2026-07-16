-- 0022 — Draft Mode (decision 016): per-house AI-draft progress + per-layer
-- claim map. jsonb of lib/ai/draft.ts DraftState ({ stage, drafted, claimed });
-- null on every house the AI did not draft, so existing rows need no backfill.
-- Column access rides the existing grants (0005) and RLS (0003/0004/0006/0020).

alter table public.houses
  add column if not exists draft jsonb;
