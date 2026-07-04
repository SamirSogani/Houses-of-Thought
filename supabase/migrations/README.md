# Database migrations

Ordered SQL migrations for the Supabase Postgres database, and the **tracked
source of truth** for schema. Apply changes here — never only in the dashboard.

- Filenames: `NNNN_short-name.sql`, applied in ascending order.
- Apply by pasting each file's SQL into the Supabase SQL editor, in filename
  order. Record schema changes here first, then run them — these files are the
  source of truth, not the dashboard.
- Write migrations idempotently (`if not exists`, `drop ... if exists`,
  `create or replace`) so re-running is safe.

| File | Adds |
|---|---|
| `0001_profiles.sql` | `profiles` table, signup trigger, RLS — backfill of hand-run SQL |
| `0002_profiles_extend.sql` | Profile fields (username, account_type, about_me, …) + unique username |
| `0003_houses.sql` | `houses` + child tables (perspectives/evidence/assumptions/implications) + RLS |
| `0004_collaborators.sql` | `house_collaborators` + access helpers; RLS rewritten to honor collaborators (foundation only, no app feature yet) |
