# 15 — Persist packets/verdicts (Phase 2 item 1)

Built 2026-08-02, following [14](14-dynamic-budget-enforcement.md) (Phase 2
item 2, already done). Resolves the "whether" [04](04-verification-and-open-questions.md)
left open: **yes, persist.**

**Code below is committed** — check `git log` if that ever seems stale.
**0030 applied to Supabase 2026-08-02 (Samir). 0031 (below, adds the browsing
UI's `select` grant) not yet applied — see "What's not done."**
**Not yet real-verified live** — needs 0031 applied first; see "What's not
done" below.

## The "whether" — why yes, now

Before this change, `app/api/admin/reasoning/route.ts` was fully stateless
server-side: no Supabase writes anywhere in it. The client resends the full
run state every step request, and the only record of a completed run was the
browser tab's in-memory React state (gone on refresh/close) plus ephemeral
per-instance server console logs. Concretely, that meant every real run this
plan has documented — Phase 1.5's bug hunts, [13](13-two-more-real-runs-and-a-grant-bug.md)'s
cascade, [14](14-dynamic-budget-enforcement.md)'s Run A/B — left no durable
trace; the record that exists is what got hand-transcribed into these plan
docs from console logs and network response bodies during the session. That's
exactly the audit/replay use case [04](04-verification-and-open-questions.md)
named, and it's already been happening manually, by hand, every session.

## Shape — one JSONB row per run, not relational packet/verdict tables

`RunState` (route.ts) already *is* the full packet+verdict set as one
object — [02](02-data-contracts.md)'s packet shapes all live inside it as-is.
`houses.draft jsonb` ([0022_houses_draft.sql](../../../supabase/migrations/0022_houses_draft.sql),
decision 016) is this app's own existing precedent for persisting AI-pipeline
progress state as a single JSONB blob rather than a relational schema. No
query need has surfaced yet for slicing one packet type (e.g. "every
Conclusions packet") across runs — building a relational schema now, while
`RunState` itself is still actively changing most sessions, would be
speculative. New table: `reasoning_runs`
([0030_reasoning_runs.sql](../../../supabase/migrations/0030_reasoning_runs.sql)) —
`id uuid primary key` (client-generated), `original_query`, `status`
(`running` / `halted` / `done`), `last_step`, `halt_reason`, `run_state
jsonb`, `created_at`, `updated_at`. Deny-all RLS + `service_role`-only grant,
same pattern as
[0028](../../../supabase/migrations/0028_ai_daily_exhaustion.sql)/[0029](../../../supabase/migrations/0029_fix_ai_daily_exhaustion_grant.sql).
0030 originally granted only `insert, update` ("nothing reads this table back
yet") — once the browsing UI below was actually requested,
[0031](../../../supabase/migrations/0031_reasoning_runs_select_grant.sql)
added `select`, same server-only/service-role-only access model.

## Scope — incremental per real step, not completion-only

Written on every real (non-dry-run) step response, not just at
final-composition. The two motivating incidents in this plan (doc 13's
cascade, doc 14's Run B) both *halted* mid-run — a completion-only write
would miss exactly the runs worth auditing. Dry runs are skipped entirely
(`persist()`'s first check in route.ts): they're free, synthetic, make no
real AI calls, and would just pollute the table.

## Implementation

- [`lib/ai/reasoning/persistence.ts`](../../../lib/ai/reasoning/persistence.ts) —
  fire-and-forget `persistRunStep`, mirroring
  [`router-state.ts`](../../../lib/ai/router-state.ts)'s `persistDailyExhausted`
  exactly: same service-role client (lazily created, `NEXT_PUBLIC_SUPABASE_URL`
  + `SUPABASE_SERVICE_ROLE_KEY`), same `VITEST`-env hard-gate so tests can
  never write real rows, same contract — never awaited by the caller, never
  throws, a failed write just logs and is otherwise silent (that run has no
  durable record; the pipeline itself is unaffected).
- `route.ts`: added `runId` (client-generated UUID) to `RequestSchema`. Moved
  `ok`/`retryStep`/`halted` from module scope to nested inside `POST` so they
  close over the request's `run`/`runId`/`dryRun` — a single `persist()`
  helper called from all three, merging `{...run, ...patch}` (the same merge
  the client already does) and deriving status via `runStatusFrom(nextStep,
  isHalted)`. This avoided threading `run`/`runId` through all ~15 existing
  call sites individually; every case body in the switch is unchanged.
- `ReasoningPipelinePage.tsx`: `start()` now generates
  `runIdRef.current = crypto.randomUUID()` once per run, sent as `runId` on
  every step fetch. Not otherwise used client-side — the run is still tracked
  by React state exactly as before.
- `runStatusFrom` unit-tested (`persistence.test.ts`) — the one pure branch
  worth pinning. Also pinned: `persistRunStep`/`listReasoningRuns`/
  `getReasoningRun` each resolve cleanly (no-op/`null`) rather than throwing
  under the test runner's `VITEST` gate — that's the whole contract worth
  asserting without inventing a Supabase mock this codebase doesn't otherwise
  use.

## Browsing UI — added same day, once actually requested

Originally scoped out (see below) — Samir asked for it directly after
applying 0030. Read side, added to `persistence.ts`: `listReasoningRuns()`
(summaries, capped at 50, most-recently-updated first — a debugging list, not
a paginated archive) and `getReasoningRun(id)` (full row incl. `run_state`).
Both `null`-return-on-failure rather than throwing, matching
[`lib/ai/limits.ts`](../../../lib/ai/limits.ts)'s `getAiUsageSummary` — the
existing pattern for an admin-monitor read that should degrade to "read
unavailable" in the UI, not a 500.

- `app/api/admin/reasoning/runs/route.ts` (list) and `runs/[id]/route.ts`
  (one run's full state) — admin-gated GETs, same shape as
  `/api/admin/ai-status`.
- `components/admin/reasoning/ReasoningRunsBrowser.tsx` + new page
  `/admin/reasoning/runs` — single-page master/detail (matching `AiMonitor`'s
  dense-single-page convention over a separate `[id]` route). The detail view
  reuses `ReasoningStagesList` — the *same* component the live pipeline page
  renders progress with — against the stored `run_state`, so a historical run
  renders identically to how it looked live; `currentStep` is set to the
  run's `last_step` to highlight where a halted run actually stopped.
- `FinalAnswerCard.tsx` extracted from `ReasoningPipelinePage.tsx`'s inline
  JSX (previously duplicated verbatim would've been needed in both the live
  page and the browser) — single source of truth for rendering a `FinalAnswer`.
- A `status: 'running'` row has no separate liveness signal — it may be a
  genuinely in-progress run, or one whose tab was closed mid-run and never
  reached a terminal step. Flagged directly in the UI rather than guessed at
  with a staleness heuristic (e.g. "abandoned after N minutes idle"), which
  would be speculative machinery for a need that hasn't shown up yet.

## What's not done (deliberately out of scope here)

- **Not real-verified live.** Confirmed 2026-08-02: after 0030 was applied,
  loading `/admin/reasoning/runs` surfaced `permission denied for table
  reasoning_runs` in the server log (`listReasoningRuns`'s error path) — real
  proof the API route reaches the real table, but 0031's `select` grant
  didn't exist yet to satisfy it. Once 0031 is applied, real verification is:
  check `/admin` provider health, trigger one real (non-dry-run) step (any
  single step — even `context-gather-pre` — hits `persist()`), confirm the
  row appears in the browser. Dry-run verified end-to-end in browser
  2026-08-02 (all 17 steps, clean finish, zero console/server errors) —
  confirms the request/response wiring and the `dryRun` persistence skip, not
  the real write path.
- **No pagination, no delete/retention.** 50 most-recent rows, no cap on how
  long a row lives. Fine at today's real-run volume (this plan's whole
  history is a handful of real runs); revisit if `reasoning_runs` actually
  grows large enough for either to matter.
