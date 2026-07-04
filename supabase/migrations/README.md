# Database migrations

Ordered SQL migrations for the Supabase Postgres database, and the **tracked
source of truth** for schema. Apply changes here — never only in the dashboard.

- Filenames: `NNNN_short-name.sql`, applied in ascending order.
- Apply with the Supabase CLI (`supabase db push`) or by pasting into the SQL
  editor in order.
- Write migrations idempotently (`if not exists`, `drop ... if exists`,
  `create or replace`) so re-running is safe.

| File | Adds |
|---|---|
| `0001_profiles.sql` | `profiles` table, signup trigger, RLS — backfill of hand-run SQL |
