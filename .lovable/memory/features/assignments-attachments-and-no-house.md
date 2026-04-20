---
name: Assignments — no-house mode + universal attachments
description: Phase 3.5 — fourth assignment mode `none` (acknowledge / text response) and the universal `attachments` table + private `attachments` storage bucket
type: feature
---

## No-house assignment mode (`mode='none'`)

Teachers can create assignments with no House at all. `assignments.response_type` picks the variant:
- `'acknowledge'` — student clicks **Mark Done** (status flip only).
- `'text'` — student types into `assignment_submissions.response_text` and can attach files to the submission.

`assignment_submissions.analysis_id` is **nullable** (no house = no analysis). `start_assignment` RPC short-circuits for `mode='none'` and inserts the submission row with `analysis_id=null`.

Teacher submissions table swaps "View house" for **View Response** when `mode='none'`, opening `SubmissionResponseDialog` (text + submission attachments).

## Universal attachments

**Table `public.attachments`** — polymorphic via `(parent_type, parent_id)` where parent_type ∈ `'assignment' | 'submission' | 'comment'`. Comments are reserved for Phase 4 (currently locked at the helper-function level).

**RLS visibility** via `can_view_attachment(id)`:
- Owner always.
- `assignment` parent → teacher + classroom members.
- `submission` parent → owning student + assignment's teacher.
- `comment` → locked until Phase 4.

**RLS write** via `can_attach_to(parent_type, parent_id)`:
- `assignment` → teacher only.
- `submission` → owning student only.
- `comment` → false until Phase 4.

**Storage** — private bucket `attachments`. All downloads go through the **`sign-attachment-url`** edge function (1-hour signed URLs). Storage RLS mirrors the table rules.

**Edge functions**
- `upload-attachment` — multipart form-data (`parent_type`, `parent_id`, `files`). Re-verifies caller using their JWT, enforces type/size/count, uploads to `attachments` bucket using service role, inserts rows. Rolls back uploaded objects on any failure in the batch.
- `sign-attachment-url` — accepts `{ attachment_id }`, uses caller's user-scoped client to SELECT the row (RLS enforces visibility), then service-role generates a 1-hour signed download URL with the original filename.

## Limits (enforced both client + server)

- Allowed MIME types: PDF, DOC/DOCX/ODT, TXT/MD/RTF, PPT/PPTX/ODP, XLS/XLSX/CSV, PNG/JPEG/GIF/WEBP/SVG/HEIC, MP3/M4A/WAV/OGG. **No archives, no executables, no video.**
- Per-file: 15 MB
- Per-upload batch: 8 files
- Per parent record total: 40 MB

## Reusable component

`<FileAttachmentInput value={files} onChange={setFiles} existingTotalBytes existingCount label />`
- Paperclip button → hidden `<input type="file" multiple accept="...">`.
- Drop zone (`dragover` highlight ring + drop reads `event.dataTransfer.files`).
- Preview list with name · human-readable size · ✕ remove.
- Validates type/size/count client-side and toasts errors. Does NOT upload — parent calls `uploadAttachments(parent_type, parent_id, files)` after the parent record exists.

`<AssignmentAttachmentsList parentType parentId canManage />` lists existing attachments, downloads via signed URL, and (when `canManage`) lets the user upload more or delete their own.
