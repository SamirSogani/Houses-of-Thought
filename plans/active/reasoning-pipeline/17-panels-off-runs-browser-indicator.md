# 17 — Panels-off indicator in the runs browser

Built 2026-08-04, the day after [16](16-ab-review-panel.md) (Phase 2 item 3).
Follow-up to a gap 16 flagged deliberately: the `/admin/reasoning/runs`
summary list distinguished two runs of the same question only by
timestamp — the auto-pass verdicts' `"[panels off]"` notes text is only
visible once you open a run's detail view. Samir asked for the summary list
itself to show it.

**Code below is committed** — check `git log` if that ever seems stale.
**Migration applied and real-verified 2026-08-04** — see "Real verification"
below.

## Design

**A dedicated column, not a JSONB read.** Unlike packet/verdict content
([15](15-persistence.md)'s reasoning for keeping `run_state` a single JSONB
blob), `panels_off` is run-level metadata fixed for a run's whole
lifetime — the same tier as the existing `status`/`last_step` columns, not
something to infer from `run_state`. Reading it out of the JSONB blob on
every list row would mean pulling the full blob just to check one flag; a
flat column matches how the adjacent metadata already works. 16 originally
argued against any schema change (see its own now-struck-through note); this
revises that once an actual need (the summary list) showed up, not a
speculative one.

- [`0032_reasoning_runs_panels_off.sql`](../../../supabase/migrations/0032_reasoning_runs_panels_off.sql) —
  `panels_off boolean not null default false`, additive-only, no RLS/grant
  change (same deny-all/service-role-only access as 0030/0031). Defaults
  `false` so every pre-existing row reads correctly as panels-on.
- `persistence.ts`: `persistRunStep` takes a `panelsOff` param, written on
  every upsert; `ReasoningRunSummary`/`ReasoningRunDetail` and both selects
  (`listReasoningRuns`, `getReasoningRun`) gained the field.
- `route.ts`'s `persist()` helper passes the request's `panelsOff` through.
- `ReasoningRunsBrowser.tsx`: a plain-mono-text `PANELS OFF` tag (matching
  the live pipeline page's own run-state badge style, not `StatusPill`'s
  amber "done" pill scheme — reusing that would read as a second status)
  next to the status pill, in both the list row and the detail header.

## Real verification — 2026-08-04

**Before the migration was applied**, a minimal real run (n=2, panels off,
deliberately stopped after 6 cheap steps rather than let it run to
completion — no reviewer calls since panels were off, keeping the check
cheap) surfaced this in the server log on every single step, not just the
panels-off ones:

```
{"level":"error","scope":"ai/reasoning/persistence","msg":"failed to persist run step (non-fatal)","step":"context-gather-pre","error":"Could not find the 'panels_off' column of 'reasoning_runs' in the schema cache"}
```

This confirmed the write path was correctly wired (right column name, right
value) and, more importantly, surfaced a real regression risk worth flagging
immediately rather than assuming: until 0032 was applied, `persistRunStep`'s
existing non-fatal try/catch
([persistence.ts](../../../lib/ai/reasoning/persistence.ts)) silently
swallowed this error for **every** real run, not just panels-off ones — no
`reasoning_runs` row got written at all, with no visible failure anywhere
except the server log. The pipeline itself was unaffected (persistence
failures were always designed to be non-fatal to the run), but the audit
trail [15](15-persistence.md) built would have gone dark for as long as the
migration stayed pending.

**After Samir applied 0032**, confirmed two ways:

- **Zero AI quota, direct schema check**: `curl` against the Supabase REST
  endpoint (`select=id,panels_off`, service-role key) returned `200` with a
  real `panels_off` value instead of the schema-cache error — confirms the
  column exists without spending a single real model call.
- **Live UI check** (existing persisted rows, no new pipeline run needed):
  `/admin/reasoning/runs` renders the earlier aborted test run with both a
  `RUNNING` status pill and a `PANELS OFF` tag; server logs show zero
  persistence errors on load. That run's own `perspectives-generate-details`
  server-side call — still executing after the client-side pause aborted the
  connection — happened to complete and persist successfully right around
  when the migration landed, making it the first row this feature actually
  wrote correctly.

**One narrow, expected, unfixed edge:** the two "Should our city ban
gas-powered leaf blowers?" runs from [16](16-ab-review-panel.md)'s own A/B
comparison predate 0032 entirely, so both now read `panels_off: false` (the
migration's default) in the browser even though one of them was actually
panels-off — the column didn't exist yet when they were written, so there
was nothing to backfill. Not worth a manual data fix for two historical rows.

## What's tested

Not unit-tested at the column/tag level — same rationale as
[16](16-ab-review-panel.md#whats-tested): this is metadata plumbing with no
interesting branching logic (a boolean written on upsert, read back and
rendered), verified live rather than pinned in a unit test the way
`runStatusFrom` was in [15](15-persistence.md).
