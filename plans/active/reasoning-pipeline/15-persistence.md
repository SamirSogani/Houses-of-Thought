# 15 — Persist packets/verdicts (Phase 2 item 1)

Built 2026-08-02, following [14](14-dynamic-budget-enforcement.md) (Phase 2
item 2, already done). Resolves the "whether" [04](04-verification-and-open-questions.md)
left open: **yes, persist.**

**Code below is committed** — check `git log` if that ever seems stale.
**Not yet real-verified live** — the migration below needs to be applied to
Supabase before a real (non-dry-run) run can prove the write path; see
"What's not done" below.

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
jsonb`, `created_at`, `updated_at`. Deny-all RLS + `service_role`-only
`insert, update` grant (no `select` — nothing reads this table back yet, see
"What's not done"), same pattern as
[0028](../../../supabase/migrations/0028_ai_daily_exhaustion.sql)/[0029](../../../supabase/migrations/0029_fix_ai_daily_exhaustion_grant.sql).

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
  worth pinning. `persistRunStep`'s Supabase call has no dedicated test, same
  as `router-state.ts`'s equivalent: the `VITEST` gate makes it a guaranteed
  no-op under the test runner, so there's nothing to assert without inventing
  a Supabase mock this codebase doesn't otherwise use.

## What's not done (deliberately out of scope here)

- **No UI to browse past runs.** This is write-only, matching
  `ai_daily_exhaustion`'s precedent (also write/read-only from server code,
  no admin UI). The task was "persist," not "build a viewer" — a browsing UI
  is a separate future change once there's an actual audit/replay need to
  point it at, and would need its own RLS policy or admin-gated read route
  (today's grant is `insert, update` only, no `select`).
- **Migration not yet applied to Supabase.** Per this repo's own
  [migrations workflow](../../../supabase/migrations/README.md), applying is
  a manual step (paste into the Supabase SQL editor) done outside this
  session. Until applied, `reasoning_runs` doesn't exist yet — real runs will
  hit `persistRunStep`'s try/catch, log a "relation does not exist" error
  non-fatally, and the pipeline itself will keep working exactly as before
  (this is the fire-and-forget contract working as designed, not a bug).
- **Not real-verified live.** Same reason: needs the migration applied first,
  then a real (non-dry-run) run, checked against `/admin` provider health
  first per this plan's standing discipline. Dry-run verified end-to-end in
  browser 2026-08-02 (all 17 steps, clean finish, zero console/server
  errors) — confirms the request/response wiring and the `dryRun` persistence
  skip, not the actual write path.
