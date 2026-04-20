

# Phase 2 — Classrooms (Foundation)

Build the classroom layer: teachers create classrooms with shareable codes, students join via code. No house visibility, comments, or assignments yet — those come in later phases. This phase establishes the data model and entry points the rest of the system will hang off.

## What gets built

### 1. Database schema
- **`classrooms`** table — owner (teacher user_id), name, 6-char alphanumeric code (unique, auto-generated, e.g. `HT-4X9Z`), optional `student_cap` (nullable = unlimited), timestamps.
- **`classroom_members`** table — classroom_id + student user_id (unique together) + joined_at.
- RLS:
  - Teachers can CRUD their own classrooms.
  - Students can SELECT classrooms they belong to (read-only, only the classroom they joined).
  - Students can INSERT themselves into `classroom_members` only via a SECURITY DEFINER function `join_classroom(code text)` that validates the code, enforces "one classroom per student," and respects the cap.
  - Teachers can SELECT/DELETE rows in `classroom_members` for classrooms they own (used to view roster + remove students).
- Helper SECURITY DEFINER functions: `join_classroom(code)`, `leave_classroom()`, `regenerate_classroom_code(classroom_id)`, `is_classroom_owner(classroom_id)`.

### 2. Entry points (left rail)
A new icon button is added to the analysis page left rail **directly above the Research Mode button** (students) / equivalent slot (teachers):
- **Student**: "My Classroom" icon → opens `/classroom` (their join/leave page).
- **Teacher**: "Classrooms" icon → opens `/classrooms` (their classroom dashboard).
- **Standard**: button hidden entirely.

The same entry button also appears on the main `Dashboard` page header so it's reachable without opening a house.

### 3. Teacher Classroom Dashboard (`/classrooms`)
- List of the teacher's classrooms as cards: name, code (with one-click copy), student count, "Open" button.
- **+ Create Classroom** button → modal asking for name and optional student cap (number input, blank = unlimited).
- Clicking a card opens `/classrooms/:id` showing:
  - Classroom name (editable inline) and code with copy button.
  - **Regenerate code** button with confirmation ("Old code stops working immediately. Existing students stay enrolled.").
  - **Edit cap** inline.
  - **Roster table**: student display name (from profile / fallback to email), date joined, **Remove** button per row with confirmation dialog.
  - **Delete classroom** button (destructive, confirmation modal warning all students will be unlinked).

### 4. Student Classroom Page (`/classroom`)
- If not in a classroom: input field "Enter classroom code" + Join button. Shows inline error on invalid/expired code, or cap-reached message.
- If already in a classroom: shows teacher name + classroom name + green confirmation indicator + **Leave Classroom** button (confirmation dialog: "Your work stays yours. You will be unlinked from this classroom.").
- Attempting to join a second classroom is blocked at the DB function level; UI surfaces the error with a Leave button.

### 5. Removal/leave semantics (Phase 2 only)
- Removing a student or leaving a classroom simply deletes the `classroom_members` row.
- Phase 2 has nothing to revoke beyond the link itself. Per your preference: in future phases, when comments/assignments exist, students keep all comment threads and assignment submissions; teachers lose all access. We will design the cascade rules into the Phase 3 schema accordingly — no special wiring needed now.

### 6. Permissions plumbing
- Extend `src/lib/permissions.ts` with `canCreateClassrooms` (teacher only) and `canJoinClassroom` (student only). The new left-rail button reads from `usePermissions`.
- No Standard-account changes.

## Explicitly NOT in Phase 2 (saved for later phases)
- Teacher viewing student houses (read-only mode). Per your direction, teachers will only see student work via assignment submissions in a later phase — no general house viewing.
- Comments, replies, feedback history.
- Assignments, due dates, submission tracking, "Start Assignment" pre-filled houses.
- Notification bell, unread badges.
- Cross-account data revocation rules (will be designed alongside Phase 3 comments/assignments).

## Technical details

**New files**
- `src/pages/TeacherClassroomsPage.tsx` — list + create.
- `src/pages/TeacherClassroomDetailPage.tsx` — single classroom (roster, code, cap, regenerate, delete).
- `src/pages/StudentClassroomPage.tsx` — join/leave UI.
- `src/components/classroom/ClassroomCard.tsx`, `RosterTable.tsx`, `ClassroomCodeBadge.tsx`, `CreateClassroomDialog.tsx`.
- `src/hooks/useClassrooms.ts` (teacher) and `useMyClassroom.ts` (student) — typed Supabase queries.

**Edited files**
- `src/lib/permissions.ts` — add `canCreateClassrooms`, `canJoinClassroom`.
- `src/pages/AnalysisPage.tsx` — add classroom icon button to the left rail above the Research/Sidebar entry.
- `src/pages/Dashboard.tsx` — add classroom entry button in the header (teacher and student only).
- `src/App.tsx` — add three protected routes.

**Migrations**
- `classrooms`, `classroom_members`, indexes on `code` and `(classroom_id, student_id)`.
- SECURITY DEFINER functions for join/leave/regenerate so RLS stays tight.
- Trigger to auto-generate code on insert if blank, enforce uppercase, retry on collision.

**RLS policy summary**
```text
classrooms          : teacher CRUD own; student SELECT only classrooms they belong to (via join)
classroom_members   : teacher SELECT/DELETE for own classrooms; student SELECT own row;
                      INSERT only via join_classroom() SECURITY DEFINER function;
                      DELETE own row via leave_classroom() function
```

**Code format**: `HT-XXXX` where XXXX is 4 random alphanumeric chars (excluding ambiguous 0/O/1/I), generated server-side.

