# Edge Cases & Traps

Read this before writing a migration or a route against any table in this
schema. Every item below was checked against the current code (2026-08-22,
`feat/console-sandbox-reruns`); where a commonly-repeated claim turned out to
be imprecise, that's called out explicitly rather than silently corrected.

## RLS policies do not grant base-table access

Postgres checks the connecting role's table privilege *before* evaluating any
RLS policy. This repo has hit that gap repeatedly — 0005, 0012, 0019, 0029,
0031, 0034, 0035, 0037, and 0039 each added a grant that RLS alone didn't
provide. **Correction to a common shorthand for this:** the fix isn't always
"grant to `authenticated`." 0029, 0031, 0034, and 0035 fixed missing grants to
**`service_role`** (server-only tables/reads); 0037 and 0039 fixed missing
`authenticated` grants (user-facing tables). The full per-table list is in
[access-control.md](access-control.md#grant-checklist--every-base-table-grant-this-schema-has-needed).
The Supabase project also does not auto-grant new tables to `service_role`
(0035's own finding) — every service-role table needs its grant written
explicitly, in the same migration that creates the table if possible.

## `INSERT … RETURNING` self-queries its own table's RLS

A `SELECT` policy that reaches a `SECURITY DEFINER` helper which re-queries
the *same* table (`owns_house` → `select … from houses`) breaks
`INSERT … RETURNING`: the subquery runs under the pre-insert statement
snapshot and can't see the row just inserted, so Postgres reports an RLS
violation on a perfectly valid insert. Full postmortem:
[decision 004](../../../decisions/004-houses-rls-create-house.md). Worth
knowing this bit isn't hypothetical: it was fixed once (0006), then
**reintroduced twice** by later feature migrations (0014, 0017) that rewrote
`houses_select` to lead with the self-querying helper again, before 0020
fixed it for good by checking `owner_id = auth.uid()` directly. The rule of
thumb — never subquery a policy's own table to authorize a row — is easy to
violate by accident whenever a `houses_select` rewrite reaches for
`can_access_house` as its first branch instead of last.

## An UPDATE policy needs both `using` and `with check`

`house_console_chats` (0041) is this repo's first UPDATE policy. `using`
gates which rows may be updated; `with check` gates what they may become.
Without the second half, a caller who can update one of their own chats today
could rewrite its `house_id` to a house they have no standing on — passing
`using` on the way in, landing somewhere `using` would have refused. Confirmed
correct as shipped: both halves are present.

## Guarded `drop constraint if exists` assumes the default name

Postgres names an inline, unnamed `check (…)` constraint
`<table>_<column>_check` by default. The idiom `drop constraint if exists
<guessed-name>` then `add constraint <guessed-name> check (…)` relies on that
guess matching the live name — if it doesn't, the drop silently no-ops and
the new constraint is added *alongside* the old one, which keeps rejecting
the new value. Every instance of this pattern in the repo (0002, 0010, 0041,
0042, 0043) currently has the name right — 0041's own comment shows the
author explicitly reasoning through why (checking what the prior migration
actually shipped) rather than assuming. This hasn't bitten the repo yet; it
remains a live risk for any future migration that writes this pattern without
that same check.

## Local dev and production share one Supabase database

No separate environments exist. See [index.md](index.md) — this is why every
migration is additive and idempotent, and why "just try it locally" still
writes real rows.

## `reasoning_runs` writes are fire-and-forget and fail open

`persistRunStep` is never awaited by the route and never throws into the
caller; a failed write just means that run has no durable record — never a
functional regression to the pipeline. Every read in
`lib/ai/reasoning/persistence.ts` follows the same posture: a lookup failure
returns `null`, not an error, so an infrastructure hiccup here can never block
a legitimate pipeline run or make a real one look abandoned.

## `getReasoningRunByHouseId` and the Loop C exclusion

It returns the most-recently-updated row for a house — confirmed accurate,
and it's precisely why a rerun's new run becomes "the" run for a house without
erasing the previous one (there's no separate "current run" pointer). Loop C's
candidate columns (0043) exist because a sandbox rerun persists under the
*same* house_id, upserted after every step exactly like a real run — without
`.eq('is_candidate', false)` in this one function, a candidate would silently
become "the" run for the house the instant its first step landed, for every
caller: the rerun-confirm starting point, the stale-chat badge, and the
`run_id_at_last_reply` bookkeeping all inherit the fix by virtue of sharing
this one function.

## The single-flight rerun lock never blocks its own run

`getConflictingRunningRun` excludes the incoming request's own `runId` at the
query level (`.neq('id', excludeRunId)`); `runLockBlocks` re-checks the same
condition in the pure function that makes the allow/deny decision, specifically
so the one line the whole lock's correctness rests on isn't only enforced by
how the caller happens to query. The pipeline is client-driven — one POST per
step — so a run's own row sits at `status: 'running'` for its entire
duration; without this, a run would lock itself out of its own continuation.

## Soft delete is new, and deletion re-parents rather than cascades

`house_console_chats.deleted_at` is the first soft delete in this schema.
Deleting a chat moves its direct children to *its own* parent
(`reparentChildren` in `lib/ai/console.ts`) — a linked-list splice, not a
cascade — so "branches survive deletion" instead of an entire subtree
disappearing with the deleted chat.

## A console fork copies rows; it does not reference a parent chat

`messagesToFork` returns every row of the source chat's transcript up to and
including the fork point, for the route to insert as fresh rows in the new
chat. The alternative — a recursive read up `parent_chat_id` at GET time —
was rejected: every transcript read would become a recursive CTE, and
soft-deleting a parent chat would turn into a read-path problem instead of a
list-path one. The cost is duplicated text rows, judged the cheapest thing in
this schema.

## `enforceAiLimit` charges by units, not by request

`units` (default 1) lets a route that makes several model calls in one
request — e.g. Loop A's revise route, one critic call plus one rewrite call —
charge the daily counter for what it actually spent. Implemented as a loop of
ordinary `increment_ai_usage` RPC calls rather than a wider RPC signature,
specifically to avoid creating a Postgres function overload that would make
every existing single-argument call site ambiguous on a function shared
app-wide.

## Two ordering bugs worth generalizing from

- **`.order(created_at, { ascending: true }).limit(N)` returns the OLDEST N
  rows**, not the most recent — the console's context reload had this bug
  until doc 29's fix: query `ascending: false` (newest N, DB-side), then
  `toChronological()` reverses the page back to display order. Any "last N
  turns" query needs the same shape.
- **0041's chat backfill left every backfilled chat's `title` as `''`** — it
  only ever set `house_id`, `origin`, and timestamps, never derived a title
  from the chat's own messages. Those chats rendered as "Untitled chat" in
  the sidebar until the list route (`app/api/houses/[id]/console/chats/route.ts`)
  learned to derive a title on read, for any chat with messages but no title.

## More traps

[additional-traps.md](additional-traps.md) covers what turned up while
reading that wasn't on the original known-issues list: a dead RLS policy on
`house_activity`, a pass-through-field cap-mismatch bug class, the unapplied
0043 migration, the "apply before deploying" ordering convention, and a
cascade-delete-vs-trigger-FK race in the activity log.
