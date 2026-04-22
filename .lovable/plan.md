

# Phase 4 — Comments

Three comment surfaces, per-assignment privacy mode, in-app unread badges, author edit/delete + student "resolve."

## 1. Three comment surfaces

| Surface | Where | Anchor | Audience |
|---|---|---|---|
| **Submission thread** | Teacher's "Response from {student}" dialog + student's assignment card | `submission_id` | teacher ↔ that one student |
| **Inline (per-section)** | A "Comments" pill button next to each *sub-question, concept, assumption, POV label, staging item/group, consequences block, overarching conclusion* in the read-only teacher view AND the student's working view | `analysis_id` + `target_type` + `target_id` | teacher ↔ that one student |
| **Assignment-wide** | New tab on the teacher's assignment page and on the student's assignment card titled "Discussion" | `assignment_id` | teacher writes, all enrolled students read (Phase 4: still no student replies on assignment-wide threads — group chat is deferred) |

Submission and inline threads honor the **per-assignment privacy mode** the teacher picks at creation time:
- **One-way (teacher → student):** student can only read. UI hides the student's reply box.
- **Two-way private:** student can post replies on their own submission/inline threads only.

## 2. Data model (one new migration)

New enum + tables (RLS on all):

```text
type comment_target_type = 'submission' | 'inline' | 'assignment'
type comment_audience    = 'one_way' | 'two_way'   -- copied from assignment for fast checks

assignments
  + comment_audience  comment_audience NOT NULL DEFAULT 'two_way'

comments
  id              uuid PK
  assignment_id   uuid NOT NULL              -- always set, anchors permission checks
  submission_id   uuid NULL                  -- set for 'submission' + 'inline'
  analysis_id     uuid NULL                  -- set for 'inline'
  target_type     comment_target_type NOT NULL
  target_kind     text NULL                  -- e.g. 'sub_question','concept','assumption',
                                             -- 'pov_label','staging_item','staging_group',
                                             -- 'overarching_conclusion','consequences'
  target_id       uuid NULL                  -- the row being commented on (NULL for whole-house targets)
  author_id       uuid NOT NULL              -- auth.uid()
  author_role     text NOT NULL              -- 'teacher' | 'student' (denormalized for display)
  body            text NOT NULL
  resolved_at     timestamptz NULL           -- set when student resolves an inline/submission comment
  resolved_by     uuid NULL
  edited_at       timestamptz NULL
  created_at      timestamptz NOT NULL DEFAULT now()

comment_reads
  comment_id  uuid
  user_id     uuid
  read_at     timestamptz NOT NULL DEFAULT now()
  PRIMARY KEY (comment_id, user_id)
```

### RLS via security-definer helper

```text
can_view_comment(c) :=
  ( target_type='assignment'   AND is_classroom_member(a.classroom_id) ) OR
  ( target_type='assignment'   AND a.teacher_id = auth.uid() )           OR
  ( target_type IN ('submission','inline') AND
      ( s.student_id = auth.uid() OR a.teacher_id = auth.uid() ) )

can_post_comment(c) :=
  teacher  → always allowed on their own assignment
  student  → only on target_type IN ('submission','inline'), only when
             a.comment_audience='two_way', only on their OWN submission
```

`SELECT/INSERT/UPDATE/DELETE` policies: author can `UPDATE`/`DELETE` own row; teacher can `DELETE` any comment in their assignment (moderation); student can `UPDATE` only `resolved_at`/`resolved_by` on inline + submission comments tied to their own submission (the "resolve" action). `comment_reads`: each user reads/inserts their own rows.

Also wire up the previously-stubbed `'comment'` branch in `can_view_attachment` and `can_attach_to` to inherit the parent comment's audience (so a teacher can attach a file to a comment; same viewers as the parent thread).

## 3. RPCs

- `post_comment(assignment_id, target_type, target_kind, target_id, submission_id, analysis_id, body)` — validates audience + ownership, stamps `author_role`, returns the row.
- `edit_comment(id, body)` — author only; sets `edited_at = now()`.
- `delete_comment(id)` — author or assignment teacher.
- `resolve_comment(id)` / `unresolve_comment(id)` — student-on-own-submission only; toggles `resolved_at`.
- `mark_comments_read(ids[])` — bulk insert into `comment_reads` (ON CONFLICT DO NOTHING).
- `unread_comment_counts()` — returns `{ assignment_id, submission_id, count }[]` for the current user, used to drive badges in one query.

## 4. UI

**Teacher**
- `CreateAssignmentDialog.tsx` — add a Privacy radio: *One-way (teacher only)* / *Two-way (student can reply)*. Stored on `assignments.comment_audience`.
- `TeacherAssignmentDetailPage.tsx` — new "Discussion" card above Submissions. Shows assignment-wide comments (teacher-post only this phase).
- `SubmissionResponseDialog.tsx` — append a `<CommentThread>` panel under the existing response/attachments. Threaded list, composer at bottom (or read-only banner if one-way).
- Read-only teacher analysis view — every house element renders a small "💬 N" pill (red dot if unread). Click opens a side `<InlineCommentDrawer>` listing all inline comments for that target with composer.

**Student**
- `StudentClassroomPage.tsx` / `AssignmentsList.tsx` — assignment row gets an unread badge sourced from `unread_comment_counts()`. Clicking the assignment expands to show "Discussion" (read-only) and "Teacher feedback on your submission" sections.
- Working analysis pages — same inline pill on every commentable element. Student opens the drawer, reads, can resolve, and (if two-way) reply.
- `Dashboard.tsx` — small badge next to the **Classrooms** button when total unread > 0.

**Shared**
- New `<CommentThread>` component — list + composer + edit-in-place + delete-with-confirm + "edited" marker + resolved chip.
- New hook `useComments({ assignment_id, submission_id?, target?: {kind,id} })` — fetches, subscribes via Supabase realtime, exposes mutate helpers.
- New hook `useUnreadComments()` — single query backing all badges; auto-marks-read when a thread is opened.

## 5. Memory

- New: `mem://features/classrooms-phase4-comments.md` — surfaces, audience modes, RLS pattern, resolve semantics, badge query.
- Update `mem://index.md` Memories index with one line referencing the new file. No Core change needed.

## 6. Files

**New migration** — enum, `comments`, `comment_reads`, `assignments.comment_audience` column, RLS policies, all RPCs, helper functions, realtime publication adds for both tables.

**New components/hooks**
- `src/components/comments/CommentThread.tsx`
- `src/components/comments/CommentPill.tsx`
- `src/components/comments/InlineCommentDrawer.tsx`
- `src/hooks/useComments.ts`
- `src/hooks/useUnreadComments.ts`

**Edited**
- `src/components/classroom/CreateAssignmentDialog.tsx` — privacy radio
- `src/components/classroom/SubmissionResponseDialog.tsx` — embed `<CommentThread target_type="submission">`
- `src/components/classroom/AssignmentsList.tsx` — unread badge
- `src/pages/TeacherAssignmentDetailPage.tsx` — Discussion card
- `src/pages/StudentClassroomPage.tsx` — assignment expansion with Discussion + feedback
- `src/pages/Dashboard.tsx` — badge on Classrooms button
- All read-only/working house section components (sub-questions, concepts, assumptions, POVs, staging, consequences, overarching) — render `<CommentPill>` when inside a submission context

## 7. Edge cases

- **Switching account types** mid-classroom: comments are scoped via assignment/submission, so the existing partition rules already hide them when the relevant `classroom_members` / `analyses` rows are hidden.
- **Teacher deletes assignment**: cascade-deletes `comments` and `comment_reads`.
- **Student withdraws submission** (unsubmit): comments persist; teacher's view-of-submission RLS already handles this.
- **One-way → two-way switch later**: changing `comment_audience` on the assignment immediately enables student replies; existing one-way comments stay.

