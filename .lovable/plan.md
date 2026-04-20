

# Phase 3 — Assignments

Phase 3 builds the assignment system: teachers create assignments inside a classroom (with a due date and one of three starting-house modes), students see them on their classroom page, "start" the assignment to get a linked house, work on it, and submit. Teachers see a submission table per assignment with read-only access to each submitted house. **Comments move to Phase 4** and will attach to these submissions.

## What gets built

### 1. Assignment creation modes (teacher chooses per assignment)
- **Empty** — student gets a blank house tagged to the assignment. Just title, prompt, due date.
- **Pre-filled question** — teacher provides the overarching question (and optional sub-purposes); student's house is created with those fields pre-populated.
- **Template clone** — teacher picks one of their own existing houses as a template; when a student starts the assignment, the entire house is deep-cloned (concepts, sub-questions, POV labels, assumptions, staging — but no test results or chats) into the student's account.

### 2. Database schema
- **`assignments`** — id, classroom_id, teacher_id, title, prompt (text), due_at (timestamptz, nullable = no due date), mode (`empty` | `prefilled` | `template`), prefilled_question (text, nullable), prefilled_sub_purposes (text, nullable), template_analysis_id (uuid, nullable, FK to teacher's own analysis), created_at, updated_at.
- **`assignment_submissions`** — id, assignment_id, student_id, analysis_id (the student's house), status (`in_progress` | `submitted`), started_at, submitted_at (nullable). Unique on (assignment_id, student_id).
- **`analyses`** — add nullable column `assignment_submission_id` so a house knows it belongs to a submission (used for read-only teacher access and the student's "Submitted" badge).

### 3. RLS + SECURITY DEFINER functions
- **`assignments`**: teachers CRUD their own; students SELECT assignments in their classroom (via `is_classroom_member`).
- **`assignment_submissions`**: students SELECT/UPDATE their own row; teachers SELECT/DELETE rows for their own assignments. INSERT only via `start_assignment(p_assignment_id)` RPC which validates membership, creates/clones the analysis, and inserts the submission row atomically.
- **`analyses` teacher read access**: extend RLS so a teacher can SELECT an analysis if it is the `analysis_id` of a submission for an assignment they own — read-only. New helper `can_teacher_view_analysis(p_analysis_id)`. Mirror this for `concepts`, `sub_questions`, `pov_labels`, `assumptions`, `staging_groups`, `staging_items`, `staging_group_items` so the whole house is visible.
- **`submit_assignment(p_submission_id)`** RPC — sets status to `submitted` and stamps `submitted_at`. Owned by the student.
- **`unsubmit_assignment(p_submission_id)`** RPC — student can pull back a submission before grading exists (will be locked once Phase 5 grading lands).
- Submitted houses become **read-only for the student** while status is `submitted` (UI gate; DB still allows their writes so unsubmit works cleanly).

### 4. Teacher UI
- **Classroom detail page (`/classrooms/:id`)** — add an **Assignments** tab next to the existing roster. Shows a list of assignments (title, mode badge, due date, submission count `5/12 submitted`).
- **+ New Assignment** button → modal: title, prompt (textarea), due date (optional), mode picker. Mode picker reveals different fields:
  - Empty: nothing extra.
  - Pre-filled: question input + optional sub-purposes textarea.
  - Template: dropdown of the teacher's own existing analyses.
- **Assignment detail (`/classrooms/:id/assignments/:assignmentId`)** — header (title, prompt, due date, edit/delete buttons), submissions table (student name, status badge, started_at, submitted_at, **View house** button). Clicking "View house" opens the student's analysis in a read-only mode.
- **Read-only house view**: reuse `AnalysisPage` with a `?readonly=1` flag (or a small wrapper) that hides editing UI, AI sidebar, builder edits, and shows a "Viewing as teacher" banner.

### 5. Student UI
- **Student classroom page (`/classroom`)** — add an **Assignments** section listing all assignments in their classroom, sorted by due date. Each row shows: title, due date (with overdue badge), status (`Not started` | `In progress` | `Submitted`), and an action button:
  - Not started → **Start Assignment** (calls `start_assignment` RPC; navigates to the new house).
  - In progress → **Open** (navigates to the house) and **Submit** button.
  - Submitted → **View** (read-only) and **Unsubmit** button.
- **Assignment-linked house** — `AnalysisPage` shows a top banner when the analysis has an `assignment_submission_id`: "Assignment: {title} · Due {date} · {status}" with a **Submit** button (or **Unsubmit**) inline. Submit triggers a confirmation dialog.

### 6. Permissions plumbing
- Extend `src/lib/permissions.ts`:
  - `canCreateAssignments` (teacher only)
  - `canStartAssignments` (student only)
- Standard accounts see no assignment UI anywhere.

### 7. Removal/leave semantics
- If a student is removed from a classroom OR leaves: their submissions stay theirs (the house is still in their dashboard), but the teacher loses the read-only RLS link automatically because membership is gone — `can_teacher_view_analysis` returns false. This matches your "students keep everything, teachers lose access" rule from Phase 2.
- Deleting an assignment: marks submissions detached (the houses remain in students' accounts, the teacher view link is broken). Confirmation dialog spells this out.

## Explicitly NOT in Phase 3 (saved for later phases)
- Comments (per-section, per-bullet, overall) — **Phase 4**, attaching to submissions built here.
- Grading, scores, rubrics — Phase 5.
- Notification bell + unread badges — Phase 6.
- General teacher access to non-assignment student houses (still off, per your direction).

## Technical details

**New files**
- `src/pages/TeacherAssignmentDetailPage.tsx` — submission roster + read-only house viewer entry.
- `src/components/classroom/AssignmentsList.tsx` (used by both teacher detail and student classroom pages, with role-aware actions).
- `src/components/classroom/CreateAssignmentDialog.tsx` — three-mode form.
- `src/components/classroom/SubmissionsTable.tsx`.
- `src/components/classroom/AssignmentBanner.tsx` — top-of-house banner for student.
- `src/hooks/useAssignments.ts` (teacher), `useStudentAssignments.ts` (student).

**Edited files**
- `src/lib/permissions.ts` — add two gates.
- `src/App.tsx` — add `/classrooms/:id/assignments/:assignmentId` route.
- `src/pages/TeacherClassroomDetailPage.tsx` — add Assignments tab.
- `src/pages/StudentClassroomPage.tsx` — add Assignments section.
- `src/pages/AnalysisPage.tsx` — read `assignment_submission_id`, show banner, gate editing in `readonly` mode.
- `src/integrations/supabase/types.ts` — auto-regenerated.

**Migrations**
- Create `assignments`, `assignment_submissions`; add `analyses.assignment_submission_id`; indexes on `(classroom_id)`, `(assignment_id, student_id)`.
- Helper functions `can_teacher_view_analysis`, `can_teacher_view_via_assignment` (checks assignment ownership + classroom membership at submission time).
- RPCs `start_assignment`, `submit_assignment`, `unsubmit_assignment`, plus a private `_clone_analysis(src, target_user)` helper for template mode.
- Extend SELECT policies on child tables (`concepts`, `sub_questions`, `pov_labels`, `assumptions`, `staging_*`) with an additional permissive policy: `can_teacher_view_analysis(analysis_id)`.

**Read-only mode**
- `AnalysisPage` and the section pages (`/analysis/:id/concepts` etc.) accept `?readonly=1`. When set: disable inputs, hide AI sidebar/research/logic/stress buttons, hide save/delete actions, show "Viewing as teacher" pill. The teacher's "View house" button always appends this query param.

**Cloning (template mode)**
- `start_assignment` RPC, when `mode = 'template'`, runs `_clone_analysis` which: inserts a new `analyses` row owned by the student, then copies `concepts`, `pov_labels`, `sub_questions` (with new ids and remapped `pov_label_id`), `assumptions` (remapped `sub_question_id`), and `staging_*` rows. Skips `test_results`, `sidebar_chats`, `draft_runs`. Sets `assignment_submission_id` on the new analysis.

