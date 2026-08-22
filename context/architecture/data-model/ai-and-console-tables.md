# AI Usage & Reasoning-Pipeline Tables

Everything backing rate limits, the multi-agent reasoning pipeline, and the
post-pipeline console. All of it except the two console tables at the bottom
is **service-role-only** — see [access-control.md](access-control.md) for what
that means and why.

## `ai_usage` — mutable counters, pruned

Migration 0011: `(day, subject)` counters incremented by the
`increment_ai_usage` RPC, which only `service_role` may call (0012 revoked the
PUBLIC execute grant Postgres adds by default — see
[access-control.md](access-control.md)). `subject` is `user:<uuid>` or a
hashed `ip:<sha256-16>`, never a raw IP. Migration 0023 adds a weekly
`pg_cron` job pruning rows older than 90 days — rows are only ever read for
"today," so nothing is lost by pruning.

## `ai_daily_exhaustion` — append-once-per-day-per-provider

Migration 0028: persists which AI providers tripped their daily quota today,
so `lib/ai/router-state.ts`'s in-memory cache survives a cold start instead of
re-discovering exhaustion with one more real, failing API call per provider.
`(provider, day)` primary key, written with `ignoreDuplicates` — never
updated, only ever inserted once per key. Deny-all RLS.

## `reasoning_runs` — one row per run, upserted through its lifetime

Migration 0030: one JSONB row (`run_state`) per reasoning-pipeline run,
upserted by `persistRunStep` after every real (non-dry-run) step — not only on
completion, so a halted run is captured too. Deny-all RLS; only
`service_role` can insert/update (0030) or select (0031) it — nothing reads or
writes this table through a normal user session. Later additions:

- `panels_off` (0032) — a run-level A/B flag.
- `house_id` (0038) — nullable; links a run to the house it was run for. Null
  for admin-triggered runs (unchanged from before this column existed).
- **Candidate columns (0043 — see the branch-state note in
  [index.md](index.md), UNAPPLIED as of this writing):** `is_candidate`,
  `candidate_chat_id`, `candidate_stage`, `candidate_base_content`,
  `candidate_resolution`. Loop C ("sandbox reruns with a diff") lets a rerun
  execute without touching the house, offered for promote/discard. A partial
  unique index enforces at most one *live* candidate
  (`is_candidate and candidate_resolution is null`) per house.

`getReasoningRunByHouseId` (`lib/ai/reasoning/persistence.ts`) returns the
most-recently-updated non-candidate row for a house — see
[edge-cases.md](edge-cases.md) for why the `is_candidate = false` filter is
load-bearing, not decorative.

## `house_layer_feedback` — append-only

Migration 0039. Post-draft Q&A/correction thread, scoped to **one layer** at a
time (`stage` check-constrained to the five `DraftStage` values). Both the
person's message and the co-pilot's reply are rows. `can_access_house` RLS +
`select, insert` grant to `authenticated` — this is a house-scoped,
collaborator-visible table, not service-role-only.

## `house_console_messages` — append-only, plus revision columns

Migration 0040: the whole-house sibling of layer feedback —
`/build/[id]/console`, entered once a pipeline run is done. Same turn-per-row
shape, plus `actions` (can include `remove_*` kinds) and `rerun_proposal`
(`{ stage, reason, guidance }`, only ever executed after the person explicitly
confirms it).

Migration 0042 ("Loop A — bounded revise") adds `revises_message_id`,
`revision_iteration` (0–3, capped by both the route and a CHECK constraint),
and `critique` (jsonb). A revision is a **new row**, never an overwrite of the
one before it — "a loop whose inside the person cannot see is a loop they
cannot check." `revises_message_id` is `on delete set null`, not cascade: the
turn being revised staying around is the point.

Migration 0041 widens the `role` CHECK to include `'system'` (a future
rerun-completion marker) and adds `chat_id` / `origin_message_id` — see below.

## `house_console_chats` — mutable, this repo's first soft delete

Migration 0041: multiple chats inside the console. A chat is a first-class
row; a message now belongs to exactly one. Key shape decisions:

- **Fork = copy, not reference.** Forking inserts a duplicate of every
  message up to and including the fork point into the new chat
  (`messagesToFork` in `lib/ai/console.ts`), each stamped with
  `origin_message_id`. `parent_chat_id` / `branched_from_message_id` exist
  **only for provenance** (rendering "branched from Chat 2") — nothing reads
  them to reconstruct a transcript. The alternative (a recursive read up
  `parent_chat_id` at GET time) was rejected: every transcript read would
  become a recursive CTE, and soft-deleting a parent turns into a read-path
  problem instead of a list-path one.
- **`deleted_at`** — this repo's first soft delete. Deleting a chat
  re-parents its own children to *its own* parent rather than cascading; see
  [edge-cases.md](edge-cases.md).
- **First UPDATE policy in the repo** (rename / soft-delete / restore) —
  needed both `using` and `with check`; see
  [access-control.md](access-control.md).
- `run_id_at_last_reply` — which `reasoning_runs` row was current when this
  chat last got a reply; compared against the house's current run to drive
  the "stale chat" badge.

The 0041 migration also backfills one `'root'` chat per house that already
had console rows, scoped to `chat_id is null` so re-running it is a no-op —
see [edge-cases.md](edge-cases.md) for the empty-`title` gap this backfill
left behind.
