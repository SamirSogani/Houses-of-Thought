# House Tables

The house is the product's core unit: one reasoning exercise, built through
seven layers (Frame, Perspectives, Evidence, Assumptions, Conclusion,
Implications, Review). This doc covers the tables that store it and the people
attached to it. See [app-level-shapes.md](app-level-shapes.md) for how the
builder's in-memory `State` maps onto these rows.

## `houses` (parent) — mutable

One row per house. Owned by `owner_id` (`auth.users`). Scalar/prose fields
(`title`, `question`, `purpose`, `conclusion`, `reasoning`, `status`,
`layers_complete`) and small ordered lists with no attributes (`concepts[]`,
`concept_definitions[]`, `watchpoints[]`) live directly on this row —
[decision 002](../../../decisions/002-house-schema.md) chose that over a
child table for anything that's just an ordered string list. `updated_at` is
bumped by a trigger (`touch_updated_at`, migration 0003) on every direct
UPDATE and doubles as the optimistic-concurrency token `save_house` checks
(see [app-level-shapes.md](app-level-shapes.md)).

Later columns worth knowing about: `mode` (learn/decide co-pilot posture,
0010), `ai_context`/`draft` (jsonb, Draft Mode state, 0010/0022),
`assignment_id` + `is_strawman` (classroom wiring, 0015/0017), `turned_in` /
`turned_in_at` (0021/0024), `share_token` (0033, nullable unique — see below).

## Child tables — replaced wholesale on save

`house_perspectives`, `house_evidence`, `house_assumptions`,
`house_implications` (all from migration 0003, detail columns added in
0009/0010). Each row belongs to one house (`house_id`, cascade delete) and
carries `position` for ordering and `owner_key` (`you`/`maya`/`devan`/`ai`) for
cosmetic attribution. `house_implications` collapses three UI lists
(positive/negative/uncertain) into one table via a `kind` column rather than
three tables.

These are not edited row-by-row from the client. `save_house` (migration
0027, an RPC) deletes and re-inserts every row of all four tables in one
transaction per save — see
[app-level-shapes.md](app-level-shapes.md#save_house-rpc) for why (it replaced
up to nine sequential, non-atomic client round trips).

## `house_collaborators` — mutable

Migration 0004. `(house_id, user_id)` primary key, `role` is `viewer` or
`editor`. The owner is **not** a row here — ownership is tracked only via
`houses.owner_id`. This table is what turns `owns_house` into the wider
`can_access_house` / `can_edit_house` checks used everywhere else — see
[access-control.md](access-control.md).

## `house_share_token` — not a table

Migration 0033 just adds `houses.share_token` (nullable, unique uuid). Null =
not shared. Sharing is owner-gated through the ordinary `houses_update`
policy — nothing new to grant. The read side never goes through PostgREST/RLS
at all: `app/api/shared/[token]/route.ts` reads it with the service-role key,
so authorization is "do you possess the token," enforced in application code,
not a table policy.

## Team panel (migration 0036) — presence, DMs, activity log

Three tables, all scoped to one house:

- **`house_presence`** — mutable, one row per `(house_id, user_id)`, a
  last-seen timestamp the client upserts on mount and every ~60s. Covers the
  owner too (not folded into `house_collaborators`, which has no row for the
  owner).
- **`house_direct_messages`** — append-only. House-scoped 1:1 messages, not a
  cross-house inbox. Its SELECT policy is **sender/recipient only**, not
  `can_access_house` — a deliberate deviation from every other house-scoped
  table, caught in review: a third collaborator having house access is not
  consent to read someone else's private thread on that house.
- **`house_activity`** — append-only, written by triggers on
  `house_collaborators` (invited/removed/left/role_changed) and
  `house_direct_messages` (message_sent), plus one explicit insert from the
  share-link route. Has a `can_access_house` SELECT policy for
  `authenticated`, but **no `authenticated` GRANT was ever added** — only
  `service_role` got one (0036). In practice this policy is unreachable via
  PostgREST: the only reader is `app/api/activity/route.ts`, which validates
  the caller's session itself and then reads with the service-role client
  (needed anyway to resolve `profiles`, which is owner-only RLS). Not a bug —
  nothing is broken — but worth knowing if you ever expect a direct client
  query against `house_activity` to work: it won't, regardless of the policy.

See [access-control.md](access-control.md) for the full grant picture and
[edge-cases.md](edge-cases.md) for the cascade-delete-vs-FK ordering trap the
`house_collaborators` delete trigger had to work around.
