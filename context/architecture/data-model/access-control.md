# Access Control: RLS, Helpers, and Grants

Two independent layers gate every table: a Postgres **GRANT** (does this
Postgres role have any privilege on this table at all) and **RLS policies**
(which rows, given that it does). Both are required; either one missing means
zero access, and this repo has repeatedly shipped RLS without the matching
grant. See [edge-cases.md](edge-cases.md) for the specific incidents — this
doc covers the steady-state shape.

## Helper functions (all `SECURITY DEFINER`, `stable`)

Every access check that needs to look at a table *other than* the one the
policy is on goes through a `SECURITY DEFINER` helper, so the helper reads
with RLS bypassed and the calling policy never recurses into itself:

- **`owns_house(hid)`** (0003) — `houses.owner_id = auth.uid()`.
- **`can_access_house(hid)`** / **`can_edit_house(hid)`** (0004) —
  `owns_house` widened by `house_collaborators` (any role / `editor` role
  respectively). Used by every house-scoped child and feature table:
  `house_perspectives`/`evidence`/`assumptions`/`implications`,
  `house_presence`, `house_direct_messages` (partially — see
  [house-tables.md](house-tables.md)), `house_activity`,
  `house_layer_feedback`, `house_console_messages`, `house_console_chats`.
- **`is_house_collaborator(hid)`** (0006) — reads only
  `house_collaborators`, never `houses`. Exists specifically so
  `houses_select` doesn't have to route collaborator access through
  `can_access_house` → `owns_house`, which self-queries `houses` and breaks
  `INSERT … RETURNING` (see [edge-cases.md](edge-cases.md)).
- **`is_class_teacher(cid)`** / **`is_class_member(cid)`** (0014) — classroom
  equivalent of the two above.
- **`can_view_student_house(hid)`** / **`can_view_assignment_strawman(hid)`**
  (0014/0017, gated in 0024) — read-only widening of `houses_select` for
  teacher visibility and the strawman exercise.
- **`is_teacher()`** / **`current_account_type()`** (0026) — the DB-level
  source of truth for role checks, replacing UI-only gating.
- **`has_house_standing(hid, uid)`** (0036) — used only to check the
  *recipient* side of a direct message insert.

## The owner-column rule

`houses_select` and `house_console_chats`'s policies authorize the *owning*
row by checking a column on that row directly (`owner_id = auth.uid()`),
never by re-querying the same table through a helper. This is
[decision 004](../../../decisions/004-houses-rls-create-house.md)'s rule of
thumb, restated: **a table's own RLS policy must not subquery its own table**
to authorize a row, because during `INSERT … RETURNING` that subquery runs
under the pre-insert statement snapshot and always returns false. Reserve
`SECURITY DEFINER` self-referencing helpers (`owns_house`, `can_access_house`)
for read paths where the row already exists — never for the policy deciding
whether a fresh insert can be returned.

## Service-role-only tables

RLS enabled, **zero policies for `anon`/`authenticated`**, so those roles are
denied every row regardless of grants. Only the service-role key (used
exclusively by server-only modules) can touch them:

| Table | Writer | Notes |
|---|---|---|
| `ai_usage` | `lib/ai/limits.ts` via `increment_ai_usage` RPC | RPC itself is `service_role`-only execute (0012) |
| `ai_daily_exhaustion` | `lib/ai/router-state.ts` | fire-and-forget, fails open |
| `reasoning_runs` | `lib/ai/reasoning/persistence.ts` | fire-and-forget writes, reads also fail open to `null` |

`house_activity` is a partial case: it has an `authenticated` SELECT policy
but no `authenticated` grant, so in practice it's read only by a service-role
route too — see [house-tables.md](house-tables.md).

## Grant checklist — every base-table GRANT this schema has needed

RLS policies do not grant base-table access; Postgres checks the connecting
role's table privilege *before* evaluating any policy. This project's
Supabase instance also does **not** auto-grant new tables to `service_role`.
Both facts have caused a live `42501 permission denied` more than once — see
[edge-cases.md](edge-cases.md) for the exact list of which migrations had to
fix this after shipping, and note that the fix is a grant to whichever role
actually connects (`authenticated` for tables read by a user's own session,
`service_role` for tables read only by server code) — **not always
`authenticated`**.

| Grantee | Tables |
|---|---|
| `authenticated` | `houses` + 4 children (0005), `house_collaborators` (0005), `profiles` (0019), `classes`/`class_members`/`assignments`/`courses` (0014/0015/0016), `submission_feedback` (0018), `house_presence`/`house_direct_messages` (0037), `house_layer_feedback` (0039), `house_console_messages` (0040), `house_console_chats` (0041) |
| `service_role` | `ai_daily_exhaustion` (0029), `reasoning_runs` (0030/0031), `profiles` SELECT (0034), `house_collaborators`/`houses`/4 children SELECT (0035), `house_activity` SELECT+INSERT (0036) |
| function EXECUTE | `increment_ai_usage` → `service_role` only (0012, after revoking Postgres's default PUBLIC grant); `join_class`, `open_assignment`, `ensure_strawman_house`, `reconcile_signup_role`, `is_teacher`, `current_account_type` → `authenticated` |

`anon` is granted nothing on any table in this schema. The only anon-reachable
data path is the share-link route, which reads `houses` with the service-role
key and authorizes by token possession, not by table grant.
