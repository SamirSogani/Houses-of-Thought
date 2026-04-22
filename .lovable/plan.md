

# Partition data per account type

Each user has one login but three independent "workspaces" (Standard / Student / Teacher). Switching account type hides the other workspaces' data; switching back fully restores it. Nothing is ever deleted.

## What gets partitioned

Each row that belongs to a user gets stamped with the account type that was active when it was created, then RLS only shows rows whose stamp matches the user's *current* `profiles.account_type`.

| Table | New column | Notes |
|---|---|---|
| `analyses` | `owner_account_type` | Set on insert from current profile.account_type. Public read (`is_public=true`) and the teacher-view-of-submission policy are unaffected — those are cross-type by design. |
| `classrooms` | `owner_account_type` | A teacher's classrooms are only visible while the user is in Teacher mode. |
| `classroom_members` | `owner_account_type` | A student's joined classroom is only visible while the user is in Student mode. The cap check inside `join_classroom` still counts everyone regardless of type. |

Profile fields stay shared (one username, one email, one set of profile context). That matches your "shared login" answer.

## How "current account type" is read in RLS

Add a security-definer helper:

```sql
create function public.current_account_type()
returns public.account_type
language sql stable security definer set search_path = public
as $$ select account_type from public.profiles where user_id = auth.uid() $$;
```

RLS `SELECT` policies on the three tables become:
```
user_id = auth.uid() AND owner_account_type = public.current_account_type()
```
INSERT policies force the new column to equal `current_account_type()` so a row can never be created in the "wrong" partition. UPDATE/DELETE policies keep the same partition check so a user in Standard mode can't even reach their Teacher-mode rows by ID guessing.

The cross-type SELECT policies stay untouched:
- `analyses_public_read` (anyone with the link)
- `analyses_teacher_view_submission` + the `*_teacher_view_submission` child policies (teachers reviewing student submissions — works because the teacher *is* in Teacher mode when reviewing)

## Backfill (one-time, per-user)

For every existing row, stamp `owner_account_type` with the owner's current `profiles.account_type` (defaulting to `standard`). This means existing users see all their old data exactly as before — it just becomes "Standard data" by default. If they later switch to Teacher and don't see their old houses, that's correct: those houses live in their Standard workspace.

We won't try to be clever about classroom rows — owners (teachers) get them stamped Teacher, members (students) get them stamped Student.

## RPC updates

- `join_classroom(code)` — sets `owner_account_type = current_account_type()` on the new `classroom_members` row. Still rejects if the user already has a membership *in their current account type* (so a Standard user could join one classroom, switch to Student, join a different one, and have both — each visible only in its own mode). Cap check still counts all members.
- `leave_classroom()` — only deletes the membership for the *current* account type.
- `start_assignment(...)` — when it creates a new analysis for a student submission, stamp it `owner_account_type = 'student'` (not `current_account_type()`), because submissions intrinsically belong to the Student workspace.
- `_clone_analysis(...)` — same: the clone lands in the target user's Student workspace.

## UI: switching with a confirmation dialog

`ProfilePage.tsx` — wrap the account-type buttons in a confirmation dialog when the user clicks a different type:

> Switch to **Teacher**?
>
> Your **Standard** workspace will be hidden, including:
> - 4 houses you've created
> - any open analyses
>
> Nothing is deleted. Switching back to Standard will restore everything.
>
> [Cancel]  [Switch to Teacher]

The dialog fetches counts live via three small queries (count of `analyses` in current type, classroom memberships in current type, classrooms owned in current type) so the message reflects what's actually being hidden. After confirm:
1. Update `profiles.account_type`.
2. Navigate to `/dashboard` (hard reset — no stale in-memory analysis from the prior workspace).
3. Toast: "Switched to Teacher. Your Standard workspace is preserved."

## Edge cases handled

- **Open analysis when switching**: the post-switch redirect to `/dashboard` prevents the user from sitting on a route like `/analysis/<id-from-old-workspace>`. If they bookmark such a URL and visit it later in the wrong mode, RLS returns nothing → existing "Not found" UI shows.
- **Username uniqueness**: unchanged. One username per user.
- **Public shared analyses**: still readable across types via the unchanged public-read policy.
- **Teacher reviewing a student submission**: still works — teacher is in Teacher mode, and `can_teacher_view_analysis` is independent of `owner_account_type`.
- **Auto-attached `assignment_submission_id`**: a Standard-mode user cannot have submissions, so this column stays NULL for non-student-partition analyses.

## Files

**New migration**
- Add `owner_account_type account_type not null default 'standard'` to `analyses`, `classrooms`, `classroom_members`.
- Backfill from each owner's current `profiles.account_type`.
- Create `public.current_account_type()`.
- Replace `analyses_select`, `analyses_insert`, `analyses_update`, `analyses_delete` to add the partition check (keep `analyses_public_read` and `analyses_teacher_view_submission` as-is).
- Same treatment for `classrooms_*` and `classroom_members_*` policies (keep teacher-view and member-of-my-classroom policies cross-type).
- Update `join_classroom`, `leave_classroom`, `start_assignment`, `_clone_analysis` to write/filter by `owner_account_type`.

**Edited code**
- `src/pages/ProfilePage.tsx` — add a confirmation `<AlertDialog>` around `updateAccountType` that loads and shows the counts of what will be hidden; redirect to `/dashboard` on confirm.
- `src/pages/Dashboard.tsx` — no change needed (RLS handles filtering); optional small banner: "You're in **Student** mode — your Standard houses are hidden until you switch back."
- `src/hooks/useMyClassroom.ts` and `src/hooks/useClassrooms.ts` — no query changes needed (RLS filters automatically).

**Memory updates**
- New: `mem://features/account-type-partitioning.md` — documents the partitioning rule, the `current_account_type()` helper, and the cross-type exceptions (public read, teacher-view-of-submission).
- Update `mem://index.md` Core: add one line — "Each account type is an independent workspace; `analyses`, `classrooms`, `classroom_members` are partitioned by `owner_account_type` matching `profiles.account_type` via RLS. Public analyses and teacher-view-of-submission cross types intentionally."

