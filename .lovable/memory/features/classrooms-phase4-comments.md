---
name: Classrooms Phase 4 — Comments
description: Three comment surfaces (submission, inline, assignment-wide), per-assignment audience mode, in-app unread badges, author edit/delete + student resolve.
type: feature
---

Three comment surfaces, all backed by `public.comments`:
- **submission**: per-submission private thread (teacher ↔ that student)
- **inline**: per-section comments anchored by `target_kind` (sub_question / concept / assumption / pov_label / staging_item / staging_group / overarching_conclusion / consequences) + `target_id`
- **assignment**: assignment-wide; teacher posts, all enrolled students read. Phase 4 has no student replies on this surface.

`assignments.comment_audience` (`one_way` | `two_way`, default `two_way`) controls whether students can reply on submission/inline threads. Teachers always can.

RLS via security-definer helpers `can_view_comment(id)` and `can_post_comment(assignment_id, target_type, submission_id)`. Mutations go through RPCs: `post_comment`, `edit_comment`, `delete_comment`, `resolve_comment`, `unresolve_comment`, `mark_comments_read`, `unread_comment_counts`.

Resolve is student-only on their own submission/inline comments. Author can edit (sets `edited_at`) and delete; teacher can also delete any comment in their assignment.

Unread badges driven by single RPC `unread_comment_counts()` returning `{assignment_id, submission_id, count}`. Hook `useUnreadComments` exposes `total`, `byAssignment(id)`, `bySubmission(id)`. Threads auto-mark read via `markCommentsRead(ids)` when rendered.

Realtime: `comments` and `comment_reads` are added to `supabase_realtime` and use `REPLICA IDENTITY FULL`.

Attachments: `can_view_attachment` / `can_attach_to` `'comment'` branch now inherit the parent comment's audience (author owns; viewers = `can_view_comment`).

Components: `CommentThread`, `CommentPill`, `InlineCommentDrawer`. Hooks: `useComments`, `useUnreadComments`.
