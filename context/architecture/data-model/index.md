# Data Model

The Supabase Postgres schema, its access rules, the non-table app shapes it
serializes from, and the edge cases each one has already cost someone time on.
Source of truth for every fact here is `supabase/migrations/*.sql` — these docs
synthesize and explain, they do not restate columns. When in doubt, read the
migration; its header comment is usually richer than anything below.

**Branch state (2026-08-22, `feat/console-sandbox-reruns`):** migrations run
through `0043_reasoning_runs_candidate.sql`, but 0043 is **written and not yet
applied** to the shared database — its own header says so explicitly. Code on
this branch (Loop C / sandbox reruns) already assumes its columns exist. Apply
0043 deliberately before exercising the candidate-rerun routes against real
data; do not assume it's live just because the file is on disk.

**One database, no environments.** Local dev and production point at the same
Supabase project — there is no staging copy. Every migration in this repo is
written additively and idempotently (`if not exists`, guarded `drop … if
exists` before `add`) because it runs against real rows the moment it's
applied. Local testing writes real data. Keep that in mind before assuming a
migration is "safe to just try."

## Where to look

- [house-tables.md](house-tables.md) — the house itself: the `houses` parent,
  its four normalized child tables, collaborators, the share-link mechanism,
  and the team panel (presence, DMs, activity log).
- [classroom-tables.md](classroom-tables.md) — `profiles`, classes, class
  membership, assignments, courses, the strawman exercise, and teacher
  feedback.
- [ai-and-console-tables.md](ai-and-console-tables.md) — everything AI-usage
  and reasoning-pipeline: rate-limit counters, provider-exhaustion cache,
  `reasoning_runs` (including Loop C's candidate columns), and the
  post-pipeline console's chats/messages/revisions.
- [access-control.md](access-control.md) — the RLS helper functions
  (`owns_house`, `can_access_house`, `can_edit_house`, the classroom
  equivalents), which tables are service-role-only, and the grant posture
  every table actually needs.
- [app-level-shapes.md](app-level-shapes.md) — the TypeScript shapes that
  never become their own tables: the builder's `State`, how it serializes to
  rows, the reasoning pipeline's `RunState` (one run, one JSONB column), and
  the client-safe `lib/ai/*.ts` contracts every AI route and its UI share.
- [edge-cases.md](edge-cases.md) — the traps. Read this before writing a new
  migration or a new route against any of these tables.
- [additional-traps.md](additional-traps.md) — traps found while researching
  this doc set that weren't on the original known-issues list.

## Orientation

- [decisions/002-house-schema.md](../../../decisions/002-house-schema.md) —
  why the house content is normalized child tables, not one JSONB blob.
- [decisions/004-houses-rls-create-house.md](../../../decisions/004-houses-rls-create-house.md)
  — a postmortem on four stacked RLS failures when "create a house" first
  shipped; the canonical write-up of the `INSERT … RETURNING` self-query trap
  referenced throughout these docs.
- [decisions/019-multi-agent-reasoning-pipeline.md](../../../decisions/019-multi-agent-reasoning-pipeline.md)
  and [plans/active/reasoning-pipeline/](../../../plans/active/reasoning-pipeline/)
  — the reasoning pipeline's own design docs; `reasoning_runs` and the console
  tables exist to serve this feature.
- [plans/active/persistence/](../../../plans/active/persistence/) — the
  collaboration, invite/share, and team-panel feature docs behind
  `house_collaborators`, `house_presence`, `house_direct_messages`, and
  `house_activity`.
