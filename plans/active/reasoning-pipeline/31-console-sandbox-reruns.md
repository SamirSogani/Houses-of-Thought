# 31 — Console: sandbox reruns with a diff (Loop C)

Phase 3 of doc [30](30-console-subagent-loops.md)'s Loop C, the resolution of
doc [29](29-console-multi-chat.md)'s rejected option 2: a chat can rerun a
stage into a **candidate** — a copy of the run, writing nothing to the house —
show a diff of what would change, and let the person promote or discard it.

## Data model — migration 0043

`reasoning_runs` gains five columns, all on the table doc 28/30 already made
service-role-only (deny-all RLS, no grant to `authenticated` — 0030/0031). No
RLS/grant change needed; every new read/write goes through
`lib/ai/reasoning/persistence.ts`'s existing service client, same as every
column before it.

| column | notes |
|---|---|
| `is_candidate` | `boolean not null default false`. Set `true` on every step of a sandbox run via `persistRunStep`'s new param — from the FIRST step, not just at completion. |
| `candidate_chat_id` | which chat owns it (on delete set null) — see "which chat owns a candidate" below. |
| `candidate_stage` | the `DraftStage` the rerun targeted — needed to recompute `cascadeStages` at diff/promote time. |
| `candidate_base_content` | jsonb snapshot of `serializeContent(state)` at the moment the sandbox run started — the diff/staleness baseline. |
| `candidate_resolution` | `null` (live) \| `'promoted'` \| `'discarded'`. |

Plus a **partial unique index** on `(house_id) where is_candidate and
candidate_resolution is null` — at most one *live* candidate row per house,
enforced by Postgres, not just application logic (see "one at a time" below).

**This migration is written only — never applied.** Local dev and production
share one Supabase database; per the task's hard prohibition, no `db push`,
no `psql`, no service-role script was run against it.

## Trap 1 — candidate isolation

`getReasoningRunByHouseId` (persistence.ts) now filters `is_candidate = false`
— the one place every "what's the house's current run" read goes through, so
every caller is fixed by fixing it once, not once each. Audited every call
site:

| call site | what it does with the fix |
|---|---|
| `app/api/houses/[id]/reasoning/route.ts` GET | Seeds the console's REAL-rerun starting point (`persistedRun`) — now genuinely excludes an in-flight/finished candidate. |
| `app/api/houses/[id]/console/chats/route.ts` GET | Computes the "stale chat" badge's `currentRunId` — a candidate no longer falsely marks every chat stale. |
| `app/api/houses/[id]/console/route.ts` POST | `run_id_at_last_reply` bookkeeping — now stamps the real run, not a candidate. |
| `app/api/houses/[id]/console/revise/route.ts` POST | Same bookkeeping, same fix. |

A NEW read, `getLiveCandidateRun(houseId)`, is the only function that
deliberately DOES read `is_candidate = true` rows — used only by the new
candidate route and the pre-flight check below.

## Trap 2 — the single-flight lock

**Candidates block real reruns and each other, deliberately, via the SAME
lock** (`getConflictingRunningRun`/`runLockBlocks`, keyed on
`status = 'running'` for the house) — a candidate row is a real, billed
pipeline run in flight, so a second one (candidate or real) starting
concurrently is exactly the double-spend Loop B's lock already exists to
prevent. No query change was needed for this half; a comment now says so
explicitly rather than leaving it implicit.

**A *finished* candidate also blocks a new one** — that isn't `status =
'running'` any more, so the lock above doesn't cover it. A second explicit
check, gated on the request carrying `?candidate=true`: `getLiveCandidateRun`
+ a new pure `candidateBlocksNewSandbox` (mirrors `runLockBlocks`'s shape,
reuses the same `STALE_RUN_LOCK_MS` staleness window so an abandoned sandbox
run — closed tab, never finalized — doesn't block forever). This check runs
BEFORE any orchestrator call, so it actually saves the compute, unlike the
partial unique index alone (which would only reject the background
`persistRunStep` write after the AI calls already ran).

A normal `/build/[id]` fresh pipeline run never sends `?candidate=true`, so
none of this touches it — verified by reading the dispatch path (report).

## Trap 3 — the runner never writes to the house in sandbox mode

`useReasoningPipelineRunner` gains `rerunSandbox(...)`, a near-twin of
`rerunFrom` that sets a `sandboxMode` ref+state and appends `?candidate=true`
to the step fetch. At `nextStep === null`, sandbox mode skips BOTH
`APPLY_REASONING_RESULT` and `APPLY_RERUN_RESULT` — no dispatch, no house
write. `start()`/`rerunFrom()` and their effect are untouched.

## Trap 4 — diff derived from the reducer, not a second mapping

`lib/ai/console.ts` gains `computeCandidateHouseState(base, stages, actions)`
— literally `reducer(base, { type: 'APPLY_RERUN_RESULT', stages, actions })`
— and `diffCandidateStages(base, candidate, stages)`, a normalized-text set
diff per cascaded layer (same `norm()` convention `aiActionApplicable`
already uses). The diff is `computeCandidateHouseState`'s OUTPUT versus its
input, so it is definitionally what promoting would do — not a parallel
run-state-to-layer mapping.

## Trap 5 — promote applies, never re-runs

Promote reuses the EXACT client-side path a real rerun's completion already
uses: `dispatch({ type: 'APPLY_RERUN_RESULT', stages, actions })` against the
live reducer, then the existing `save()`. `actions` comes from
`mapReasoningRunToActions(candidate.runState)` — the already-finished,
already-persisted run, read once via GET, never re-orchestrated. The server
side of promote (new route) does exactly two things: flip
`candidate_resolution = 'promoted'`, and insert the completion markers
(next). No pipeline step is invoked.

## Trap 6 — one marker path, reused

The marker-insertion body of `console/rerun-complete/route.ts` is extracted
into `console/rerunComplete.ts` (a plain helper, not a route file — same
pattern as `authorize.ts` in the same directory). Both the real-rerun
completion route and the new promote route call it; neither duplicates it.

## Also decided

- **Which chat owns a candidate**: `candidate_chat_id`, set once at finalize.
  The diff card renders only in that chat; every other chat just sees the
  "Preview as sandbox" trigger disabled house-wide while a live candidate
  exists (one pipeline cascade's worth of cost, in flight or waiting on a
  decision, is enough at a time — see below).
- **Staleness**: `candidateIsStale(baseContentJson, currentContentJson)` — a
  plain string compare of `serializeContent(state)` against the stored
  snapshot, re-checked on every render of the diff card and again,
  authoritatively, by `saveHouse`'s own optimistic-concurrency `rev` check at
  promote time. Stale hides Promote and explains why, rather than applying
  something that no longer describes the house.
- **Discarded/abandoned candidates**: marked, never deleted.
  `candidate_resolution = 'discarded'` on an explicit Discard click. An
  abandoned one (nobody ever clicks anything) is NOT swept — no job queue
  exists in this product (doc 30's Loop D was rejected for exactly that
  reason) — it just stops blocking new sandbox runs once
  `STALE_RUN_LOCK_MS` old. A real cleanup job is future work, flagged, not
  silently assumed.
- **One candidate at a time per house**: yes. It costs the same pipeline
  cascade as a real rerun (Trap 2), and a second live diff competing for the
  same house before the first is resolved has no clean promote story (which
  one wins?). Enforced twice: the pre-flight check (saves compute) and a
  partial unique index (data integrity if the check is ever bypassed).

## Files

New: this doc; `supabase/migrations/0043_reasoning_runs_candidate.sql`;
`app/api/houses/[id]/console/candidate/route.ts` (GET live candidate, POST
finalize, DELETE discard); `app/api/houses/[id]/console/candidate/promote/
route.ts`; `app/api/houses/[id]/console/rerunComplete.ts` (extracted helper);
`components/build/console/SandboxPanel.tsx`;
`components/build/console/useConsoleCandidate.ts`.

Changed: `lib/ai/reasoning/persistence.ts`, `lib/ai/console.ts` (+ its test
file), `app/api/houses/[id]/reasoning/route.ts`,
`app/api/houses/[id]/console/rerun-complete/route.ts` (now a thin wrapper),
`components/build/useReasoningPipelineRunner.ts`,
`components/build/console/ConsolePage.tsx`,
`components/build/console/ConsoleTranscript.tsx`.

## Deferred

A cleanup job for abandoned candidates; showing a candidate's existence (not
its diff) in chats that don't own it beyond the disabled trigger; letting a
candidate be re-targeted at a different chat after creation.
