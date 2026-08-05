# Decision 020 — Token usage & cost ledger

**Date:** 2026-08-04
**Status:** Implemented — a new admin-only panel at `/admin/usage` shows, per
model, input/output/total tokens and USD cost, across all five providers
([decision 013](013-multi-provider-routing.md)). Files: `app/admin/usage/*`,
`app/api/admin/token-usage/*`, `components/admin/TokenUsageMonitor.tsx`,
`lib/ai/token-usage.ts`, `supabase/migrations/0033_ai_token_usage.sql`, plus a
capture point in `lib/ai/router.ts`.

## Context

`ai_usage` (`lib/ai/limits.ts`, 0011) counts **calls** per subject per day for
rate-limiting — it was never a token or cost ledger, and nothing in the
router previously read `completion.usage` off the OpenAI-shaped response at
all. There was no way to answer "how many tokens are we burning, on which
model, and what does that cost" without pulling raw provider dashboards.

## Decision

### Capture point

`lib/ai/router.ts`'s `callProvider()` now reads `completion.usage` (prompt /
completion tokens — every target here is an OpenAI-compatible endpoint, so
this field is expected on all of them) and returns it alongside `content`.
`execute()` fire-and-forgets it into `lib/ai/token-usage.ts#recordTokenUsage()`
right after a successful attempt, tagged with the target's `provider`/`model`
and the call's `role`. Same non-blocking, never-throws contract as
`reasoning/persistence.ts`'s `persistRunStep` — a lost write drops one row
from the ledger, never the co-pilot response.

Admin-triggered liveness **probes** (`router-monitor.ts#probeTarget`) are a
separate code path that does not go through `callProvider`/`execute`, so
probe token spend is deliberately NOT recorded here — consistent with
decision 014's existing split ("a diagnostic must not perturb routing");
probes are also tiny (`max_tokens: 8`) and admin-initiated only.

### Storage: `ai_token_usage` (0033)

One row per successful call: `day`, `provider`, `model`, `role`,
`input_tokens`, `output_tokens`, `total_tokens`, `cost_usd`, `priced`. Same
deny-all RLS + service-role-only grant as `ai_daily_exhaustion` (0028) /
`reasoning_runs` (0030). `cost_usd` is computed **at write time** from the
pricing table current when the call happened, so editing prices later never
rewrites history — matching how a real invoice works.

Reads go through a `group by` RPC (`ai_token_usage_summary(since_day)`)
instead of `ai_usage`'s plain-select-then-aggregate-in-JS pattern: this table
gets one row per AI call (potentially thousands/day) rather than one row per
subject per day, so pushing the aggregation into Postgres keeps the admin
read's result set at "one row per distinct model" regardless of how much
history has accumulated. Retention: weekly `pg_cron` prune at 90 days, same
window as `ai_usage`'s (0023).

### Pricing table

`lib/ai/token-usage.ts` hand-maintains USD-per-1M-token rates keyed by the
exact `provider/model` string a call used (not the `TARGETS` slot name), so
an env-overridden model (`router-config.ts` documents per-target overrides)
is priced correctly if listed, or flagged `priced: false` — cost recorded as
$0 for that row, not silently guessed — if it isn't. No provider here exposes
a pricing API; rates were sourced 2026-08-04 from each provider's own pricing
page and should be re-checked periodically, especially Groq's `qwen3.6-27b`
entry (priced at the nearest published equivalent, `qwen3-32b` — Groq doesn't
list the exact id separately).

## Consequences

- The admin panel can undercount cost (rows marked `priced: false`) if a
  model is swapped in via env override before the pricing table is updated —
  the UI surfaces this explicitly rather than hiding it.
- Adding a new `TARGETS` entry (`router-config.ts`) requires a matching
  pricing-table row here or its usage silently reads as unpriced.
