# Database migrations

Ordered SQL migrations for the Supabase Postgres database, and the **tracked
source of truth** for schema. Apply changes here — never only in the dashboard.

- Filenames: `NNNN_short-name.sql`, applied in ascending order.
- Apply by pasting each file's SQL into the Supabase SQL editor, in filename
  order. Record schema changes here first, then run them — these files are the
  source of truth, not the dashboard.
- Write migrations idempotently (`if not exists`, `drop ... if exists`,
  `create or replace`) so re-running is safe.

| File | Area | Adds |
|---|---|---|
| `0001_profiles.sql` | profiles | `profiles` table, signup trigger, RLS — backfill of hand-run SQL |
| `0002_profiles_extend.sql` | profiles | Profile fields (username, account_type, about_me, …) + unique username |
| `0003_houses.sql` | houses | `houses` + child tables (perspectives/evidence/assumptions/implications) + owner-only RLS |
| `0004_collaborators.sql` | houses | `house_collaborators` + access helpers; RLS rewritten to honor collaborators (foundation only, no app feature yet) |
| `0005_houses_grants.sql` | houses | Grants table privileges on the house tables to `authenticated` (RLS still restricts rows); fixes `42501 permission denied` on create/load |
| `0006_fix_houses_select_returning.sql` | houses | Rewrites `houses_select` to check `owner_id` directly + `is_house_collaborator()` helper; fixes RLS violation on `INSERT ... RETURNING` (create house) |
| `0007_houses_frame_conclusion.sql` | houses | Adds `purpose` / `conclusion` / `reasoning` columns so the builder persists the editable Frame + Conclusion prose (`question` already existed in `0003`) |
| `0008_house_concept_definitions.sql` | houses | Adds `concept_definitions text[]` (parallel to `concepts`) so each Frame concept can carry a definition |
| `0009_perspective_detail.sql` | houses | Adds `stance` / `sub_questions` / `supporting_evidence` / `counters` to `house_perspectives` so the drill-in detail is editable and persisted |
| `0010_ai_columns.sql` | houses | Adds `mode` (learn/decide, default decide) + `ai_context jsonb` to `houses`, and `url` to `house_evidence` — the forward columns the AI phases need (plans/active/ai Phase 2) |
| `0011_ai_usage.sql` | ai | `ai_usage` daily counters (deny-all RLS) + `increment_ai_usage(text)` SECURITY DEFINER RPC; backs the per-subject AI rate limits (plans/active/ai Phase 6) |
| `0012_fix_ai_usage_execute_grant.sql` | ai | **Security fix for 0011**: revoke the implicit PUBLIC EXECUTE on `increment_ai_usage` (anon/authenticated inherited it via PUBLIC, so 0011's revoke was ineffective) and grant it only to `service_role` |

## Applying to a fresh database

Run every file in order. **All of `0003`–`0006` are required for house create/read to
work** — each fixes a distinct layer (policies → grants → returning-select). If you
create tables through the dashboard UI instead of these files, RLS is enabled but no
policies are created, and every query is silently denied; always apply the files.

The four-layer debugging story behind `0005`/`0006` (grants, missing policies, session,
and the `INSERT ... RETURNING` self-query) is written up in
[decisions/004-houses-rls-create-house.md](../../decisions/004-houses-rls-create-house.md).
