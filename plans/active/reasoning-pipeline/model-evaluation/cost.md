# Cost — pricing, call volume, and the telemetry gap

Scope: `TARGETS.deepinfra`, swarm/synthesis lanes. See [README.md](README.md)
for the 🟢/📋/⏳ provenance legend.

## The honest headline: there is no per-run cost/token telemetry yet

[Decision 020](../../../../decisions/020-deepinfra-swarm-synthesis-lanes.md)
named this as a known gap when the DeepInfra lanes were built, and
[doc 20](../20-deepinfra-tuning-real-verification.md) confirms it's still
true as of the last tuning session: *"No automated per-run telemetry exists
yet... this doc's evidence is manual (log cross-referencing), not
automated."* Nothing in this session changed that. Every number below is
either a **request-count formula** (exact, computed from code) or a
**pricing rate** (from DeepInfra's own pages) — not a measured dollar total
or a measured average token count. Real usage data is ⏳ across this whole
doc; see the note at the bottom for what to paste in.

## Request count — exact, not estimated

[budget.ts](../../../../lib/ai/reasoning/budget.ts)'s `estimatePipelineCost`:

```
generators = 7n + 11
reviewers  = 9n + 45   (0 if panelsOff)
total      = 16n + 56
```

| n | Generators | Reviewers | Total calls | Peak concurrent (per app UI) |
|---|---|---|---|---|
| 2 (`MIN_N`) | 25 | 63 | **88** | ~18 |
| 3 (`MAX_N_PHASE1`) | 32 | 72 | **104** | ⏳ not shown by the UI at n=3 |

(88 matches the admin panel's own live estimate exactly: "≈ 88 calls (25
generators + 63 reviewers)".)

**This formula changed once already** — worth knowing if comparing against
older docs. Before the 2026-08-13 evidence-generation split (strategy →
populate → confidence, [doc 24](../24-evidence-redesign-and-failure-tracking.md)),
it was `generators = 5n+9`, `total = 14n+54` — [decision 020](../../../../decisions/020-deepinfra-swarm-synthesis-lanes.md)'s
"82 calls" figure for n=2 is that *old* formula (`14×2+54=82`), now stale;
the current n=2 total is 88, not 82.

## Per-call token ceilings (`maxTokens`) — budgets, not usage

What each call is *allowed* to spend, from the code. This is not what it
*actually* spends — real usage is typically well under the ceiling, but by
an unmeasured amount (see the gap above). `+3000` = `REPAIR_TOKEN_HEADROOM`
(budget.ts), added only on a repair/regeneration attempt, not first-pass.

| Call | maxTokens (first-pass) | +repair |
|---|---|---|
| context-gather (pre/post/ad-hoc) | 400 | — |
| frame-generate | 2000 | — |
| breadth-scoping | 500 | — |
| perspectives-generate-stances | 1000 | — |
| perspectives sub-questions | 1100 | +3000 |
| perspectives assumptions | 1200 | +3000 |
| perspectives counterargument | 1600 | +3000 |
| perspectives/global evidence strategy | 500 | — |
| perspectives evidence populate | 2400 | +3000 |
| global evidence populate | 2400 | +3000 |
| perspectives/global evidence confidence | 800 | +3000 |
| global-assumptions-generate | 900 | +3000 |
| conclusions-generate | 1800 | +3000 |
| implications-generate | 1800 | +3000 |
| final-composition | 1200 | — |
| review panel, per standard (×9) | 800 | — |
| master-review (rare escalation) | 2600 | — |

A full n=2 run's generator-side ceiling sums to roughly 20-25K tokens across
all 25 generator calls (rough arithmetic from the table above, not a
measured figure); the 63 reviewer calls add another ~50K ceiling
(63 × 800). **Treat this paragraph as a sanity-check upper bound, not a
cost estimate** — real output is typically a fraction of the ceiling.

## Pricing — only two of six tested models have a rate on file

| Model | Input ($/1M) | Output ($/1M) | Cached input ($/1M) | Source |
|---|---|---|---|---|
| `deepseek-ai/DeepSeek-V4-Flash-0731` | ~$0.08 | ~$0.18 | ~$0.016 | 📋 router-config.ts, fetched from DeepInfra's model page |
| `meta-llama/Llama-3.3-70B-Instruct-Turbo` | ~$0.10 | ~$0.32 | ⏳ | 📋 router-config.ts |
| `deepseek-ai/DeepSeek-V3` | ⏳ | ⏳ | ⏳ | not recorded anywhere in-repo |
| `Qwen/Qwen3-235B-A22B-Instruct-2507` | ⏳ | ⏳ | ⏳ | not recorded anywhere in-repo |
| `openai/gpt-oss-20b` (DeepInfra) | ⏳ | ⏳ | ⏳ | not recorded anywhere in-repo |
| `Llama-3.1-8B-Instruct` | ⏳ | ⏳ | ⏳ | not recorded anywhere in-repo |

DeepSeek-V4-Flash-0731 is meaningfully cheaper per-token than Llama-3.3-70B
was — but Llama never completed a real run to compare *effective*
per-decision cost against (see [reliability.md](reliability.md)), so this
isn't a fair apples-to-apples comparison yet.

## Planning targets — never validated against real spend

[Decision 020](../../../../decisions/020-deepinfra-swarm-synthesis-lanes.md):
*"well under the original $0.012/decision and $36/month@100-decisions/day
planning targets at both n=2 and n=3, assuming DeepInfra serves most
calls"* — explicitly a planning estimate from a financial-case writeup that
was never committed to the repo, not a measurement. No session since has
gone back and checked real spend against these targets.

One qualitative data point on real volume: doc 20 estimates *"on the order
of a dozen n=2 real runs (≈82 calls each, old formula) across [one] day's
testing"* — roughly 1,000 calls in one tuning session — *"consistent with,
not exceeding, the 'run sparingly' guidance."* No dollar figure attached.

## ⏳ Still needed (Samir: paste these in)

- Real per-run token usage (input/output), from DeepInfra's dashboard or
  Vercel logs — the `maxTokens` table above is a ceiling, not a
  measurement.
- Real dollar cost per run, per model — DeepInfra's dashboard shows exact
  billed amounts per request (already used once this session's history, to
  confirm requests were received/billed during the reliability
  investigation — see [reliability.md](reliability.md) — but never
  captured as a running total).
- Pricing for DeepSeek-V3, Qwen3-235B-A22B-Instruct-2507, and gpt-oss-20b
  on DeepInfra specifically (their model pages have this; just not fetched
  and recorded in this codebase yet).
- Whether real spend has ever approached the $0.012/decision /
  $36/month@100/day planning targets, now that real traffic exists.
