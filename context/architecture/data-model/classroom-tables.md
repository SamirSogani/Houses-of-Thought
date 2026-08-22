# Classroom Tables

Teacher/student features layered on top of the house tables. A student's
submission is an ordinary `houses` row; these tables add the class structure
around it and a teacher's read-only visibility into it.

## `profiles` — mutable, one per user

Migration 0001 (originally hand-run in the Supabase SQL editor before
migrations existed — see its header). Mirrors `auth.users` via the
`on_auth_user_created` trigger. `account_type` (`standard`/`student`/`teacher`,
0002) is chosen once at signup and then **pinned**: migration 0026 rewrote the
owner-update policy to add a `with check` that forbids changing
`account_type` through an ordinary UPDATE, closing a broken-access-control
finding where a student could PATCH their own profile to `teacher`. The
`reconcile_signup_role()` RPC is the only sanctioned way to promote a fresh
account from the trigger's `standard` fallback to what was actually chosen at
signup, and only within 10 minutes of profile creation — see the migration's
own header for the full model.

## `classes` / `class_members`

Migration 0014. A teacher creates a class with an auto-generated shareable
`join_code`; `join_class(code)` (SECURITY DEFINER RPC) is how a student
self-joins — direct inserts into `class_members` are teacher-only by policy,
so self-join has to go through the RPC. `classes_insert` additionally requires
`is_teacher()` (migration 0026) — the DB, not just the UI, decides who may
create a class.

## `assignments` / `courses`

Migration 0015 adds assignments (a teacher-posed question per class);
migration 0016 adds courses (ordered groupings of a class's assignments,
scoped to one class, not a free-floating template). A student's house for an
assignment is created lazily by `open_assignment()` on first open — this
keeps ownership on the student (RLS never lets a teacher insert a
student-owned row) and handles late joiners for free.

## Strawman exercise (migration 0017, gated by 0024)

"Attack the strawman": a teacher generates one flawed argument, owned by the
teacher (`houses.is_strawman = true`, `assignments.strawman_house_id`), and
every student in the class attacks the same house read-only. Two things
worth knowing:

- `open_assignment()` was redefined (0017) to explicitly skip strawman houses
  so a student's own submission and the assignment's strawman never collide.
- **Release gate (0024):** the strawman house used to become visible to
  students the moment `ensure_strawman_house()` linked it — before the
  teacher had reviewed or revised the AI-generated content. `strawman_released`
  now gates `can_view_assignment_strawman()`; regeneration un-releases it.
  Existing live strawmen were grandfathered to `released = true` so an
  in-flight class didn't lose its exercise the moment this shipped.

## `submission_feedback` — mutable, one row per house

Migration 0018. Deliberately its own table (`house_id` primary key), not
columns on `houses` — this is the one place a teacher gets *write* access
tied to a student's house, and keeping it a separate table means that access
never widens to the student's actual content.

## Teacher visibility into student houses

`can_view_student_house(hid)` (0014) — true when the caller teaches a class
the house's owner belongs to. This only ever widens **SELECT** on `houses` and
its four child tables; INSERT/UPDATE/DELETE stay on the owner/editor checks
from [house-tables.md](house-tables.md). Chosen over minting
`house_collaborators` rows so visibility stays correct automatically as
students create new houses, with no trigger or backfill needed.

`get_class_roster(cid)` is a SECURITY DEFINER RPC, not a direct `class_members`
join — a teacher can't SELECT `profiles` rows directly (owner-only RLS), so
the roster has to be assembled server-side inside the function.

See [access-control.md](access-control.md) for the full helper-function list
and [edge-cases.md](edge-cases.md) for the `houses_select` policy history —
0014 and 0017 each reintroduced the `INSERT … RETURNING` self-query trap that
0006 had already fixed once, before 0020 fixed it for good.
