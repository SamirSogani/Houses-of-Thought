# Latency — side-by-side across tested models

Scope: `TARGETS.deepinfra` ([router-config.ts](../../../../lib/ai/router-config.ts)),
the model behind the `swarm`/`synthesis` lanes only — see
[README.md](README.md) for the provenance legend (🟢/📋/⏳).

## Full-run total, where a complete real run exists

| Model | Total real time (n=2, panels on) | Source |
|---|---|---|
| `deepseek-ai/DeepSeek-V4-Flash-0731` | **~4m 6s** (245.8s summed across all 22 real calls) | 🟢 this session, local dev, full breakdown below |
| `Qwen/Qwen3-235B-A22B-Instruct-2507` | Not recorded as one number — per-call range only: **5–25s typical, one 119s outlier** | 📋 commit `e8a8682` |
| `deepseek-ai/DeepSeek-V3` | Not recorded as one number — one step alone (`perspectives-generate-details`) took **2.3 min**; the whole Perspectives layer took **>8 min** | 📋 router-config.ts / commit `e8a8682` |
| `meta-llama/Llama-3.3-70B-Instruct-Turbo` | Never reached — failed on JSON fences before a full run completed. Per-call: **~25–27s**, faster than DeepSeek-V3 | 📋 commit `e8a8682` |
| `openai/gpt-oss-20b` | Never reached a clean full-run baseline — kept failing at `perspectives-generate`/`global-assumptions` across multiple sessions | 📋 docs 20, 22, 23 |
| `Llama-3.1-8B-Instruct` (original default) | ⏳ | — |

**DeepSeek-V4-Flash-0731 is the only model with a complete, real, per-step
latency breakdown on file** — every other row above is either a partial
per-call figure or a "never finished" case. Treat the full-run comparison as
one real data point, not a trend, until more full runs exist for the other
models (or Samir pastes in more from other sessions).

## DeepSeek-V4-Flash-0731 — full per-step breakdown 🟢

One real (non-dry-run) run, n=2, panels on, local dev server, 2026-08-14.
Every one of the 22 real calls the pipeline made, in order:

| # | Step | Time |
|---|---|---|
| 1 | context-gather-pre | 3.6s |
| 2 | frame-generate | 8.9s |
| 3 | frame-review (9-panel) | 10.3s |
| 4 | context-gather-post | 1.8s |
| 5 | breadth-scoping | 2.4s |
| 6 | perspectives-generate-stances | 16.8s |
| 7 | perspectives-generate-details | 45.0s |
| 8 | perspectives-evidence-strategy | 3.4s |
| 9 | perspectives-evidence-populate | 29.2s |
| 10 | perspectives-evidence-confidence | 1.8s |
| 11 | perspectives-review (9-panel × 2 bundles) | 11.1s |
| 12 | global-assumptions-generate | 20.2s |
| 13 | global-assumptions-review (9-panel) | 9.9s |
| 14 | global-evidence-strategy | 3.3s |
| 15 | global-evidence-populate | 5.9s |
| 16 | global-evidence-confidence | 2.6s |
| 17 | global-evidence-review (9-panel) | 8.0s |
| 18 | conclusions-generate | 20.3s |
| 19 | conclusions-review (9-panel) | 15.0s |
| 20 | implications-generate | 11.5s |
| 21 | implications-review (9-panel) | 6.5s |
| 22 | final-composition | 8.3s |
| | **Total** | **245.8s (~4m 6s)** |

### By pipeline area (matches `LAYER_GROUPS`, steps.ts)

| Area | Time | % of total |
|---|---|---|
| Perspectives (steps 6–11) | 107.3s | 44% |
| Conclusions (18–19) | 35.3s | 14% |
| Global assumptions (12–13) | 30.1s | 12% |
| Global evidence (14–17) | 19.8s | 8% |
| Implications (20–21) | 18.0s | 7% |
| Frame (2–3) | 19.2s | 8% |
| Final composition (22) | 8.3s | 3% |
| Context-gather-pre (1) | 3.6s | 1% |
| Context-gather-post (4) | 1.8s | 1% |
| Breadth-scoping (5) | 2.4s | 1% |

**Perspectives dominates**, as expected — it's the pipeline's one fan-out
layer (n perspectives × up to 4 sub-calls each, per
[README.md](../README.md)'s architecture diagram), so it's mechanically the
most expensive area regardless of which model runs it. This also matches why
`perspectives-generate-details`/`perspectives-evidence-strategy` are the
steps that showed up failing in production under Qwen (see
[reliability.md](reliability.md)) — most parallel calls against one target
means the most exposure to any single call's flakiness.

## The one production failure with real timestamps 🟢

Qwen3-235B-A22B-Instruct-2507, `houses-of-thought.vercel.app`, 2026-08-14:

- Run created: `02:53:37.66Z`
- Last durably-persisted checkpoint: `02:54:33.80Z` (~56s in — through
  Frame, both context-checks, and Breadth-scoping)
- Visible client-side failure: ~80s from start (a 502 on
  `POST /api/admin/reasoning`, surfaced as `ai-invalid-output`)

**Caveat:** this run predates the `after()` persistence fix (see the
[route.ts fix](../../../../app/api/admin/reasoning/route.ts)) — the
persistence-race bug found this same session means the 56s checkpoint could
understate real progress (a later successful step's write may have been
dropped before landing). The ~80s figure (client-observed) is more reliable
than the 56s one (server-recorded).

## ⏳ Still needed

- A second, third, Nth full real run per model — one data point per model
  isn't enough to call any of this a trend, especially given DeepInfra's own
  documented intermittency (see [reliability.md](reliability.md)).
- Per-provider latency for the other five providers (Groq, Mistral, Google,
  Cerebras, OpenRouter) outside the swarm/synthesis lanes — see
  `providers/*.md` for what's known qualitatively; none of those docs have a
  clean timing table yet.
- Samir: if you have Vercel Function Logs, DeepInfra dashboard exports, or
  `/admin` AI Router Monitor screenshots from other sessions, paste them in
  and this doc gets real additional rows instead of the current single
  data point per model.
