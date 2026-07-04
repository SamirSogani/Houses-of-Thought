# Decision 002 — House Persistence Schema & Scope

**Date:** 2026-07-04
**Status:** Decided
**Plan:** [plans/active/persistence/](../plans/active/persistence/README.md)

## Decisions made

### 1. Normalized relational schema (not JSONB)
- **Choice:** Store each house's content in child tables
  (`house_perspectives`, `house_evidence`, `house_assumptions`,
  `house_implications`) keyed to a `houses` parent row.
- **Alternatives:** (a) hybrid — scalar columns + a `content` JSONB body;
  (b) a single JSONB blob per house.
- **Reasoning:** A normalized shape gives per-item rows (each with its own
  `owner_key` and `position`), real querying across houses, and a clean path to
  per-item RLS when collaboration lands. The reducer↔row mapping cost is
  accepted as the price of a durable foundation. JSONB would ship faster but
  pushes that modeling work to "later" and makes cross-house queries awkward.

### 2. Single-owner scope first
- **Choice:** This milestone persists houses and profiles for their **owner
  only**. RLS is owner-scoped; the team rail and invite flow are not wired to
  real users yet.
- **Deferred:** a `house_collaborators` table + invite wiring is a follow-up.
  Until then `owner_key` (`you`/`maya`/`devan`/`ai`) stays a cosmetic text
  field, not a real user reference.
- **Reasoning:** Keeps the first cut shippable and lets us validate the schema
  before layering sharing and multi-user access rules on top.

### 3. Migrations are the tracked source of truth
- **Choice:** All schema changes live in `supabase/migrations/*.sql`, applied in
  order and written idempotently. The existing hand-run `profiles` SQL is
  backfilled as `0001` so the repo matches the live database.
- **Reasoning:** The founding profiles SQL was run directly in the dashboard and
  went untracked (flagged in `context/architecture/tech-stack.md`). Tracking
  migrations closes that gap and makes schema reviewable in git.

### 4. Sub-decisions (defaults)
- **`concepts[]` / `watchpoints[]`** → `text[]` columns on `houses`, not their
  own tables. They are ordered string lists with no attributes; a table each
  would be over-normalization.
- **`accepted` suggestion-map** (`Record<number, number[]>`) → `jsonb` on
  `houses`. It is UI provenance, not queryable domain data.
- **Ephemeral reducer state** (step, tabs, toast, inviteOpen) is never
  persisted — it is view state, not house content.
