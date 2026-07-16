# Code Quality Review — Houses of Thought

**Auditor:** code-quality-reviewer (general-purpose subagent, model: fable)

**Scope:** full repo (Next.js 16 + React 19 + Supabase + multi-LLM router). ~18k LOC TS/TSX across `app/`, `components/`, `lib/`. `tsc --noEmit` passes clean under `strict: true`. No ESLint/Prettier config, no test infrastructure, no CI scripts beyond `dev/build/start`.

**Overall:** This is an unusually well-annotated codebase — module headers explain intent, invariants are named and enforced in types (e.g. `AiActionSchema` deliberately has no "set conclusion" variant), server-only modules throw if bundled client-side, and external data is zod-validated at every API boundary. The dominant weaknesses are (1) silent Supabase error swallowing on the persistence write path, (2) zero tests despite test-only hooks and comments claiming tests exist, and (3) heavy copy-paste across API route preambles and page-level scaffolding.

---

## 1. Bugs (correctness risks)

### B1 — HIGH: `saveHouse` ignores every Supabase error; autosave failures are invisible and can silently destroy data
`lib/build/persistence.ts:242-325`
None of the five `await supabase...` calls in `saveHouse` destructures or checks `error`. Supabase clients don't throw — they return `{ error }` — so a failed parent update, a failed child insert (after its delete succeeded), RLS rejection, or a network flap all resolve "successfully." The caller (`app/build/[id]/page.tsx:104`, `onSave={... saveHouse(createClient(), id, s)}`) fires and forgets, and `BuildHousePage` has no save-status UI. A user can edit for an hour with every write failing and never know. Worse, the acknowledged delete-then-insert non-atomicity (comment at line 239) combined with swallowed errors means a delete that succeeds followed by an insert that fails silently drops an entire layer's rows.
**Refactor:** check `error` on each call, throw or return a result, and surface a "Couldn't save — retrying" indicator in `BuildHousePage` (state already flows through `onSave`). Even a `console.error` would be an improvement; a visible failure state is the real fix. Longer-term, the transactional RPC the comment defers is the right hardening.

### B2 — HIGH: partial load failure + autosave = destructive overwrite
`lib/build/persistence.ts:177-233` (`loadHouse`) with `components/build/BuildHousePage.tsx:80-97`
`loadHouse` runs `Promise.all` on the four child tables and then maps `persp.data ?? []` etc. — a failed child select (transient network/RLS hiccup) is indistinguishable from "this layer is empty." The parent row check guards against total failure, but not per-child failure. The autosave in `BuildHousePage` skips only the first render; the user's next keystroke triggers `saveHouse`, whose delete-then-insert will now delete all real rows for the layer that failed to load. Silent, permanent data loss from a transient read error.
**Refactor:** in `loadHouse`, treat any child `error` as a load failure (`return null`) rather than an empty layer.

### B3 — MEDIUM: `/forgot-password` link 404s
`app/login/page.tsx:256` links to `/forgot-password`; no such route exists under `app/` (verified against the route list). Every user who forgets a password hits a 404 with no recovery path.
**Refactor:** implement the page (Supabase `resetPasswordForEmail`) or remove the link until it exists.

### B4 — MEDIUM: signup's authoritative `account_type` write is unchecked
`app/login/page.tsx:64-66`
The comment explains the 0013 trigger is racy, so the client "sets it deterministically" — but the `.update({ account_type })` result is discarded. If it fails (session not yet propagated, RLS), a teacher lands as `standard` (loses classroom) or a student escapes the Learn clamp (`capabilitiesFor` pins students to coach posture — this is a policy control). Also, if `signUp` returns a user requiring email confirmation, there is no session yet and this update will fail under RLS every time.
**Refactor:** check the error; retry or surface it. Better: make the DB trigger the single source of truth and drop the client write, per the repo's own "single source of truth" rule.

### B5 — LOW-MEDIUM: router health/monitor state is per-instance but the admin UI presents it as global
`lib/ai/router.ts:184-189, 256-257` and `components/admin/AiMonitor.tsx`
The header comment explicitly accepts per-instance penalty-box state as safe-degrading — correct for routing. But the same module-global `health`/`events` maps feed the admin monitor, which renders ok/fail counts and "last status" as if they were fleet-wide. On Vercel serverless, the panel shows whichever instance served the request; counts will appear to reset or contradict between refreshes. Not a routing bug, but a monitoring correctness gap that will mislead the operator during exactly the incidents it exists for.
**Refactor:** at minimum, label the snapshot "this instance only" in the UI; longer-term the Redis/Supabase-row swap already suggested in the comment.

### B6 — LOW: `computeStrength` name/logic mismatch suggests a lost filter
`lib/build/strength.ts:14` — `const withSrc = s.evidence.length` is named "with source" but counts all evidence, sourced or not. Either the variable name is stale or the intended `filter(e => e.source.trim())` was dropped; as written, three empty evidence stubs score the same as three cited items, and `layerDone(3)` (line 63) similarly counts blank rows toward completion.
**Refactor:** decide which is intended; if all-evidence is deliberate, rename the variable.

### B7 — LOW: `toggleEnabled` optimistic update never reconciles
`components/classroom/StrawmanAuthor.tsx:56-61` — local state is set before the unchecked `update`; on failure the checkbox and DB disagree until a reload. Same pattern in `generate()` step 1 (lines 71-79): a failed params write means the strawman route generates from stale DB params with no warning. And step 3's `saveHouse` (line 98) inherits B1 — the UI can report success while the strawman house saved nothing.

### B8 — LOW: `dashboard` rename/turn-in failures are silent
`app/dashboard/page.tsx:105-112, 124-130` — `handleDelete` sets an error message on failure but `handleRename` and `handleTurnIn` just do nothing (no state update, no message). A student clicking "Turn in" on a flaky connection sees the menu close and believes the work was submitted. That one deserves explicit failure feedback.

---

## 2. Error handling

- **Good:** the six AI routes consistently map `AiError` → status + code; `enforceAiLimit` fails open with logging (`lib/ai/limits.ts:109-121`); `braveSearch` has timeout, status mapping, and JSON-parse guards; the router's cascade discipline (only 429/overflow advances) is well reasoned and documented.
- **Smell:** `components/build/SubmissionFeedback.tsx:38-51` — `load()` ignores the select error, so in `view` mode a failed read renders as "no feedback yet" (student thinks they're ungraded). `runCritic` (85-99) silently no-ops on a non-ok response — the button resets with zero feedback; give it an error line like the save path already has (`saveError` is handled well, so this is an internal inconsistency).
- **Smell:** `components/try/TryItFlow.tsx:83` throws `new Error(data?.error ?? ...)` and renders the message directly. The mini-house route returns friendly copy so this works today, but it couples UI copy to server error strings; any route returning a raw code (as all the other AI routes do) would surface `ai-upstream-error` verbatim to end users.
- **Smell:** no React error boundaries anywhere (`grep` finds none). A render throw in the build workspace loses unsaved (in-debounce) work with a white screen. One boundary around `BuildHousePage` that flushes the pending save would be cheap insurance.
- **Note:** empty `catch {}` blocks are pervasive but nearly all are justified with comments (localStorage quota, clipboard denial, cookie set in RSC). This is disciplined, not sloppy.

## 3. Types

- Strict mode on, `tsc` clean, essentially zero `any` (the one grep hit is a comment). External data is zod-parsed at every API entry; LLM output is schema-validated with a self-correction retry (`router.ts:804-825`). Genuinely strong.
- **Smell:** DB rows are shaped by convention casts, not validation — e.g. `loadHouse` (`persistence.ts:198-217`) casts `r.sub_questions as Perspective['subQuestions']`, `house.accepted as Record<number, number[]>`; `app/classroom/[classId]/page.tsx:68,80` casts RPC results. One malformed jsonb row becomes a runtime render error. The repo already owns the defensive-normalizer pattern (`toConcepts`/`toPerspectives` for localStorage); extending it to the DB path (or generating Supabase types via `supabase gen types`) would close the last unchecked boundary.
- **Smell:** `app/api/ai/suggest/route.ts:69-71` — `house` is accepted as `z.record(z.unknown())` then cast to `HouseForPrompt`. `serializeHouseForPrompt` is written defensively so it holds, but the cast means the serializer's assumptions (e.g. `p.subQuestions ?? []`) are the only guard; a `HouseForPrompt` zod schema would make the boundary honest across all six routes at once.
- **Smell:** `as Parameters<typeof client.chat.completions.create>[0]` casts (`router.ts:425, 764`) suppress the streaming/non-streaming union. Understandable, but a small typed helper would remove two of the three assertions in the file.

## 4. Duplication & dead code

- **Smell (biggest duplication):** every AI route repeats the identical ~35-line preamble — `enforceAiLimit` try/catch, `MAX_BODY_BYTES` guard, `req.text()` → `JSON.parse` → `safeParse`, and the identical trailing `catch (err)` AiError mapper (`app/api/ai/{suggest,research,strawman,interview,critique,mini-house}/route.ts`). A `withAiRoute(schema, maxBytes, handler)` helper would delete ~180 lines and make the next route impossible to get wrong.
- **Smell:** page-scaffold copy-paste — `centerNotice` style literal duplicated in 7 pages; `handleSignOut` duplicated in 9 files; the `profiles.select('account_type')` + `capabilitiesFor` dance duplicated in 4 pages while `lib/auth/account.ts` exists to do exactly this (server-side only — a client-side sibling hook, e.g. `useAccountType()`, is the missing piece).
- **Dead code:** `app/welcome/page.tsx` — orphaned (nothing links to it) and self-labeled "Placeholder." `window.__miniStart` (`components/try/TryItFlow.tsx:62-64`) is written and never read — leftover debug instrumentation. `LOCAL_HOUSE_KEY` (`persistence.ts:93`) exported, never imported. `__resetRouterState` (`router.ts:829`) is a test hook with no tests. `lib/build/suggestions.ts` is explicitly marked DEPRECATED but still 222 lines wired into the reducer via `ACCEPT_SUGGESTION` — verify whether any UI still dispatches it and delete if not.
- **Good:** `lib/ai/groq.ts` is an honest, documented compat shim — though all six routes still import from it rather than `@/lib/ai/router`; a mechanical rename would let the shim die.

## 5. Consistency

- Naming and structure are highly consistent (`lib/<domain>` row→viewmodel mappers all mirror each other; `Row`/`Summary` conventions; snake_case DB → camelCase UI).
- **Smell:** no ESLint or Prettier config exists, yet three `eslint-disable-next-line react-hooks/exhaustive-deps` comments do (`BuildHousePage.tsx:96,108`, `CopilotPanel.tsx:112`) — the disables are vestigial and nothing enforces format/lint on commit. Adding `eslint-config-next` + a `lint` script is near-free and this codebase would pass it almost immediately.
- **Smell:** two different `statusMeta` exports (`lib/dashboard/houses.ts:25` and `components/admin/AiMonitor.tsx:35`) with different shapes — rename one before it bites an auto-import.
- **Smell:** error-code vocabulary is inconsistent: limiter 429 → `'rate-limited'`, provider 429 → `'ai-rate-limited'`. Client copy keys off `RATE_LIMITED_CODE` only — currently correct behavior (provider 429s are retryable, daily cap is not) but the distinction is implicit and undocumented at the client; one comment in `findings.ts` would prevent a future "fix" that merges them wrongly.
- Styling is 100% inline style objects. Consistent, but ~40% of component LOC is style literals (`login/page.tsx` is 376 lines of which maybe 60 are logic). Repeated tokens (`mono` label style, input style, card style) are re-typed dozens of times; a small shared style-constants module (as `profile/primitives.tsx` already hints at) would cut real bulk.

## 6. Structure & maintainability

- Module boundaries are genuinely good: `lib/build` (pure state) / `lib/ai` (server) / `lib/auth` / thin route handlers / presentational components. Server-only guards on every secret-touching module.
- **Smell:** `lib/ai/router.ts` at 836 lines exceeds the repo's own 600-LOC constitution. It contains four separable concerns: target/env config (~100), observability/health/detail (~250), error classification (~60), execution/facade (~250). Splitting observability out (`router-monitor.ts`) is the natural cut and gets both files under the limit.
- **Smell:** `BuildHousePage.tsx:166` — `JSON.parse(contentKey)` executes on every render when `feedback === 'edit'` (teacher grading view); memoize on `contentKey`.
- **Smell:** magic numbers with no named home: toast 2200ms / autosave 800ms (`BuildHousePage.tsx:70,91`), strength weights `*18+14`, `*7+16`, `*11+4` (`strength.ts` — referenced to a handoff doc, acceptable), `HARD_STOP_TURNS = 6` client vs `SOFT_TRANSCRIPT = 14` server for the same interview (two sources of truth for one policy — `InterviewCard.tsx:17` vs `interview/route.ts:22`).
- **Good:** clip caps in `serialize.ts` are named and sourced to the plan doc — that's the pattern the rest should follow.

## 7. Tests

- **There are none.** No runner, no config, no spec files. Meanwhile: `serialize.ts:7` claims "it is also exercised by tests" (stale/false comment) and `router.ts` ships `__resetRouterState` for tests that don't exist.
- The codebase is unusually testable — `reducer`, `applyAiAction`, `computeStrength`, `serializeHouseForPrompt`, `strawmanToState`, `capabilitiesFor`, and the entire router failover state machine are pure or module-local. The router alone (penalty box, daily airbag, size-aware skipping, overflow escalation, OpenRouter isolation) is ~15 high-value cases that currently can only be validated in production against paid APIs.
- Priority order if adding vitest: (1) router failover lanes, (2) `reducer` + `applyAiAction`, (3) persistence round-trip (`serializeContent` → `loadLocalHouse`, row-mapping in `loadHouse`/`saveHouse` against a mock), (4) `serializeHouseForPrompt` clipping.

---

## Highest-leverage cleanups (ranked)

1. **Check Supabase errors on the write path and surface save failures** (B1, B2, B4, B7, B8). One afternoon; converts several silent data-loss modes into visible, recoverable states. `loadHouse` returning `null` on child-select error is a two-line fix that removes the worst destructive-overwrite case.
2. **Extract the AI-route preamble helper.** Deletes ~180 duplicated lines, standardizes error copy (fixing the friendly-vs-raw-code inconsistency TryItFlow depends on), and makes body caps/schemas declarative.
3. **Stand up vitest + ESLint.** The router's failover logic is the most intricate code in the repo and the only validation it has ever had is live traffic; `__resetRouterState` is already waiting. ESLint is nearly free given how clean the code already is.
4. **Split `router.ts`** (config / monitor / engine) to honor the repo's own 600-LOC rule and shrink the blast radius of the file everything AI-related depends on.
5. **Delete dead weight:** `app/welcome`, `__miniStart`, `LOCAL_HOUSE_KEY`, the stale "exercised by tests" comment, and (after verifying) the deprecated `suggestions.ts` bank; migrate the six `@/lib/ai/groq` imports to `@/lib/ai/router` and retire the shim.
6. **Add `/forgot-password`** (or pull the link) — the only user-facing 404 shipped from a primary flow.
7. **Consolidate client-side account-type/capabilities lookup and page scaffolding** (`useAccountType()` hook, shared `centerNotice`/sign-out) — removes the 4-way duplication most likely to drift from the authoritative server gate.

The AI-invariant enforcement (schema-level bans, Brave-URL allowlisting, server-side posture clamps) and the routing engine's documentation are the strongest parts of this codebase; the persistence layer's silent-failure posture is the weakest and is where I'd spend the next unit of effort.
