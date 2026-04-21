

# Auto-save Profile + tighten Student/Teacher gating

Four small changes.

## 1. Auto-save profile (no Save button)

In `src/pages/ProfilePage.tsx`:
- Remove the **Save Profile** button at the bottom and the `saving` state.
- Add a debounced auto-save (500ms) that fires whenever any of the eight text fields change after the initial load: `biological`, `social`, `familial`, `individual`, `about_me`, `role_title`, `location_context`, `current_project`.
- Use **upsert** (`onConflict: 'user_id'`) instead of `update` so it works even if the profile row is missing for that user. Same fix applied to the account-type buttons (which already auto-save on click).
- Show a tiny status indicator next to the "Your Profile" heading: `Saved` / `Saving…` / `Save failed — retry` with a small icon. No toast spam on every keystroke; only show toast on actual error.
- Guard against firing the auto-save during the initial load (track an `isLoadedRef`).

## 2. Lock down student permissions

In `src/lib/permissions.ts`, the `STUDENT_PERMISSIONS` object becomes:
- `canCreateClassrooms: false`
- `canCreateAssignments: false`
- (new) `canRegenerateClassroomCode: false`
- (new) `canDeleteClassroom: false`
- `canJoinClassroom: true` (unchanged)
- `canStartAssignments: true` (unchanged)

Add the two new fields to the `Permissions` interface and to `STANDARD_PERMISSIONS` / `TEACHER_PERMISSIONS` (both `true`).

## 3. Apply the new gates in the UI

- **`src/pages/Dashboard.tsx`**: the header already gates **Classrooms** behind `permissions.canCreateClassrooms`, so it now hides for students automatically — no change needed there beyond removing the "My Classroom" button (see #4).
- **`src/pages/TeacherClassroomsPage.tsx`**: wrap the page in a permission check — if `!permissions.canCreateClassrooms`, redirect to `/dashboard`. Hide the **Create Classroom** button as a defense-in-depth (the route guard is the primary gate).
- **`src/pages/TeacherClassroomDetailPage.tsx`**: hide the **Regenerate Code** button when `!permissions.canRegenerateClassroomCode`, hide the **Danger Zone / Delete Classroom** card when `!permissions.canDeleteClassroom`, and hide the **Create Assignment** button when `!permissions.canCreateAssignments`. Load the profile via `usePermissions` at the top of the page.

These are UI gates; the database RLS already restricts these operations to the classroom's `teacher_id`, so a student who somehow reached the URL still cannot mutate anything. This change just stops the buttons from appearing.

## 4. Remove "My Classroom" from the dashboard

In `src/pages/Dashboard.tsx`, delete the second header button (lines 100–104, the one routing to `/classroom`). The route itself stays so existing student bookmarks keep working — students reach their classroom from the Classrooms link or directly via URL. The single **Classrooms** button remains for users who can create classrooms.

> Note: this leaves students with no header link to their joined classroom. If you'd rather keep one entry point for students, say so and I'll instead make the **Classrooms** button route to `/classroom` for users with `canJoinClassroom && !canCreateClassrooms`. Default plan: just remove "My Classroom" as you asked.

## Files

**Edited**
- `src/lib/permissions.ts` — add `canRegenerateClassroomCode` + `canDeleteClassroom`; flip the student perms.
- `src/pages/ProfilePage.tsx` — remove Save button, add debounced auto-save with upsert + status indicator.
- `src/pages/Dashboard.tsx` — remove the "My Classroom" header button.
- `src/pages/TeacherClassroomsPage.tsx` — route guard + hide Create button for non-creators.
- `src/pages/TeacherClassroomDetailPage.tsx` — load profile, gate Regenerate / Delete / Create Assignment.

**Not changed**
- Database RLS / RPCs — already enforce teacher-only mutation.
- `mem://index.md` — no new core rule needed; the existing Account Types core line still applies.

