# 19 — Real verification: context-gather acting on `needs_user_input`

Companion to [18](18-context-gather-acts-on-input.md) (Phase 3 item 1) — full
evidence from the same 2026-08-04 session, split out to keep 18 under the
repo's doc-length guideline.

## Dry-run UI walkthrough, live in the browser

Free — exercises every new code path except the real `completeJSON`
round-trip.

- Started a run with the new dev-only "Simulate a clarifying question"
  toggle on. `context-gather-pre` paused with the structured two-question box
  rendered correctly (option buttons + "Other…"). Answered one via a picked
  option ("Middle school"), one via free text ("Charter network, multiple
  campuses") — submitted, and the pipeline resumed automatically into
  `frame-generate` → `frame-review` (9/9, dry run auto-pass), with both
  answers now shown read-only (`→ Middle school`, `→ Charter network, multiple
  campuses`) in the completed "Context check" row.
- `context-gather-post` paused next, same simulated question. This time
  clicked **Skip** — the run resumed and ran cleanly through breadth-scoping,
  both perspectives, both global layers, conclusions, implications, and final
  composition, with no further pauses (dry run has no more context-gather
  checkpoints past the two fixed ones) and zero console/server errors.
- **Ad-hoc, mid-flight**: caught the pipeline genuinely `paused` before
  `context-gather-pre` even resolved (via a `MutationObserver`-based click on
  "Pause" the instant it rendered — dry-run steps resolve faster than a
  polled click can reliably land, so this was the one piece that needed a
  tighter reaction than manual clicking). Clicked "Ask a clarifying
  question": a real request to the new `context-gather-adhoc` branch fired
  with `atStep: 'context-gather-pre'`, returned the simulated question, and
  rendered both in the interactive box AND in a new read-only "Ad-hoc
  questions" section ("Paused at: context-gather-pre") simultaneously.
  Answered both questions via option picks ("High school", "Per-school") and
  submitted — the pipeline correctly returned to **`paused`** (not
  `running`), exactly per the confirmed design (ad-hoc never auto-resumes).
  Clicked Resume, skipped through the two fixed checkpoints (still
  simulated), and the run completed to a final answer — with the ad-hoc
  Q&A still visible, unchanged, in its own section the whole time.

## Direct authenticated requests against the real route

In-page `fetch`, same session cookies — used to test append semantics and
error paths that UI-timing couldn't reliably exercise, and to confirm the
server side independent of any race.

- Two sequential `context-gather-adhoc` calls on the same `runId` (with the
  first entry's `answers` filled in before the second call) confirmed the
  list **appends, not replaces**: `adHocContextGathers.length` went 1 → 2,
  the first entry's `atStep`/`answers` survived unchanged, the second carried
  the new `atStep`.
- A third, real `breadth-scoping` call with that fully populated (one
  answered) `adHocContextGathers` array present in the request body returned
  `200` with a valid `breadthScoping` packet — confirms `buildExtraContext` /
  `serializeFrame`'s new `extraContext` param handle a populated, answered
  array without throwing, exercising the exact code path 12 orchestrator
  functions now share.
- Server logs (`preview_logs`, error-filtered) stayed clean throughout every
  dry-run and direct-request test above.

## Real (non-dry-run) calls

The one thing dry-run testing structurally cannot prove. Provider health
checked at `/admin` first: all targets `UNKNOWN`/no traffic today, none
`RATE-LIMITED` or `ERROR`.

- A real `context-gather-pre` call on a deliberately vague question ("Should
  our policy change?") returned `needs_user_input: true` with 3 genuine
  questions in the new nested shape, **all three with `options: []`** — real,
  unprompted confirmation that the updated `CONTEXT_GATHER_BLOCK` prompt's
  "leave options empty if too open-ended" instruction actually lands on a
  real model, not just that the schema is compatible. Real Brave search
  results came back attached for all three questions
  (`runSearches(verdict.questions_for_user.map(q => q.question))` correctly
  extracting `.question` from the new object shape).
- A real `frame-generate` call, given that vague original query plus two real
  free-text answers ("A K-12 school district's cell-phone-in-class policy";
  "Student focus/attention and measurable academic performance"), produced a
  frame whose `core_question` became **"Should a K-12 school district change
  its cell‑phone‑in‑class policy?"** — with `definitions`, `purpose`, and
  `scope_notes` all concretely reflecting the supplied answers rather than the
  original unanswerable query. This is the confirmed re-contextualization
  mechanism working against a real model, not a mock: the answer materially
  changed what got generated next, which was the entire point of building
  this over "storage only."
- Both real calls persisted correctly (`persistRunStep`, non-dry-run) and
  render correctly in the **historical** `/admin/reasoning/runs` browser: the
  "Context check" row shows both real questions with their real answers
  (`→ A K-12 school district's cell-phone-in-class policy`, etc.) as plain
  read-only text — confirming the shared `ReasoningStagesList.tsx` renders the
  new answer data identically on the live and historical paths, per the
  wrinkle flagged going in.

## Typecheck, lint, and existing tests

`tsc --noEmit` clean (via the throwaway-tsconfig workaround, doc 05 — a
concurrent `next dev` process was running). `eslint` clean on every changed
file. Existing test suite (`orchestrator-perspectives.test.ts`,
`persistence.test.ts`, 14 tests) still passes unmodified — the new
`extraContext`/`userAnswers` params are trailing and optional, so existing
positional calls in those tests are unaffected.

## Known minor gap, not fixed

`ReasoningStagesList.tsx`'s `stepDone()` for `context-gather-pre`/`-post`
returns true as soon as the verdict exists (`run.contextGatherPre != null`),
so the row's checkmark can show "done" for a split second while the step is
genuinely still `awaiting-input`. This predates this session (the check was
never given `frame-review`-style retry-aware treatment) and is purely
cosmetic — the actual gating (whether the step loop advances) is correct
regardless. Left as-is per scope.

## Known side effect

The real verification above left two test rows in `reasoning_runs`
(`"Should our policy change?"`, both stuck at `status: running` since they
were deliberately partial single-step calls, not full runs) — same category
as [17](17-panels-off-runs-browser-indicator.md)'s leftover "Schema check"
row. Harmless, left in place rather than attempting a DB delete outside this
session's scope.
