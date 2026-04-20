

# Phase 3.5 — "No-house" assignments + file attachments

Two additions to Phase 3, plus prep for Phase 4 comments.

## 1. New assignment mode: `none` (no house)

Add a fourth mode to the `assignment_mode` enum: **`none`** — no house is created. Teacher picks one of two sub-variants when creating it:

- **Acknowledge** — students see the prompt + attachments and click **Mark Done**. Submission is just a status flip.
- **Text response** — students see prompt + attachments AND a textarea. They type a response, optionally attach their own files, then **Submit**.

Schema change on `assignments`:
- Add `response_type` text column: `null` (for empty/prefilled/template), `'acknowledge'`, or `'text'` (only used when `mode='none'`).

Schema change on `assignment_submissions`:
- Add `response_text` text column for the student's typed response (only used in text mode).
- `analysis_id` becomes **nullable** (no house = no analysis). RLS and `start_assignment` updated to handle this.

`start_assignment` RPC: when `mode='none'`, skips analysis creation entirely and just inserts the submission row with `analysis_id = null`.

Student UI:
- No "Open house" link — instead an inline card showing prompt + teacher attachments + (for text mode) a textarea + attachment uploader + Submit button. For acknowledge mode, just a **Mark Done** button.

Teacher submissions table:
- For no-house assignments, "View house" is replaced with **View Response** (opens a modal showing the student's text + files) or just status if acknowledge-only.

## 2. File attachments — universal

### Storage
- One **private bucket** `attachments`, RLS-gated.
- Path convention: `assignments/{assignment_id}/{uuid}-{filename}`, `submissions/{submission_id}/{uuid}-{filename}`, `comments/{comment_id}/{uuid}-{filename}` (Phase 4).
- Access via short-lived **signed URLs** (1 hour) generated server-side.

### Database
New table `attachments`:
- `id`, `owner_id` (uploader), `storage_path`, `file_name`, `file_size`, `mime_type`, `created_at`
- Polymorphic parent: `parent_type` (`'assignment' | 'submission' | 'comment'`), `parent_id` (uuid)
- Indexed on `(parent_type, parent_id)`.

### RLS on `attachments`
- INSERT: any authenticated user (path/parent validated by edge function before insert).
- SELECT: 
  - Owner always.
  - For `parent_type='assignment'`: any classroom member of that assignment's classroom + the teacher.
  - For `parent_type='submission'`: the student who owns the submission + the teacher of that assignment.
  - For `parent_type='comment'` (Phase 4): same audience as the parent submission.
- DELETE: owner only (and teacher can delete attachments on their own assignments).

### RLS on `storage.objects` for `attachments` bucket
- Mirror the rules above. Use `name LIKE 'assignments/%'` etc. with helper functions to look up parent and check membership/ownership.

### Edge functions
Two small functions:
- **`upload-attachment`** — accepts multipart form-data: `parent_type`, `parent_id`, files. Validates parent ownership/membership, validates file types/sizes, uploads to storage, inserts `attachments` rows, returns the rows. Does the type/size enforcement server-side so client-side limits can't be bypassed.
- **`sign-attachment-url`** — accepts an `attachment_id`, validates the caller can read it (via RLS-style helper), returns a signed URL.

### Recommended limits (based on your project — academic Houses-of-Thought work, classroom artifacts like syllabi, readings, student essays, screenshots, sketches)

**Allowed types** — practical for K-12/college reasoning classrooms:
- Documents: `pdf`, `doc`, `docx`, `odt`, `txt`, `md`, `rtf`
- Slides: `ppt`, `pptx`, `odp`
- Spreadsheets: `xls`, `xlsx`, `csv`
- Images: `png`, `jpg`/`jpeg`, `gif`, `webp`, `svg`, `heic`
- Audio (for primary-source clips, recorded answers): `mp3`, `m4a`, `wav`, `ogg`
- No archives (zip/rar), no executables, no video (too heavy for free-tier storage and rarely needed for this use case).

**Per-file size**: **15 MB**. Big enough for a scanned PDF reading or a slide deck, small enough that one attachment can't blow your storage budget.

**Per-upload count**: **8 files**. Matches typical "weekly readings + handout" patterns.

**Per-record total**: **40 MB total** across all attachments on one assignment/submission/comment. Hard cap to prevent runaway uploads.

These are enforced both client-side (UX) and inside `upload-attachment` (security).

## 3. Reusable `<FileAttachmentInput />` component

One component used in: assignment creator, comment box (Phase 4), and student submission box.

Behavior:
- Paperclip 📎 button triggers a hidden `<input type="file" multiple accept="..." />`.
- The container is also a drop zone: `dragover` → highlight ring + "Drop files to attach"; `drop` → reads `event.dataTransfer.files`.
- Below: preview list, one row per file: filename · human-readable size · ✕ remove. Files shown as **pending** until the parent record is saved.
- Validates type/size/count client-side and shows toast errors immediately.
- Returns selected files via `onChange(files: File[])`. Does NOT upload itself — parent component decides when to upload (after the assignment is created and we know the `parent_id`).

## 4. Wiring into existing surfaces

### `CreateAssignmentDialog`
- Add `<FileAttachmentInput />` below the prompt textarea.
- Add fourth radio "No house — direct response" with sub-radio (acknowledge / text response).
- After `createAssignment` returns the new assignment id, call `upload-attachment` with `parent_type='assignment'` and the picked files. If upload fails, the assignment is still created — show toast offering to retry attachments from the assignment detail page.

### Teacher assignment detail (`TeacherAssignmentDetailPage`)
- Show existing attachments list with download (signed URL) and delete (teacher owns).
- Allow adding more attachments after creation.
- Submissions table: show "View Response" for `mode='none'` instead of "View house".

### Student classroom (`StudentClassroomPage`)
- For `mode='none'` assignments: render an inline card with prompt + teacher attachments (download via signed URL) + the appropriate response UI (textarea + own `<FileAttachmentInput />` for text mode, just a button for acknowledge mode).
- For house-based assignments: unchanged.

### Phase 4 comments (prep only)
- The `attachments` table and `<FileAttachmentInput />` are built generically so the comment box drops in with `parent_type='comment'`. No comment UI shipped in this phase.

## 5. Permissions (no changes to `permissions.ts`)
- Anyone in the assignment's audience can attach files where the UI exposes the input. Server-side enforcement is the source of truth.

## Files

**New**
- `supabase/migrations/...` — enum value `none`, columns on `assignments` & `assignment_submissions`, `attachments` table + RLS, `attachments` storage bucket + storage RLS, helper SQL functions `can_view_attachment(p_id)`, `can_attach_to(p_type, p_id)`.
- `supabase/functions/upload-attachment/index.ts`
- `supabase/functions/sign-attachment-url/index.ts`
- `src/components/ui/FileAttachmentInput.tsx`
- `src/components/classroom/AssignmentAttachmentsList.tsx` (download + delete)
- `src/components/classroom/StudentNoHouseAssignment.tsx` (acknowledge / text response card)
- `src/components/classroom/SubmissionResponseDialog.tsx` (teacher views student response + files)
- `src/hooks/useAttachments.ts` (list/upload/delete/sign)

**Edited**
- `src/components/classroom/CreateAssignmentDialog.tsx` — add no-house mode + sub-mode + attachment input + post-create upload.
- `src/hooks/useAssignments.ts` — surface `response_type` field; upload pipeline helper.
- `src/pages/TeacherAssignmentDetailPage.tsx` — attachments section + response viewer.
- `src/pages/StudentClassroomPage.tsx` — render no-house cards inline.
- `src/components/classroom/AssignmentsList.tsx` — different action set for `mode='none'`.
- `src/integrations/supabase/types.ts` — auto-regenerated.

**Memory updates**
- New: `mem://features/assignments-attachments-and-no-house.md` — documents the `none` mode, the `attachments` table, signed-URL access, and the limits (15 MB / 8 files / 40 MB / allowed types).
- Update `mem://features/classrooms-phase3.md` to reference the addendum.
- Update `mem://index.md` core rule on Account Types unchanged; add a one-liner: "Attachments live in private `attachments` bucket; access only via signed URLs from `sign-attachment-url`."

