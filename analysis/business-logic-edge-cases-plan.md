# Business-Logic Edge-Cases — Remediation Plan

Companion to [business-logic-edge-cases.md](business-logic-edge-cases.md)
(finding IDs C1…L8 refer there). Fixes are grouped by shared root cause, then
sequenced. Efforts: **S** ≤ half day · **M** ≤ 2 days · **L** ≤ week.
**Gate** = must land before the first school pilot.

Three root causes drive most of the list — fix the pattern, not just the site:
- **A. Boundary flags exist but aren't consulted** (`readOnly`, `turned_in`,
  `draftGateLocked`, due dates): C2, H1, H2, L2, L3, L7.
- **B. Capabilities keyed to self-selected account type, not relationships**
  (class membership, assignment linkage): H4, H5, M4, M5.
- **C. Optimistic client state with no reconciliation** (extends
  code-quality B1/B2): H3, M1, M2, M6.

## Phase 0 — Gate (correctness a pilot hits in week one)

### 1. Parse due dates as local end-of-day — C1 + L2 (S)
`components/classroom/AssignmentPanel.tsx:85`: replace `new Date(due)` with an
explicit local construction — `new Date(\`${due}T23:59:59\`)` (no `Z`, parsed
local) — so "due Jul 16" means end of Jul 16 where the teacher lives. In
`lib/classroom/assignments.ts:52-56`, add the year when it differs from the
current one and an `overdue` boolean consumers can badge. Verify with one
assignment created in a US timezone rendering the same date for teacher and
student.

### 2. Make read-only actually read-only — C2 (M)
Thread `readOnly` from `app/build/[id]/page.tsx` through `BuildHousePage` into
`Canvas`, `BlueprintRail`, and `RightRail`. Cheapest robust mechanism: wrap
`dispatch` once in `BuildHousePage` — when `readOnly`, drop all content-mutating
actions (allow `GO_STEP`, tab/drawer UI actions) and show one persistent chip
("Viewing — changes won't save"). This fixes both victims (student-on-strawman,
teacher-on-student-house) at one seam instead of dozens of controls.
**Separate product decision (M–L, can trail the pilot):** persist strawman
attacks as student work (e.g. a student-owned "response" house or a
`strawman_notes` field). Until then, set honest expectations in the strawman
banner ("your notes here aren't saved — bring findings to class").

### 3. Gate strawman release on success + review — H1 (M)
Server half: stop linking at creation — `ensure_strawman_house` returns the
house id but `assignments.strawman_house_id` is set only by an explicit
`release_strawman(assignment_id)` RPC (or an `is_released` boolean the student
query filters on). Client half: `StrawmanAuthor` gains a Review → **Release to
students** step after successful generation, matching the copy it already
ships ("Students attack this once you've reviewed it",
`StrawmanAuthor.tsx:141`). On generation failure nothing is released. One
migration + ~30 client lines.

### 4. Turn-in integrity: lock, timestamp, late marker — H2 (M)
- Migration: add `turned_in_at timestamptz`; set/clear it with the toggle.
- Builder: when `turned_in` and viewer is the owner, open read-only (reuses
  step 2's seam) with "Turned in — undo to edit".
- Dashboard: disable "Undo turn in" once a `submission_feedback` row exists
  (already loaded per-house on the teacher side; student side needs one cheap
  exists-check) — or, softer, allow it but show the teacher an
  "edited after grading" chip when `houses.updated_at > feedback.updated_at`.
  Recommended: hard-disable for the pilot; softer variants need trust UI.
- Teacher assignment page: "late" chip when `turned_in_at > due_at` (pairs
  with step 1's overdue flag).
Cross-ref: DB-audit H2 (delete-after-grading trigger) — same protective
intent, land together.

### 5. Fix profile autosave truthfulness — H3 (S)
`components/profile/ProfileForm.tsx`:
- Seed-invalid username must not freeze the row: only include `username` in
  the update payload when it passes `USERNAME_RE`; other fields always save.
- The 23505 branch must set `setSave('error')` (not fall through to 'saved')
  and leave `savedRef` untouched.
- Drop `account_type` from the autosave payload (`lib/profile/data.ts:120-130`);
  write it only from the selector's explicit onChange. Kills the stale-tab
  account-type revert.

### 6. Bind the student clamp to the work, not the self-label — H5 (M)
Smallest honest fix, server-side: in `/api/ai/draft` (and `suggest`'s posture
selection), when the target house has `assignment_id IS NOT NULL`, apply the
Learn/no-draft clamp **regardless of account type** — assignment submissions
are student work by definition. One indexed lookup per call; keeps standard
accounts fully free on personal houses. Plus roster visibility: extend
`get_class_roster` to return `account_type` so a teacher can see the one
"Standard" member and ask them to switch. The full relationship-based
capability model (member-of-any-class ⇒ student posture) is a later decision —
don't block the pilot on it.

### 7. Fail closed where the clamp is the product promise — M5 (S)
`lib/auth/account.ts:23-33`: on profile-lookup error, return `'student'` (most
restrictive) instead of `'standard'` when the request is for capability
clamping, per capabilities.ts's own stated contract. Add the Sentry capture
(ops plan #9) so a spike in fallbacks is visible.

## Phase 1 — early pilot (trust and feedback quality)

8. **Feedback attribution + scope** — M4 (M): render "Graded by {teacher} ·
   {date}" from `submission_feedback` (teacher_id + updated_at already exist);
   restrict the grading panel to houses with `assignment_id` in one of the
   viewer's classes (personal houses render read-only without the panel);
   accept last-write-wins between co-teachers once attribution is visible.
9. **Account-type switch guards** — H4 (S–M): in `AccountTypeSelector`, when
   leaving `teacher` with live classes, require typed confirmation and say
   what happens ("Your N classes stay; you can't manage them until you switch
   back"); when leaving `student`, offer leave-class actions. Ship the
   missing **Leave class** button (`class_members` self-delete policy
   `0014:103-105` already allows it) on `/classes`.
10. **Suggestion application honesty** — M1 + M2 (S): key `consumed` by
    finding identity and persist it across step revisits (hoist beside the
    cache per frontend-plan Phase 2 §4); when `applyAiAction` returns null,
    toast "That suggestion no longer applies" and *don't* consume the card;
    add a cheap same-text dedupe guard in `applyAiAction` add-paths.
11. **`deriveStatus` reads prose** — M3 (S): count question/conclusion/
    reasoning toward `empty → in-progress`; keep thresholds in one exported
    function so the server-derived version (DB plan step 11) reuses it.
12. **Hoist interview transcript** — M6: same fix as frontend-plan Phase 2
    §4 (state hoisted beside `useDraftRunner`); add a confirm on drawer close
    mid-interview until hoisted.

## Phase 2 — hygiene (S each)

13. Order assignment queries: `.order('position').order('id')` in
    `AssignmentPanel.tsx:36-37` and `StudentAssignments.tsx:43` — L1.
14. Dashboard turn-in checks `draftGateLocked` — L3 (already specified as
    frontend-plan Phase 0 §5; listed here for the classroom lens).
15. Settled draft card renders only when some stage actually drafted — L4:
    guard on `Object.values(drafted).some(Boolean)`.
16. Sort draft-stage action batches: `add_perspective` before
    `add_subquestion` in `APPLY_DRAFT_STAGE` (or emit-side in
    `lib/ai/draft.ts`) — L5.
17. Join-code normalization: `decodeURIComponent(code).trim()` in
    `app/join/[code]/page.tsx:44`; add `/classes` to middleware
    `PROTECTED_PREFIXES` so signed-out visitors get `?next=` — L6.
18. Turned-in chip clearable when `assignment_id` is null (or hide the chip
    for orphaned houses) — L7; rides the assignment-delete feature
    (pilot-readiness gap).
19. Show the Classroom nav link to standard accounts with ≥1 membership — L8.

## Sequencing summary

Gate = Phase 0 (steps 1–7): ~5–6 focused days. Order: 1 and 5 first (pure
client, zero risk), then 2 (one seam, unblocks 4's builder lock), then 4, 3,
6, 7 (each needs a small migration or RPC change — batch them into one
migration file and one deploy per the ops plan's expand→deploy→contract rule).
Phase 1 during the first pilot weeks; Phase 2 as touch-time cleanups.
Combined with the DB plan's Phase 0 and frontend plan's Phase 0, total
pre-pilot engineering across all three plans ≈ 3 weeks solo.
