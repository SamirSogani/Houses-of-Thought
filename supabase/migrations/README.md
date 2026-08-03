# Database migrations

Ordered SQL migrations for the Supabase Postgres database, and the **tracked
source of truth** for schema. Apply changes here — never only in the dashboard.

- Filenames: `NNNN_short-name.sql`, applied in ascending order.
- Apply by pasting each file's SQL into the Supabase SQL editor, in filename
  order. Record schema changes here first, then run them — these files are the
  source of truth, not the dashboard.
- Write migrations idempotently (`if not exists`, `drop ... if exists`,
  `create or replace`) so re-running is safe.

## Workflow rules

Main auto-deploys to production, so ordering is a correctness property:

1. **Apply before pushing.** A migration is applied to production *before* the
   code that depends on it is pushed — never the other way around.
2. **Expand → deploy → contract.** Every migration must be backward-compatible
   with the currently-deployed code: add columns/tables first, deploy code that
   uses them, and only remove the old shape in a later migration once nothing
   deployed reads it.
3. **Update the applied-state line below at apply time** — it is the only
   record of what production has actually run until the Supabase CLI workflow
   (analysis/operations-and-delivery-plan.md item 13) lands.

**Applied through: 0024 (unconfirmed — assumed applied with commit 3142b8e;
verify in the dashboard and update this line).** 0025 is a pending perf index,
safe to apply any time.

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
| `0013_signup_role.sql` | profiles | Signup trigger reads `account_type` from signUp metadata (classroom phase 1) |
| `0014_classes.sql` | classroom | `classes` (teacher-owned, join code) + `class_members` + `join_class` RPC + teacher read-into-student-houses RLS (phase 2) |
| `0015_assignments.sql` | classroom | `assignments` + `houses.assignment_id`; student houses created lazily via `open_assignment` RPC (phase 3) |
| `0016_courses.sql` | classroom | `courses` (class-scoped ordered units) + `assignments.course_id`/`position` (phase 4) |
| `0017_strawman.sql` | classroom | `houses.is_strawman`, assignment strawman params + `ensure_strawman_house` / `can_view_assignment_strawman` (phase 5) |
| `0018_submission_feedback.sql` | classroom | `submission_feedback` (grade + feedback), separate from `houses` so grading never grants write access (phase 6) |
| `0019_profiles_grants.sql` | profiles | Base-table GRANT on `profiles` to `authenticated` (RLS still restricts rows) |
| `0020_fix_houses_select_returning.sql` | houses | Regression fix: restore direct `owner_id` check in `houses_select` so `INSERT ... RETURNING` works (the decision 004 trap, reintroduced by 0014/0017) |
| `0021_houses_turned_in.sql` | classroom | `houses.turned_in boolean` — student marks an assignment submission turned in |
| `0022_houses_draft.sql` | houses | Adds `draft jsonb` — Draft Mode stage progress + per-layer claim map (decision 016); null on non-drafted houses |
| `0023_ai_usage_retention.sql` | ai | Weekly pg_cron prune of `ai_usage` rows older than 90 days (rows are only read for "today"; the IP ceiling doubles anonymous row writes) |
| `0024_classroom_integrity.sql` | classroom | `houses.turned_in_at`, `assignments.strawman_released` (+ release gate in `can_view_assignment_strawman`, grandfathering live strawmen), roster returns `account_type`. ⚠ Apply BEFORE deploying the matching client code |
| `0025_dashboard_index.sql` | houses | Partial index `(owner_id, updated_at desc) where is_strawman = false` — perf helper for the owner-scoped dashboard grid query (finding db-C1); no behavior change |
| `0028_ai_daily_exhaustion.sql` | ai | `ai_daily_exhaustion` (deny-all RLS) — persists which provider tripped its daily quota so `lib/ai/router-state.ts` survives a dev-server restart (decision 019, reasoning pipeline) |
| `0029_fix_ai_daily_exhaustion_grant.sql` | ai | **Functionality fix for 0028**: grant `select, insert` on `ai_daily_exhaustion` to `service_role` — RLS bypass alone doesn't grant base table access; confirmed live as a `permission denied for table` error the first time a real daily exhaustion occurred |
| `0030_reasoning_runs.sql` | ai | `reasoning_runs` (deny-all RLS, `service_role` `insert, update` grant) — persists the reasoning pipeline's packets/verdicts, one JSONB row per run (decision 019 Phase 2 item 1, plans/active/reasoning-pipeline/15-persistence.md) |
| `0031_reasoning_runs_select_grant.sql` | ai | **Widens 0030**: grant `select` on `reasoning_runs` to `service_role`, for the "browse past runs" admin UI (`/admin/reasoning/runs`) — 0030 deliberately shipped without it |

## Applying to a fresh database

Run every file in order. **All of `0003`–`0006` are required for house create/read to
work** — each fixes a distinct layer (policies → grants → returning-select). If you
create tables through the dashboard UI instead of these files, RLS is enabled but no
policies are created, and every query is silently denied; always apply the files.

The four-layer debugging story behind `0005`/`0006` (grants, missing policies, session,
and the `INSERT ... RETURNING` self-query) is written up in
[decisions/004-houses-rls-create-house.md](../../decisions/004-houses-rls-create-house.md).
