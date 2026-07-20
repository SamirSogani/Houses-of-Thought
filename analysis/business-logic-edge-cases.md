# Business-Logic Edge-Case Audit

Scope: state-machine boundaries in accounts/capabilities, classroom lifecycle,
house lifecycle (incl. Draft Mode), AI-action application, profile flows.
Security is out of scope; RLS appears only where it yields wrong/confusing
behavior for legitimate users. Does not repeat code-quality B1–B8, DB audit
C1–L5, or ux-review §1–2 — client twins of DB findings are cross-referenced.
Companion plan: [business-logic-edge-cases-plan.md](business-logic-edge-cases-plan.md).

## Critical

### C1 — Assignment due dates display one day early for every user west of UTC
The teacher's `<input type="date">` value ("2026-07-16") is parsed with
`new Date(due)` (`components/classroom/AssignmentPanel.tsx:85`). Per ECMA-262,
date-only strings parse as **UTC midnight**, so `due_at` stores
`2026-07-16T00:00:00Z`. `dueLabel` then renders it in the viewer's **local**
timezone (`lib/classroom/assignments.ts:52-56`). In any US timezone, UTC
midnight Jul 16 is Jul 15 local.
Trigger: US teacher creates an assignment due Jul 16 → the very next render
(`AssignmentPanel.tsx:225`, `StudentAssignments.tsx:166-167`, teacher detail
page `app/classroom/[classId]/assignments/[assignmentId]/page.tsx:116`) shows
"Due Jul 15" to teacher and students alike.
Failure scenario: a class plans around a date the teacher never set; every
assignment in a US pilot is labeled a day early. (East of UTC the label is
right but the implied deadline instant — UTC midnight — is still arbitrary.)

### C2 — "Read-only" workspace accepts edits everywhere and silently discards them
`app/build/[id]/page.tsx:79-81` marks any non-owner view readOnly and swaps
`onSave` for a no-op (`:117`). But `readOnly` reaches only `ContextBar`
(title input + Invite/Publish, `ContextBar.tsx:66-84,185,209`). `Canvas`,
`BlueprintRail`, and `RightRail` receive no readOnly flag
(`components/build/BuildHousePage.tsx:205-208`), so every add/edit/remove
control works: the reducer runs, toasts fire ("Evidence added"), strength
recomputes — and nothing persists.
Two victims:
- **Student attacking a strawman.** The banner instructs them to engage —
  "find the weak links, then open Review to critique it"
  (`BuildHousePage.tsx:169-173`). Any counters, notes, or edits they make
  vanish on refresh. The critique itself is deliberately unpersisted
  (`components/build/layers/CritiqueSection.tsx:6-7`), so the whole strawman
  exercise produces **zero persisted student work** — the teacher can never
  see who attacked or what they found (spec gap on top of the UI bug).
- **Teacher on a student's house.** Same illusion; a teacher "fixing" a
  student's typo believes it saved.
Failure scenario: a class period of strawman attacks evaporates; students
tell the teacher "it deleted my work" in week one.

## High

### H1 — Strawman is released to students before it is generated or reviewed
`generate()` calls `ensure_strawman_house` **before** the AI call
(`components/classroom/StrawmanAuthor.tsx:82-87`), and the RPC links
`assignments.strawman_house_id` at creation (`0017:82-86`) — while the house
is still empty. Students' dashboards show "Attack strawman" the moment
`aiStrawman && strawmanHouseId` (`components/classroom/StudentAssignments.tsx:168`),
i.e. during the 10–30s generation window and immediately after a **failed**
generation (the catch at `StrawmanAuthor.tsx:99-104` leaves the link in
place; the button just flips to "Regenerate"). There is no release/review
gate at all, despite the UI promising one ("Students attack this once you've
reviewed it", `StrawmanAuthor.tsx:141`).
Failure scenario: generation errors out during class; every student sees
"Attack strawman" and opens a blank house. Or: students attack an unreviewed
draft the teacher intended to revise — and if the teacher regenerates,
`saveHouse`'s delete-then-insert (persistence.ts:247) briefly serves students
a half-empty house (client twin of DB-audit H1/H3).

### H2 — Turn-in is a freely-reversible, un-audited boolean with no edit lock
`houses.turned_in` is a bare boolean (`0021:8-9`), toggled from the dashboard
kebab (`app/dashboard/page.tsx:126-132`; "Undo turn in" always offered,
`components/dashboard/HouseCard.tsx:216-218`). Consequences, all verified:
- The owner can keep editing a turned-in house — the builder autosaves
  regardless (`app/build/[id]/page.tsx:117`); nothing anywhere reads
  `turned_in` before writing.
- A student can un-turn-in **after grading**, edit, and re-turn-in. The
  feedback row survives (keyed `house_id`, `0018:8-13`) but now describes
  content that no longer exists; the teacher view shows "Turned in" +
  "Graded: B+" chips (`assignments/[assignmentId]/page.tsx:181-190`) with no
  edited-since-grading signal and no timestamps to compare.
- Due date is never consulted: turn-in works indefinitely after `due_at`,
  with no "late" marker for the teacher.
Failure scenario: teacher grades Monday; student edits Tuesday; the grade
now certifies work the teacher never saw — indistinguishable in the UI.
(Delete-after-grading is DB-audit H2; this is the mutation-after-grading twin.)

### H3 — Profile autosave lies about success in two ways, and every write is whole-row
- **Seeded-invalid username freezes all saves.** `app/profile/page.tsx:39-42`
  seeds an empty username from the email local-part. Local-parts like
  `sam+school` or `jo` violate `USERNAME_RE` (also DB CHECK `0002:26-27`), so
  `nameError` is truthy and the autosave effect returns **before** touching
  the indicator (`components/profile/ProfileForm.tsx:47-53`), whose initial
  state is 'saved'. Every edit to About Me / POV / account type is silently
  dropped while the header shows "All changes saved". The unmount flush skips
  too (`ProfileForm.tsx:79`).
- **Username collision reports "saved" for a failed write.** On 23505 the
  code sets `taken` but then falls into the success branch — `setSave('saved')`
  and `savedRef` updated (`ProfileForm.tsx:59-68`) — although the **entire
  row update** (including unrelated field edits) was rejected. Trigger: two
  users with local-part `john`; the second edits About Me on the profile page.
- **`account_type` rides on every write** (`lib/profile/data.ts:120-130`): a
  stale tab autosaving About Me writes the old account type back, silently
  reverting a switch made elsewhere — client twin of code-quality B2's
  load-then-overwrite class.

### H4 — Account-type switching is instant and consequence-free while the classroom graph persists
The profile selector allows any switch anytime ("You can change this
anytime", `ProfileForm.tsx:127`) with no guard or warning. The DB-side
classroom graph is keyed to `classes.teacher_id` / `class_members`, not
`account_type`, so the two drift:
- **Teacher-with-classes → student/standard:** `/classroom` bounces them
  (`app/classroom/page.tsx:51-55`), so join codes, rosters, assignments, and
  grading UI become unreachable — their live classes are orphaned while
  students keep working. Yet by direct URL they still get the grading panel
  on any student house (`app/build/[id]/page.tsx:111` keys 'edit' on
  non-ownership; RLS `0018:27` keys on `teacher_id`, not account type) — a
  "student" who can grade.
- **Student → standard/teacher:** the Learn clamp lifts everywhere
  (client + `getCallerCapabilities` server-side), but `class_members` rows
  persist and there is **no leave-class UI anywhere** (self-delete is allowed
  by policy `0014:103-105`; no component uses it) — so the old teacher keeps
  seeing every future house they build (`can_view_student_house`,
  `0014:53-62`), indefinitely.
Failure scenario: a curious teacher taps "Student" to see the student view;
their classes vanish from their UI with no path back other than knowing to
switch again — meanwhile mid-semester grading is locked out.

### H5 — The student AI clamp binds to self-selected account type, not class membership
`join_class` accepts any account type (`0014:136-153`), and account type is
freely chosen at signup (`app/login/page.tsx:55`) or switched later (H4). A
class member with a `standard` account gets full capabilities on their
**assignment submissions**: Decide-mode answers, and Draft Mode end-to-end —
dashboard entry (`app/dashboard/page.tsx:149`), builder card
(`BuildHousePage.tsx:68`), and the server route allows it
(`app/api/ai/draft/route.ts:86-89`). Teachers have no roster indication of
members' account types (`get_class_roster` returns none, `0014:156-165`).
Failure scenario: one student signs up as "Standard" (the default!), joins by
code, and has the AI draft five of seven layers of a graded submission while
classmates get Socratic questions. The pilot's quotable trust asset —
"server-clamped student AI" — is true only for students who opted into it.

## Medium

### M1 — Revisiting a step re-offers already-added co-pilot suggestions (duplicates)
Findings are cached per step, but the `consumed` set is reset to empty every
time a step's cache is served (`components/build/rail/CopilotPanel.tsx:112-123`).
Trigger: step 3 → Add a suggestion (item inserted) → step 4 → back to step 3
→ the same card is visible again → Add → duplicate evidence/perspective.
Nothing dedupes in `applyAiAction` (`lib/build/aiActions.ts`).

### M2 — Adding a stale suggestion silently does nothing but consumes the card
`onAdd` dispatches and marks the card consumed unconditionally
(`CopilotPanel.tsx:200-204`). If the action is inapplicable — e.g.
`add_subquestion` naming a perspective deleted/renamed since the fetch
(cache + staleness make this routine) — `applyAiAction` returns null and the
reducer no-ops **without a toast** (`lib/build/state.ts:367-373`,
`aiActions.ts:43-51`). The card vanishes, nothing was added, no feedback.

### M3 — `deriveStatus` ignores all prose fields: real work shows as "Empty"
`persistence.ts:75-88` checks list layers + title only — not question,
purpose, conclusion, or reasoning. A house whose owner wrote only a
conclusion has `layers_complete = 1` but `status = 'empty'`; the same card
shows "1/7 layers · 14%" beside an "Empty" chip. Assignment houses are seeded
with a question (`0015:76-77`) yet read "Empty" to the teacher until a list
item exists. Cross-ref DB-audit M6 (derived-status trust).

### M4 — Grading panel binds to any student house, and one feedback row per house lets teachers overwrite each other
`feedback='edit'` for every non-owner, non-strawman view
(`app/build/[id]/page.tsx:109-111`) — including a student's **personal**
houses reached from the roster (which lists all their houses). RLS permits it
(`0018:27` is `can_view_student_house`). And `submission_feedback` is keyed
by `house_id` alone (`0018:8-13`): for a student in two classes, teacher B's
upsert (`SubmissionFeedback.tsx:68-74`) silently replaces teacher A's grade
and feedback, reassigning `teacher_id`. No attribution is ever displayed.

### M5 — Capability lookup fails open to 'standard', lifting the student clamp
`getCallerAccountType` returns 'standard' when the profile select errors
(`lib/auth/account.ts:23-33`). 'standard' is **more permissive** than
'student' (Decide allowed, `canAuthorDraft` true), so a transient DB hiccup
mid-request un-pins a student — contradicting capabilities.ts's own contract
("a bad DB row can never widen access", `lib/auth/capabilities.ts:55-58`).
Treated here as correctness: the pedagogy clamp (decision 007) is
best-effort, not guaranteed. Same class as code-quality B4 (signup write),
different site.

### M6 — Mid-interview unmount silently destroys the transcript
The interview transcript is local state in `InterviewCard`
(`components/build/rail/InterviewCard.tsx:20-21`), which lives inside
`CopilotPanel` — unmounted on right-rail tab switch and on closing the
mobile drawer (`BuildHousePage.tsx:239-241`; the useDraftRunner header
comment confirms the unmount behavior). Five answered questions vanish
without confirmation; only a completed interview persists (`SET_AI_CONTEXT`).

## Low

- **L1 — Assignment order is nondeterministic on position ties.** Neither
  teacher nor student queries order by anything
  (`AssignmentPanel.tsx:36-37`, `StudentAssignments.tsx:43`); `byPosition`
  is a stable sort over arbitrary DB row order (`courses.ts:33-35` assumes
  "stable input"). Ties arise from the client-computed `nextPos`
  (`AssignmentPanel.tsx:81`) racing another tab, or a reorder racing a
  create (`:103-118`) — order then flips between loads.
- **L2 — `dueLabel` has no year and no overdue state** (`assignments.ts:52-56`):
  "Due Jan 5" is ambiguous across the winter break, and a passed due date
  renders identically to a future one for both roles.
- **L3 — The draft claim gate misses the one real submission action.**
  `draftGateLocked` blocks PUBLISH/EXPORT (`state.ts:458-468`) — both fake —
  but dashboard Turn in (`dashboard/page.tsx:126-132`) ignores it: a
  standard-account member can submit a house with unclaimed AI layers.
- **L4 — Stopping a draft before anything landed shows "Draft claimed ✓".**
  STOP_DRAFT at stage one → all `drafted` false → `unclaimedDraftStages` is
  empty → the settled card renders on an untouched house
  (`DraftCard.tsx:148-201`).
- **L5 — Draft batch ordering can silently drop sub-questions.** In the
  perspectives stage both kinds are legal (`lib/ai/draft.ts:25-31`); actions
  apply sequentially (`state.ts:386-388`), so an `add_subquestion` emitted
  before its `add_perspective` no-ops with no trace.
- **L6 — Join-code handling asymmetry.** The typed path trims
  (`StudentClasses.tsx:86`) but `/join/[code]` passes the raw URL segment
  (`app/join/[code]/page.tsx:44`) and `join_class` only uppercases
  (`0014:140`) — a trailing `%20` from a chat-app copy fails with the generic
  "not valid" error. Also `/classes` is missing from middleware's
  PROTECTED_PREFIXES (`middleware.ts:4`): signed-out visitors get a
  client-side bounce with no `?next=` return.
- **L7 — Orphaned turned-in chip.** If an assignment row is ever deleted
  (`assignment_id` → NULL, `0015:23-24`), `turned_in` stays true but the
  menu action hides (`HouseCard.tsx:32,216`) — a permanent "Turned in" badge
  with no way to clear it. Latent until assignment-delete ships
  (pilot-plan gap).
- **L8 — Standard-account members have no navigation to classes.** The
  classroom nav link renders only for teacher/student types
  (`dashboard/page.tsx:145-157`); `/classes` admits standard accounts but is
  reachable only by typed URL or invite link.

## Known-issue cross-references (not repeated above)
- Duplicate submissions shadowing (teacher map `assignments/[assignmentId]/page.tsx:83-87`,
  student status map `StudentAssignments.tsx:54` — last row wins,
  unordered): client twin of DB-audit H3.
- Silent turn-in/rename failures: code-quality B8. Save-path error
  swallowing feeding C2's illusion: B1/B2. Signup account_type write: B4.
- Fake publish/export/invite/presence, join-flow silent success: ux-review
  1.2/1.3/2.5. Strength gaming via item counts: product-strategy-gaps §1
  (no new numeric edges found — all axes clamp via `Math.min`; no division).
