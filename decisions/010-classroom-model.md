# Decision 010 — Classroom Model (account types → teacher/student system)

**Date:** 2026-07-10
**Status:** Decided & implemented (migrations 0013–0018; pending live apply + E2E test)
**Migrations:** `0013_signup_role` … `0018_submission_feedback`

## Context

Houses of Thought is education-led (teacher→student) by [decision 001](001-founding-decisions.md) §1,
and multi-user was always scoped to "classrooms" (001 §2). [Decision 003](003-collaboration-model.md)
built the `house_collaborators` foundation and explicitly **deferred reconciling with the
classrooms concept** until the feature was designed. This is that design. It turns the
dormant `profiles.account_type` skeleton into a full teacher/classroom product, built in six
shippable phases.

## Decisions made

### 1. Capabilities are one source of truth; gates are server-side
- `lib/auth/capabilities.ts` maps `AccountType` → `{ aiPosture, forcedMode, canCreateClasses,
  canViewOthersHouses, … }`, imported by both client (cosmetic) and server (authoritative).
- Students are pinned to **Learn/Coach** posture ([decision 007](007-ai-roles-and-audience.md)):
  the mode toggle is locked client-side **and** `/api/ai/suggest` clamps mode server-side.
- Resolved two stale copy conflicts in `lib/profile/data.ts`: "Draft Full House" is dead
  (001 §3) for everyone; students **do** get AI, only Learn-mode.

### 2. Classes join via self-serve code; access via SECURITY DEFINER helpers
- `classes` (teacher-owned, auto `join_code`) + `class_members`. Students self-join with the
  `join_class(code)` RPC (bypasses the tight member-insert policy under `SECURITY DEFINER`).
- `is_class_teacher` / `is_class_member` follow the `can_access_house` anti-recursion pattern
  from 003. Roster identity is read via `get_class_roster(cid)` because a teacher cannot
  `select` student `profiles` directly (self-only RLS).

### 3. Teacher read-into-student-houses via RLS widening — NOT collaborator rows
- The plan tentatively favored minting `house_collaborators` viewer rows. We instead widened
  the **SELECT** policies with `can_view_student_house(hid)`.
- **Why:** collaborator rows would need triggers on house creation + backfill on join +
  cleanup on leave; the RLS helper stays correct automatically. Only SELECT is widened —
  UPDATE/INSERT/DELETE stay owner+editor, so teachers genuinely cannot edit student work.
- **Regression + fix (0020):** 0014/0017 rewrote `houses_select` to lead with
  `can_access_house(id)`, which self-queries `houses` and re-broke `INSERT ... RETURNING`
  (the decision 004 trap). `0020` restores a direct `owner_id = auth.uid()` owner check and
  keeps the classroom read branches. Rule: never sub-query a table inside its own RLS policy.

### 4. Assignments seed houses lazily, not eagerly
- `assignments` (class-scoped) + `houses.assignment_id`. Rather than fan-out at creation
  (impossible: `houses` INSERT is owner-only, a teacher can't insert student-owned rows), the
  student's house is created on first open via `open_assignment(aid)` (`SECURITY DEFINER`,
  validates membership). Handles late joiners; no empty placeholder houses.

### 5. Courses are class-scoped ordered units, not reusable templates
- `courses.class_id` + `assignments.course_id`/`position`. The plan sketched teacher-owned
  reusable templates; that would require splitting "assignment templates" from concrete
  per-class assignments (a Phase-3 rewrite). Class-scoped delivers the value (sequenced units
  a class works through) reusing the existing class RLS. Reusable templates can be additive later.

### 6. Strawman is teacher-authored — the sole sanctioned AI-author use
- Per 007, the AI may author only a **labeled strawman to critique**. One teacher-owned
  strawman house per assignment (`is_strawman`, `assignments.strawman_house_id`), generated
  with teacher params (grade level, age, extra topics, criteria), reviewed/revised, then
  released. Students attack that shared house read-only (`can_view_assignment_strawman`).
- `/api/ai/strawman` uses a **self-contained** system prompt (the shared `PERSONA`'s
  conclusion-ban is untouched everywhere else) and is **doubly gated**: `ai_strawman_enabled`
  **and** class-teacher, both server-verified.

### 7. Assessment lives in its own table
- `submission_feedback` (grade + feedback) is separate from `houses` so a teacher recording a
  grade never gains write access to student house content. Teacher writes via
  `can_view_student_house`; student reads their own row. Grading reuses `/api/ai/critique`.

## Read-only builder posture
- A viewer who is not the house owner (teacher on a student house, or student on the shared
  strawman) opens `/build/[id]` with autosave disabled and write-affordances off; a banner
  states the mode. The teacher owns and **can** revise their own strawman.

## Deferred / open

- Reusable cross-class course templates (see §5).
- DB-level check that `assignment.course_id` and a linked house's assignment share the class
  (UI already scopes this; only a hand-crafted teacher request could violate it).
- Full input-level lockdown of the read-only builder (autosave-off is the safety guarantee today).
- `house_collaborators` (003) remains the primitive for future peer collaboration; classrooms
  deliberately do **not** use it (§3).
- Live apply of 0013–0018 and an end-to-end pass (RLS is the highest-risk surface).
