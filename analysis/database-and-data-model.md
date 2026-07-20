# Database & Data-Model Audit

Scope: schema design, indexing vs. query patterns, data lifecycle/integrity,
migration hygiene, growth math. Security (RLS-as-control, auth, abuse) is out of
scope; RLS appears here only where it affects correctness, cost, or upkeep.
Companion remediation plan: [database-and-data-model-plan.md](database-and-data-model-plan.md).
Does not repeat audits/code-quality-review.md B1–B8 (error swallowing etc.),
though C2/H1 below share root causes with B1/B2 and are cross-referenced.

## Critical

### C1 — Dashboard houses query has no owner filter: wrong rows today, full-table policy scan tomorrow
`app/dashboard/page.tsx:52-58` selects from `houses` with only
`.eq('is_strawman', false)` — no `owner_id` filter. Row scoping is delegated
entirely to the `houses_select` RLS policy (0020), which is
`owner_id = auth.uid() OR is_house_collaborator(id) OR can_view_student_house(id)
OR can_view_assignment_strawman(id)`.

Two consequences:
- **Correctness now:** `can_view_student_house` grants a teacher SELECT on *every*
  house of *every* student in their classes — including personal, non-assignment
  houses. With no query filter, all of them render in the teacher's personal
  "Your Houses" grid the moment one student joins and builds anything.
- **Cost at scale:** the OR of three non-inlinable SECURITY DEFINER functions
  defeats index use. The planner must scan the entire `houses` table and execute
  up to 3 subplans per row (each itself 1–3 index probes, `0014:107-116`,
  `0017:455-463`). At 30k houses that is ~90k hidden subqueries per dashboard
  load, for every user, teacher or not.

Failure scenario: first pilot teacher opens the dashboard and sees 120 students'
houses mixed into their own; six months later every dashboard load is a
multi-second sequential scan.

### C2 — No migration runner or applied-state tracking; per-file re-run regresses fixes
`supabase/migrations/README.md:7-9`: migrations are applied by hand-pasting into
the Supabase SQL editor, in filename order. There is no `schema_migrations`
table, no CLI, no CI check, and no way to know what the live DB actually has.
Compounding factors:
- `0001_profiles.sql:5-8` is **reconstructed from documentation**, explicitly not
  dumped from the live DB. Nothing has ever diffed it against production.
- "Idempotent" holds only per file, not per subset: `0014:170-172` and
  `0017:472-478` recreate the superseded `houses_select` (the INSERT…RETURNING
  trap 0006/0020 fixed — the ⚠ comments admit it). Re-running 0014 or 0017 alone
  — the natural move when "refreshing classroom setup" — silently breaks house
  creation again until 0020 is re-pasted.
- Three of 22 migrations are emergency fixes for earlier ones (0006, 0012, 0020),
  and `houses_select` is defined wholesale in five files (0003, 0004, 0014,
  0017, 0020): current policy state exists only in the reader's head.
- Standing up staging = 22 manual pastes with zero verification; one skipped
  file yields silent empty-result RLS denials (README warns of exactly this).

Failure scenario: a staging DB or a prod restore behaves differently from prod
and nobody can tell which side is wrong. 0001's blast radius is contained
(profiles table + policies; `handle_new_user` is superseded by 0013 anyway), but
the *process* that produced it is the real risk.

## High

### H1 — `saveHouse` is a non-atomic delete-then-insert fired by an 800ms autosave
`lib/build/persistence.ts:247-331`: every save = 1 parent UPDATE + 4 DELETEs +
up to 4 bulk INSERTs, as **nine sequential unwrapped requests** (no transaction;
the comment at :243-246 admits it). `components/build/BuildHousePage.tsx:112`
triggers this ~800ms after each pause in typing.
- Integrity: a network drop, tab close, or laptop sleep between a DELETE and its
  INSERT permanently erases a whole layer (perspectives/evidence/…). B1/B2 cover
  the swallowed errors; the DB-side fix (one transactional RPC) is separate.
- Cost: continuous delete/insert churn on 4 child tables + their indexes from
  every active editor — dead tuples, vacuum pressure, and 9 round-trips of
  latency per save through the connection pooler.

Failure scenario: classroom of 30 on school Wi-Fi; one dropped request mid-save
and a student's evidence layer is gone with a "saved" UI.

### H2 — A student can hard-delete a graded submission, destroying the grade record
`app/dashboard/page.tsx:118` issues `houses.delete()` for any owned house,
including assignment submissions (`turned_in` ones — the kebab menu doesn't
distinguish). `houses_delete` is owner-only (0003), and
`submission_feedback.house_id` is `ON DELETE CASCADE` (`0018:505`). So a student
deleting (or accidentally deleting — there is no soft delete, no undo anywhere)
a submission also erases the teacher's written feedback and grade. The teacher's
assignment view just shows "no submission".

### H3 — Get-or-create races: duplicate submissions and orphaned strawmen
- `open_assignment` (`0015:277-307`, redefined `0017:387-416`) is
  SELECT-then-INSERT with no unique constraint on `(assignment_id, owner_id)`.
  Double-click / two tabs → two submission houses for one student. The teacher
  assignment page builds `map[row.owner_id]` (`app/classroom/[classId]/assignments/[assignmentId]/page.tsx:83-87`),
  so one house silently shadows the other — feedback can land on the empty twin.
- `ensure_strawman_house` (`0017:421-451`) has the same race: two strawman
  houses, the loser unlinked and invisible but still granted to students via
  `can_view_assignment_strawman`.

### H4 — Account deletion will be blocked by two FKs with default NO ACTION
Deletion is currently a stub (`components/profile/DeleteAccountModal.tsx:44-47`
— "Nothing was deleted"; no server path exists in `lib/auth/account.ts`). When
it is built (or an admin deletes via the Supabase dashboard):
- `submission_feedback.teacher_id references auth.users` with **no ON DELETE**
  (`0018:506`) → any teacher who ever graded cannot be deleted (FK violation).
- `house_collaborators.invited_by references auth.users`, no ON DELETE (`0004:18`).
Everything else cascades correctly (`profiles`, `houses.owner_id`, `classes`,
`class_members`), with the noted side effect that deleting a teacher cascades
their classes → assignments → students' `assignment_id` goes NULL (work
preserved — good). A school pilot needs a working, non-blocking deletion path
for data-retention requests before launch.

## Medium

### M1 — `houses.accepted` jsonb is keyed by ephemeral integer ids
`0003:19` stores an accepted-suggestion map `Record<number, number[]>`; but
`loadHouse` reassigns every child id positionally (`persistence.ts:203-228`,
`id: i + 1`). Delete one perspective and every later id shifts on the next load
while `accepted`'s keys don't — acceptance highlights silently attach to the
wrong items. Same fragility class as M2.

### M2 — Parallel arrays `concepts` / `concept_definitions`
`0008:8-9` models definitions as a second `text[]` coupled by index to
`houses.concepts`. `saveHouse` writes both together today, but any future
partial writer (AI draft path, bulk edit) that touches one array mis-aligns
every definition after the edit point. A `jsonb [{term,definition}]` or child
table removes the invariant.

### M3 — `profiles.email` is a write-once copy of `auth.users.email`
`handle_new_user` (0001/0013) copies email at signup; nothing syncs it on email
change. `get_class_roster` (`0014:210-219`) labels students by that stale email
(`lib/classroom/classes.ts:47-52` uses its local-part). Rosters drift from
reality the first time a student updates their address.

### M4 — Join-code collisions fail class creation with no retry
`0014:70-71`: 6 chars of uppercase **hex** (md5) = 16.7M codes. Birthday math:
~3% collision odds by 1,000 classes, >50% by ~4,800. On collision the plain
`insert` (`app/classroom/page.tsx:103`) hits the unique constraint and the
teacher gets a failure. Needs a retry loop server-side and ideally a wider
alphabet (A–Z0–9: 2.2B codes).

### M5 — Per-row SECURITY DEFINER policy cost on teacher views; policy sprawl
Teacher class page queries `houses .in('owner_id', [≤30 ids])`
(`app/classroom/[classId]/page.tsx:73-78`): the owner-id index prunes candidate
rows, but each surviving row still runs the OR-chain of definer functions
(cheap-ish here, unlike C1). The maintainability half: house/child SELECT
policies are rewritten wholesale in 0003, 0004, 0014, 0017, 0020 — every new
visibility rule means another full policy rewrite and another chance to
reintroduce the RETURNING trap. A single `can_read_house(house_row)` style
helper (or view) would centralize it.

### M6 — Client-computed denormalized `status` / `layers_complete`
`0003:13-15` stores derived values the client computes (`persistence.ts:75-88`,
`264-265`) and teacher views trust (`HOUSE_COLUMNS`). A partial save (H1/B1)
or a divergent writer (strawman author, draft mode) leaves the dashboard badge
lying. Also `layers_complete between 0 and 7` hard-codes the layer count into a
CHECK — adding a layer is a migration.

### M7 — Unvalidated jsonb blobs and `select('*')` over-fetch
`house_perspectives.sub_questions/supporting_evidence/counters` (0009),
`houses.ai_context` (0010), `houses.draft` (0022) have no
`CHECK (jsonb_typeof(...) = 'array'/'object')` — a buggy writer can store a
string and every subsequent load silently coerces to `[]`
(`persistence.ts:208-210`). `loadHouse` selects `*` from all four child tables
(`persistence.ts:182-185`) — harmless now, but it fetches the fat jsonb columns
even for views that don't need them.

## Low

- **L1** `ai_usage` (0011) grows one row per subject per day forever; no pruning.
  Tiny rows, but unbounded — a yearly `delete where day < now()-'90 days'` job closes it.
- **L2** No down migrations / reversibility anywhere. Acceptable for a solo
  forward-only project; note it and move on.
- **L3** Convention drift: `houses.title/question` use NULL-means-empty while
  `profiles.*` and `assignments.strawman_*` use `NOT NULL DEFAULT ''`; demo
  names `'maya','devan'` are baked into the `owner_key` CHECKs (`0003:56-57`)
  and will need a migration to ever remove.
- **L4** `house_perspectives.questions` int (0003) duplicates
  `sub_questions` length (`persistence.ts:277`) — vestigial, drop candidate.
- **L5** Assignment reorder issues N parallel single-row UPDATEs
  (`components/classroom/AssignmentPanel.tsx:114`) — N+1 writes, fine at
  classroom scale, batch later.

## Growth math — schools scenario

Assume a modest pilot year: 5 teachers × 4 classes × 30 students = 600 students;
10 assignments/class/term × 2 terms → ~80 submission houses per student-year
plus a few personal ones ≈ **50–90 houses/student, ~40k `houses` rows, ~800k
child rows** (avg ~20 child rows/house). Postgres storage: trivial (<1 GB).

What actually hurts, in order:
1. **C1's dashboard scan** — cost is O(total houses × 3 definer subplans),
   not O(own houses). At 40k rows that's ~1–3s per load and it's every user's
   landing page. First visible degradation, likely at just a few thousand rows.
2. **H1's autosave churn** — one class period: 30 students × a save every ~10s
   × 9 requests = ~27 req/s per class against the pooler, all delete+insert.
   Five concurrent classes ≈ 135 req/s of pure churn; child-table bloat and
   pooler saturation before row counts matter.
3. **Teacher class page (M5)** — linear in students × houses; noticeable but
   bounded (~2k rows × cheap subplans) once C1 is fixed.

First table to hurt: `houses` (via C1). First workload to hurt: autosave (H1).
