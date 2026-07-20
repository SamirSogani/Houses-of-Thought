# Code Quality Audit — Houses of Thought

**Auditor:** code-quality-reviewer (subagent, model: Fable) · read-only · 2026-07-19
Reviewed all application code (`lib/`, `app/`, `components/`, `middleware.ts`,
configs), ran the type checker (clean), and traced data flows end-to-end.

**Overall:** a well-reasoned codebase with unusually good architectural
documentation, real invariant enforcement (AI actions constrained by types, URL
allow-listing, server-side capability gates), and clean module boundaries in
`lib/`. The dominant risks are concentrated in **persistence error handling** (a
real data-loss chain), **silently swallowed Supabase errors**, and **zero
test/lint infrastructure**.

---

## BUGS

### Critical

**B1. Data-loss chain: `loadHouse` swallows child-query errors, then autosave destructively rewrites**
`lib/build/persistence.ts:169-176` — the four child selects (`persp`, `evid`, `assum`, `implic`) in `Promise.all` never check `.error`; a failed query is coerced to `[]` (`persp.data ?? []`). If e.g. the `house_evidence` select fails transiently, the house loads with an empty Evidence layer. `BuildHousePage` then treats that state as ground truth, and the user's *first keystroke* triggers `saveHouse`, which (`persistence.ts:262+`) **deletes all rows per child table and re-inserts from state** — permanently wiping the layer that failed to load.
**Refactor:** treat any child-select error as a failed load (`return null` → dashboard redirect), and see B2.

**B2. `saveHouse` checks no errors and is delete-then-insert without a transaction**
`lib/build/persistence.ts:245-325` — all ~9 awaited writes ignore `{ error }`. A failed insert after a successful delete drops a whole layer; a failed parent update silently loses everything since the last save, while the ContextBar permanently displays "Draft · autosaved" (`ContextBar.tsx:57`). The non-atomicity is at least documented; the silent failure is not.
**Refactor:** move whole-house replace into a single transactional Postgres RPC; have `saveHouse` return success/failure and surface a "couldn't save" indicator in the builder (the ProfileForm already models this pattern with its `SaveState`).

### High

**B3. ProfileForm unmount flush never executes**
`components/profile/ProfileForm.tsx:79-88` — `void createClient().from('profiles').update(row).eq('id', userId)`. Supabase query builders are *lazy thenables*: the HTTP request only fires when `.then()` is invoked. `void expr` never subscribes, so the "flush a pending change on unmount" effect is a silent no-op — edits made within the 650 ms debounce window before navigating away are dropped, which is exactly what the code claims to prevent.
**Refactor:** `createClient().from('profiles').update(row).eq('id', userId).then(() => {})` (or wrap in an async IIFE).

**B4. Students can self-escape the Learn-mode clamp**
`components/profile/ProfileForm.tsx` (AccountTypeSelector, "You can change this anytime") + `lib/auth/account.ts` — the authoritative capability gate reads `profiles.account_type`, but the profile form lets *any* user, including students, set their own `account_type` to `standard` (full Decide mode) or `teacher` (class creation, viewing student houses). Every server-side gate — `forcedMode` in `/api/ai/suggest`, `canCreateClasses` — keys off this self-editable value. The careful server-side mode clamp (decision 007) is therefore one dropdown away from moot. **(See security audit C1 — confirmed exploitable via a single direct PostgREST PATCH, not just the UI.)**
**Refactor:** restrict `account_type` updates (RLS column-level check, or a SECURITY DEFINER RPC that forbids leaving `student` without teacher/admin action), and hide the selector for student accounts.

### Medium

**B5. Dead link: `/forgot-password` route doesn't exist**
`app/login/page.tsx:256` links to `/forgot-password`; there is no such route in `app/` → 404. No password-reset flow exists at all.
**Refactor:** implement via `supabase.auth.resetPasswordForEmail`, or remove the link until it exists.

**B6. `readOnly` is not propagated into the canvas — edits are accepted and silently discarded**
`components/build/BuildHousePage.tsx:170` / `app/build/[id]/page.tsx` — `readOnly` disables only autosave, the title input, and the mode toggle. `Canvas` and all layer components (`grep readOnly components/build/layers` → no hits) still render editable `InlineText` fields and add/remove buttons. A teacher viewing a student's house, or a student "attacking" a strawman, can type extensively; everything vanishes on navigation because `onSave` is `() => {}`.
**Refactor:** wrap `dispatch` when `readOnly` so content mutations are dropped (allow `GO_STEP`/`OPEN_PERSPECTIVE`/tab actions), or thread `readOnly` into `Canvas`.

**B7. Assignment due-date off-by-one across timezones**
`components/classroom/AssignmentPanel.tsx:684` — `new Date(due).toISOString()` parses the `<input type="date">` value (`YYYY-MM-DD`) as **UTC midnight**; `lib/classroom/assignments.ts:52` (`dueLabel`) then renders it in local time. For any teacher/student west of UTC, "Due Jun 6" displays as "Due Jun 5".
**Refactor:** store the date as a plain `date` column, or render with `timeZone: 'UTC'`, or construct local midnight before serializing.

**B8. Signup with email-confirmation enabled dead-ends silently**
`app/login/page.tsx:handleSubmit` — after `signUp`, the code assumes a live session: it updates `profiles` (error ignored) and `router.push(nextPath())`. If Supabase email confirmation is on, there is no session, the profile update silently fails, and middleware bounces the user back to `/login` with no "check your email" message.
**Refactor:** branch on `result.data.session === null` and show a confirmation-email notice; check the profiles-update error.

**B9. `SubmissionFeedback.load` ignores read errors → teacher can clobber existing feedback**
`components/build/SubmissionFeedback.tsx:40-53` — the `select` error is discarded. In edit mode, a failed read renders an *empty* grade/feedback form; the teacher's next "Save feedback" **upserts blanks over the existing row**. In view mode a failed read looks identical to "no feedback yet."
**Refactor:** track a load-error state; block save (or warn) until the initial read succeeded.

### Low

**B10. Misleading placeholder actions in the shipped builder**
`lib/build/state.ts` `PUBLISH` ("House published · strength N"), `EXPORT` ("Exported as PDF"), `SEND_INVITE` ("Invite sent to X"), `COPY_LINK` — all pure toast theater; nothing is published, exported, sent, or (for the builder invite) copied. Similarly the dashboard card "Share" (`HouseCard.tsx:48`) copies a `/build/<id>` URL that only the owner/teacher can open — recipients get bounced to their own dashboard. Users will believe they exported a PDF and invited a collaborator.
**Refactor:** disable/label these as "coming soon" or remove until wired.

**B11. Middleware makes an auth network round-trip on every public page**
`middleware.ts` — the matcher covers all non-static routes (marketing pages, `/examples`, `/faq`…), and `supabase.auth.getUser()` is a network call to Supabase per request, even for anonymous visitors. Latency cost with no benefit outside the five protected prefixes.
**Refactor:** scope the matcher to the protected prefixes (plus wherever session refresh is genuinely needed).

**B12. `/classes` claims middleware protection it doesn't have**
`app/classes/page.tsx` comment: "Auth is enforced by middleware" — but `/classes` is not in `PROTECTED_PREFIXES` (`middleware.ts:5`). The page self-guards client-side, so it works, but the comment is wrong and unauthenticated visitors get a loading flash + client redirect instead of a server redirect.
**Refactor:** add `/classes` to `PROTECTED_PREFIXES` (and keep the comment true).

**B13. Fire-and-forget writes with ignored errors scattered across classroom UI**
`StrawmanAuthor.toggleEnabled` (`:61`), `AssignmentPanel.reorder` (`:712` — parallel updates, errors ignored, partial reorder possible), `dashboard handleRename`/`handleTurnIn` (silently no-op on error, no user feedback on rename failure). Each leaves UI state and DB state divergent on failure.

---

## SMELLS

### Dead code
- **`components/build/rail/TeamPanel.tsx` is entirely unused** — `RightRail` in `BuildHousePage.tsx` renders its own `EmptyTeam` instead; nothing imports `TeamPanel`.
- **`lib/build/suggestions.ts` (222 lines) is unreachable** — marked DEPRECATED, but more than that: no component dispatches `ACCEPT_SUGGESTION` anymore, so the suggestion bank, the reducer case (`state.ts:347`), the action type, and the persisted `accepted` field are all dead plumbing that still round-trips through the DB (`houses.accepted` column) on every save.
- **`lib/build/people.ts` `seededPresence` / `activityFeed`** — only consumed by the dead `TeamPanel`.
- **`components/profile/DeleteAccountModal.tsx:46`** — stale copy/comment: "Account deletion will be available once accounts are backed by a database" — accounts *are* DB-backed now (Supabase auth + profiles). Users who type DELETE get nothing but a shrug.

### Duplication
- `hashString` (djb2) defined twice, byte-identical: `CopilotPanel.tsx:33` and `CritiqueSection.tsx:36` → move to `lib/`.
- The `centerNotice` loading-style object is copy-pasted in ~8 pages (`app/build/[id]`, `/build`, `/house`, `/dashboard`, `/classroom`, `/classroom/[classId]`, `/classes`, assignment detail) → one `<CenterNotice>` component.
- `handleSignOut` (signOut → push('/login') → refresh) is duplicated in ~9 components → a `useSignOut()` hook.
- All six AI routes repeat the identical ~30-line prologue: `enforceAiLimit` try/catch → `req.text()` → byte guard → `JSON.parse` → `safeParse` → error-mapping catch. Extract a `handleAiRoute(req, schema, maxBytes, fn)` helper; each route body shrinks to its actual logic.
- Two different exported `statusMeta` symbols with unrelated meanings: `lib/dashboard/houses.ts` (house status chip) and `components/admin/AiMonitor.tsx:71` (probe status). Rename one.

### Consistency
- Every AI route still imports from the deprecated shim `@/lib/ai/groq`, whose own header says "new code should import from '@/lib/ai/router'". Either migrate the six routes (mechanical) and delete the shim, or drop the comment.
- **Decision-record numbering collision:** `decisions/013-multi-provider-routing.md` and `decisions/013-standardize-on-pnpm.md`.
- Error-code vocabulary is fragmented: `'rate-limited'` (daily cap, matched by client copy), `'ai-rate-limited'` (provider 429 — client shows generic "Couldn't reach the co-pilot / Retry"), `'ai-context-overflow'` (413 — client also shows "Retry", which is bad guidance since retrying an oversized house can't succeed). Consider a small client-side code→copy map covering all `AiError` messages.
- `'en-US'` hardcoded in `dueLabel` and `editedLabel` date formatting.
- Three `eslint-disable-next-line` comments exist, but **ESLint isn't installed** — no config, no `lint` script, no Prettier. The disables are decorative.

### Types
- Pervasive unchecked casts at the Supabase boundary: `data as HouseRow[]`, `row as ProfileRow`, `members as RosterMemberRow[]`, `houseRow?.is_strawman === true`, etc. Zod is already a dependency and already validates the AI boundary — row schemas (or generated Supabase types via `supabase gen types`) would close the biggest remaining type hole.
- `lib/build/persistence.ts` `toConcepts`/`toPerspectives` operate on effectively-`any` elements from `unknown[]`; tolerable normalization code, but a zod schema would express the legacy-shape tolerance explicitly.
- Credit where due: no `any` annotations, no `@ts-ignore` anywhere; `strict` is on; `tsc --noEmit` is clean.

### Tests
- **There are zero tests** — no framework, no test script, no test files. This is the gap that stings most because the codebase was visibly built to be tested: `serializeHouseForPrompt` is a documented pure function "also exercised by tests", `router.ts` ships a `__resetRouterState()` test-only hook, and `reducer`/`computeStrength`/`persistence` mappers are all pure. None of that scaffolding has any tests behind it. Critical untested paths: router failover ordering + penalty box + daily airbag; the reducer; `loadHouse`/`saveHouse` round-trip; `deriveStatus`/`layerDone` thresholds.

### Maintainability / structure
- `lib/ai/router.ts` is **836 LOC**, violating the repo's own ≤600 LOC rule (CLAUDE.md). Natural seam: routing engine (targets, lanes, execute, completeJSON) vs. observability (health/events/snapshot/probe/detail) — the latter is ~300 lines with no coupling beyond `record()`.
- Per-keystroke O(house) work in the builder: `BuildHousePage` calls `serializeContent(state)` every render, `CopilotPanel` and `CritiqueSection` each do `hashString(serializeContent(state))` every render, and `BuildHousePage.tsx:168` does `JSON.parse(contentKey)` inline per render in feedback-edit mode. Fine today; memoize if houses grow.
- `app/build/[id]/page.tsx` passes `feedback={'view'}` for *every* owner-opened house, so `SubmissionFeedback` fires a `submission_feedback` query on every non-assignment house open. Gate on `assignmentId`.
- Router module-global state (penalty box, health, daily flag) is per-serverless-instance — clearly documented with an upgrade path; acceptable, just noting the admin monitor's "this server instance" caveat is doing load-bearing work.

### Genuinely good (keep doing this)
`safeHttpUrl` guarding stored hrefs; the `AiActionSchema` type-level ban on AI-authored conclusions; Brave-URL allow-list validation in both research routes; admin gate failing closed while the rate limiter fails open (both documented); body-size guards before parse on every AI route; `.env` correctly ignored with a thorough `.env.example`; strict-mode double-invoke guard on join redemption.

---

## Highest-leverage cleanups (in order)

1. **Make house persistence loss-proof** (B1+B2): transactional save RPC, error checks on load *and* save, and a visible save-failure state. This is the only place users can permanently lose work today.
2. **Add a test harness** (vitest) and cover the pure core first: reducer, `computeStrength`/`layerDone`, `serializeHouseForPrompt`, persistence mappers, and router failover using the existing `__resetRouterState()` hook. High value, zero mocking needed for most of it.
3. **Install ESLint + Prettier + a `lint`/`typecheck` script** — the disable comments and hook-deps discipline already assume it.
4. **Extract the shared AI-route handler** — deletes ~150 duplicated lines across six routes and makes error mapping consistent in one place.
5. **Delete dead code**: `TeamPanel.tsx`, `suggestions.ts` + `ACCEPT_SUGGESTION` plumbing, `seededPresence`/`activityFeed`; migrate the `@/lib/ai/groq` shim imports; split `router.ts` at the observability seam.
6. **Close the account-type escape hatch** (B4) and fix the read-only builder (B6) — both undermine the classroom trust model the product is selling to schools.
