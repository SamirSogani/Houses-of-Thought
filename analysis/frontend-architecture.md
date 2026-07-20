# Frontend Architecture Audit — Build Workspace & Client State

Scope: the Build-workspace reducer architecture, client-side save/concurrency
protocol, the client-heavy page architecture, component-tree health, CSS
architecture, and a technical-debt register. Security is out of scope.
Companion plan: [frontend-architecture-plan.md](frontend-architecture-plan.md).
Builds on (does not repeat): audits/code-quality-review.md B1–B8/§7,
audits/performance-audit.md H1–H4, audits/ux-review.md §1 (fake
publish/export/invite), analysis/database-and-data-model.md H1/M1/M2.

## Critical

### C1 — No client save protocol: last-writer-wins whole-house replace with no version check
`lib/build/persistence.ts:247-331` replaces the entire house on every save;
`app/build/[id]/page.tsx:50-88` loads once on mount and never re-reads;
`components/build/BuildHousePage.tsx:104-121` fires that save 800ms after any
edit. Nothing carries a version: `saveHouse` neither sends the `updated_at` it
loaded nor conditions the UPDATE on it, so a stale client silently reverts
everything a fresher writer saved. The code's own comment scopes this as
"acceptable for single-user/single-tab" (`persistence.ts:245`) — but the product
is now multi-device (a student on a school Chromebook and a phone) and
multi-writer (draft runner + user, two tabs).

Failure scenario: laptop sleeps overnight with the house open; the user edits
from another device; back on the laptop, one keystroke → 800ms → the whole
house (parent row + all four child tables) reverts to yesterday's snapshot,
with no error (B1 swallows everything) and no indication anything was saved at
all — there is no save-status UI anywhere in the workspace.

The client protocol should be (DB audit H1's RPC is the server half): (1) a
monotonic `rev`/`updated_at` token sent with every save, mismatch → "changed
elsewhere — reload"; (2) dirty-tracking + visible save-status (idle → dirty →
saving → saved/failed) with retry; (3) 401/expired-session detection on the
save path → re-auth prompt; (4) a BroadcastChannel single-writer lock per
house id as the cheap same-browser multi-tab guard.

### C2 — Overlapping `saveHouse` calls interleave delete/insert: duplicated or vanishing child rows
`app/build/[id]/page.tsx:117` invokes `saveHouse` fire-and-forget; the debounce
(`BuildHousePage.tsx:112-115`) happily fires again 800ms later while the
previous save — nine sequential round trips (DB audit H1) — is still in flight
on slow Wi-Fi. Two in-flight saves interleave per table: A.delete → B.delete →
A.insert → B.insert leaves *both* snapshots' rows in `house_perspectives`;
the reverse order can leave zero. Draft Mode makes overlap the common case:
each `APPLY_DRAFT_STAGE` changes `contentKey` and schedules a save while
`useDraftRunner` is already fetching the next stage (`useDraftRunner.ts:40-85`),
so a 5-stage draft fires ~5 saves back-to-back against multi-second latency.

Failure scenario: a drafted house loads next time with every perspective
doubled; positional re-id (`persistence.ts:203-213`) absorbs the duplicates as
legitimate items, and the next clean save persists them permanently.
Fix is client-side and small: a single-flight queue (one save in flight,
one trailing save pending, never two).

## High

### H1 — The debounce flush covers SPA route changes only; tab close and sign-out lose or misdirect the last edit
The unmount flush (`BuildHousePage.tsx:126-133`) runs on React unmount. There
is no `pagehide`/`visibilitychange`/`beforeunload` handler and no
`keepalive`/`sendBeacon` anywhere (repo-wide grep: zero hits), so closing the
tab, killing the browser, or the OS suspending the page inside the 800ms window
(plus the in-flight seconds of C2's nine requests) drops the edit. Sign-out is
worse: `handleSignOut` (`app/build/[id]/page.tsx:90-95`) awaits `signOut()` and
navigates; the flush then fires a save *after* the session is gone — RLS
rejects all nine requests and B1 swallows the rejection.

Failure scenario: student finishes a sentence and closes the lid at the bell;
the sentence never reaches the DB; nothing ever said "unsaved".

### H2 — Draft Mode can wedge a house behind its own gate with no exit affordance
`draftGateLocked` (`lib/ai/draft.ts:73-76`) locks publish/export and brands
strength "provisional" whenever `draft.stage !== 'done'`. The only way to
finish or stop a draft is the runner (`useDraftRunner.ts:87-102`), whose UI —
`DraftCard` — renders only when `canDraft` (`BuildHousePage.tsx:68-72`). So a
mid-run house whose owner loses draft eligibility (account-type change, flag
flip) is locked forever: unclaimed stages can't advance and STOP_DRAFT is
unreachable. Softer variants happen today: a daily-cap 429 mid-run locks the
house until quota reset, surfaced only as "Could not reach the co-pilot"
(`DraftCard.tsx:130-134`) — the same copy as a 401 from an expired session
(`useDraftRunner.ts:65-69` maps every non-ok body identically). Also:
decision 016 §2 says turn-in is gate-locked, but the dashboard turn-in path
never checks `draft` (`app/dashboard/page.tsx:126-129`) — unexploitable today
(students can't draft), yet the invariant lives only inside the workspace.
Otherwise the stage machine is sound: per-stage idempotence guard
(`state.ts:380-402`), abort-on-cleanup, resume-from-persisted-stage.

### H3 — `Perspective.strength` is a dead metric rendered as live assessment
`types.ts:40` stores a per-perspective strength; the UI renders it prominently
as a colored bar + numeral (`PerspectivesLayer.tsx:104-106`,
`PerspectiveDetail.tsx:91-93`) and it persists to `house_perspectives.strength`.
But no code path ever computes or edits it: `EDIT_PERSPECTIVE` only accepts
`name|summary|stance` (`types.ts:131`), and every real creation writes 0
(`state.ts:185`, `aiActions.ts:37`, `lib/classroom/strawman.ts:36`). Only the
demo seed has non-zero values (`state.ts:11-17`).

Failure scenario: every perspective in every real house shows a permanent
orange "0" bar; a teacher reads it as "this student's coverage is worthless",
a student reads it as a broken grade. Either derive it (from stance/
sub-questions/evidence/counters counts) or remove the rendering.

### H4 — Client-only page architecture: the auth/profile scaffold is re-derived by hand on every page
Every authed route is `'use client'` with `useEffect` fetching (13 of 22
pages). The latency half is perf-audit H2; the architectural half: the
getUser → profiles → `capabilitiesFor` → redirect dance is copy-pasted with
local variations in `app/dashboard/page.tsx:39-60`, `app/classroom/page.tsx:40-56`,
`app/build/[id]/page.tsx:50-88`, `app/classes/page.tsx`, plus `handleSignOut`
in 9 files and `centerNotice` in 7. There is no single place to put C1's save
protocol, a session-expiry listener, or a capability gate — each new page
re-implements the preamble, and one page forgetting the student clamp is a
policy bug (code-quality B4 shows the write half already drifting).
Migration judgment: a big-bang RSC rewrite is *not* warranted now — the Build
workspace is intrinsically client-side. The right move: one shared client
scaffold hook now, then RSC per page opportunistically starting where perf H2
already wants it (dashboard/classroom). Component-tree health is otherwise
good: dispatch drilling is shallow (2–3 levels), `lib/build` (pure) vs
`components/build` (view) is a clean boundary, no build component exceeds
291 LOC; the only 600-LOC-rule breach repo-wide is `lib/ai/router.ts` (836,
already flagged in code-quality §6).

## Medium

### M1 — `State` mixes three state species; the persistable subset exists only as a hand-list
`types.ts:82-113` carries content (title…watchpoints), durable view prefs
(mode), and transients (step, rightTab, toast, inviteOpen, copied, notesOpen,
activePerspective) in one bag. The only partition is `serializeContent`'s
17-field literal (`persistence.ts:148-168`) — and the DB path needs the same
field wired in *three more* places (column, `saveHouse`, `loadHouse`). A new
content field forgotten in any one of them silently doesn't persist (or loads
as blank and then C1-overwrites the stored value). No test guards the
round-trip. Cheap fix: derive the persisted shape from a single
`PERSISTED_KEYS` list + a round-trip test (see plan).

### M2 — No undo anywhere + single-click destructive removes + 800ms autosave
Every REMOVE_* action is one un-confirmed click (`Editable.tsx:78-98` renders
the ubiquitous 20px ✕), the reducer has no history, and autosave commits the
deletion to the DB within a second — combined with DB-audit H2 (no soft
delete), a slipped tap on a phone permanently destroys a perspective's whole
subtree (stance, sub-questions, evidence, counters). The reducer is cleanly
positioned for undo (single state object, serializable content subset,
`serializeContent` already separates what's worth snapshotting); a bounded
undo stack of content snapshots is a day's work and the cheapest fix.

### M3 — Zombie subsystem: `ACCEPT_SUGGESTION` + `suggestions.ts` + `accepted`
No component dispatches `ACCEPT_SUGGESTION` (repo grep: only the reducer case,
`state.ts:355-365`). It is the sole writer of `state.accepted`, yet `accepted`
is persisted on every save (`persistence.ts:260`), loaded back
(`persistence.ts:201`), keyed by ephemeral ids (DB-audit M1), and drags the
222-line deprecated `lib/build/suggestions.ts` into the bundle via
`state.ts:30`. Dead code on the hottest reducer path, plus a live foot-gun:
`suggestion.run(draft)` mutates a shallow clone in place — the one pattern in
the codebase that can corrupt reducer purity if ever re-wired carelessly.

### M4 — Mobile retrofit unmounts stateful rail panels: interview transcripts and suggestion caches die on drawer close
The co-pilot cache "resets when the panel unmounts (tab switch) — deliberate"
(`CopilotPanel.tsx:62-65`), and the interview transcript is ephemeral local
state (`InterviewCard.tsx:5-6`). On desktop that unmount is rare; on mobile the
entire rail is a drawer that unmounts on every close
(`BuildHousePage.tsx:239-241`). A user mid-interview who closes the drawer to
glance at the canvas loses the whole transcript; every drawer open refires the
suggest call (token cost ×N). The draft runner was correctly hoisted for
exactly this reason (`useDraftRunner.ts:3-5`) — the interview/suggestion state
needs the same hoisting. Related render cost: `serializeContent` (full-house
`JSON.stringify`) runs twice per keystroke (`BuildHousePage.tsx:103`,
`CopilotPanel.tsx:75`) plus `JSON.parse(contentKey)` per render in teacher
grading view (code-quality §6).

### M5 — CSS architecture: inline-styles base vs `!important` retrofit overlay
Baseline styling is 100% inline style objects in TSX (code-quality §5); the
mobile retrofit (commits 2f643b1/f904ac3) added three global stylesheets that
override those inline styles by class + `!important` — 27 in
`build-responsive.css`, 17 in `account-responsive.css`, 7 in
`marketing-responsive.css` (the mechanism is admitted at
`build-responsive.css:5`). Every responsive element now has two truths in two
files coupled by a `bhp-*` class name: change the inline padding and the
mobile override silently diverges; rename a class and mobile breaks with no
compiler signal. Coherent today because one person wrote both halves in one
week; it decays from here. Containment: freeze the pattern, fold each
component's literals into the stylesheet when touched.

## Low

- **L1** In-memory id reuse: `nextId` = max+1 (`state.ts:105-107`), so deleting
  the highest item recycles its id for the next add. Harmless today only
  because nothing durable references in-memory ids except dead `accepted`;
  a future feature (comments, links, undo by id) inherits a trap. Same class
  as DB-audit M1 — fix jointly (stable ids).
- **L2** Stale self-descriptions: `app/house/page.tsx:4-6` claims the chrome is
  "swapped for a Save → Create account CTA" — decision 005 §1 says that was
  reverted; `docs/repository/file-structure.md:70-74` lists 7 of 22 routes;
  `persistence.ts:245`'s "single-user/single-tab" scoping no longer matches the
  product (C1). (serialize.ts's false "exercised by tests" already in cq §7.)
- **L3** Reducer addressing is inconsistent: perspectives/evidence/assumptions/
  implications edit by `id`, while concepts/watchpoints/sub-questions edit by
  array index (`types.ts:128,156`). Index-addressed edits are wrong-target
  hazards the moment a concurrent writer (draft stage, future collab) can
  reorder the array between render and dispatch.

## Technical-debt register (not already ledgered elsewhere)

| # | Item | Evidence | Cost of carry | Cheapest retirement |
|---|---|---|---|---|
| D1 | `ACCEPT_SUGGESTION` + `suggestions.ts` + `accepted` plumbing | M3 | dead 222-line bundle weight; corrupt-prone mutation pattern; dead jsonb column written every save | delete action+bank; stop writing `accepted` (DB col drop rides DB plan) |
| D2 | `TeamPanel.tsx` | zero imports (grep) | confuses "where does Team tab live" (answer: inline `EmptyTeam` in RightRail) | delete file |
| D3 | `lib/ai/groq.ts` shim | all 7 AI routes still import it | every new route copies the stale import; two names for one module | mechanical rename to `@/lib/ai/router`, delete shim (with cq #5) |
| D4 | `/house` builder + `LOCAL_HOUSE_KEY` | orphaned route (ux 2.4); `persistence.ts:94-144` | second persistence dialect to keep normalizers compatible with; stale header (L2) | product call: promote as `/try` full builder or delete route + local adapter |
| D5 | `house_collaborators` table + Invite/Team UI | migration 0004; zero code references; invite modal fake (ux 1.2) | schema + RLS surface with no feature; FK blocks account deletion (DB H4) | hide invite affordances now; drop or wire the table at collaboration time |
| D6 | Fake presence personas + `CYCLE_OWNER` | `lib/build/people.ts`; `state.ts:246-257` (ux 1.3 owns UX) | `owner_key` writes fictional attribution into real rows; blocks real collab model | strip personas from real houses; freeze `ownerCycle` to `you`/`ai` |
| D7 | Dead `Perspective.strength` | H3 | misleading core-surface metric persisted to DB | derive or delete rendering (S) |
| D8 | `!important` retrofit overlay | M5 | silent desktop/mobile divergence per style edit | freeze pattern; fold per-component on touch |
| D9 | "draft" means 3 things | `DraftState` (AI draft), localStorage key `hot:house:draft`, reducer-local `const draft` clones (`state.ts:359,368`) | every conversation and grep about "draft" needs disambiguation | rename reducer locals to `next`; rename local key on D4 resolution |
| D10 | Stale headers/docs | L2 | misleads exactly the file-first navigation CLAUDE.md mandates | 15-minute doc pass |

Testing: the repo has zero tests and zero runner (code-quality §7); given C1/C2
land in the same functions a test would have to mock anyway, the full testing
strategy (runner, seams, ranked first tests) is §Phase 1 of the plan.
