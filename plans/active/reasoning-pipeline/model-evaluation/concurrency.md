# Concurrency — 9 simultaneous real runs against production

See [README.md](README.md) for the 🟢/📋/⏳ provenance legend. Everything in
this doc is 🟢 — first-hand, this session, 2026-08-14.

## Setup

9 concurrent real (non-dry-run) pipeline runs, n=2 each, launched via 9
separate browser tabs against `houses-of-thought.vercel.app` (production).
**Not 10** — the Browser pane hit a hard 9-tab cap. Model in production at
the time: **Qwen/Qwen3-235B-A22B-Instruct-2507** (not
DeepSeek-V4-Flash-0731 — that swap is local/uncommitted; see
[providers/deepinfra.md](providers/deepinfra.md)). Code under test was
**pre-fix**: neither the generic-catch-all persist patch nor the `after()`
persistence fix (both from earlier this session) were deployed — this test
measured the system as it actually runs today, which is also why it caught
the persistence bug live (Finding 1 below).

Launch was sequential, not simultaneous (~90s to fire all 9, one browser
automation click at a time) — but each run takes minutes, so there was
substantial real overlap for most of each run's lifetime. Every run needed
manual "Skip" clicks past `needs_user_input` clarification pauses (Finding
3) — genuinely hands-off concurrent testing wasn't possible.

## Results

| Question | Outcome | Wall-clock (created → last recorded write) |
|---|---|---|
| Should a city require solar panels on all new residential construction? | ✅ Done | 12m 5s |
| Should a college make standardized testing optional for admissions? | ✅ Done | 11m 9s |
| Should public libraries eliminate late fees? | ✅ Done | 10m 22s |
| Should a mid-sized city switch its bus fleet to electric buses? | ✅ Done (1 retry loop) | 16m 28s |
| Should a hospital adopt a four-day work week for nurses? | ✅ Done (1 upstream failure + retry) | 16m 58s |
| Should a nonprofit accept cryptocurrency donations? | ⚠️ Completed, DB never recorded it | ≥11m 49s (true time unknown) |
| Should a startup outsource its customer support to a call center? | ⚠️ Completed, DB never recorded it | ≥12m 44s (true time unknown) |
| Should a manufacturing plant switch to a four-day production week? | ⚠️ Completed, DB never recorded it | ≥17m 22s (true time unknown) |
| Should our school ban homework? | ❌ Genuinely halted | 8m 8s |

Baseline for comparison: a solo real run earlier this session (different
model, DeepSeek-V4-Flash-0731, uncontended) took **~4m 6s**. These 9
concurrent Qwen runs ran roughly 2–4x longer, several needing internal
retries. Can't cleanly separate "concurrency slowed it down" from "this
model/question-set combination is just harder" from one test — see
Limitations below — but the magnitude is large enough to be worth watching.

## Finding 1 — the persistence-race bug loses **3 of 9 (33%)** real completions

The three "completed, DB never recorded it" rows above aren't inferred —
each was confirmed by reading the actual rendered final answer straight off
the browser tab, while the DB record simultaneously showed
`status: "running"`, `lastStep: "implications-review"`, `haltReason: null`,
and `hasFinalAnswer: false`. This is the exact bug diagnosed and patched
earlier this session (`app/api/admin/reasoning/route.ts`'s `persist()`, now
using `next/server`'s `after()` instead of a bare
`void persistRunStep(...)`) — **but that fix was not deployed for this
test**, so this is the real, unpatched loss rate under concurrent load.
33% is markedly worse than what a single uncontended run would suggest —
consistent with the mechanism (more concurrent Vercel invocations
competing for resources → higher odds any one function gets frozen right
after responding, before its fire-and-forget Supabase write completes).

**Fix plan:** [25-concurrent-load-test-and-persistence-fix-plan.md](../25-concurrent-load-test-and-persistence-fix-plan.md).

## Finding 2 — a genuine content-quality halt, on the pipeline's best-tested question

"Should our school ban homework?" — the exact question used in nearly every
other real-verification run in this project's history — hard-halted:
`global-assumptions-review` failed 4 straight attempts (including the one
master-reviewer-guided extra try), 8 of 9 standards still failing. Real
content failure, not infra (no timeout, no empty output, no invalid JSON —
the model generated real, on-topic content that just kept failing review).
Single data point; can't attribute to concurrency vs. ordinary variance
from one run.

## Finding 3 — every run needed manual intervention

All 9 runs paused at least once (several twice) for `needs_user_input`
evidence-gathering clarification — a real, designed feature
(`EvidenceGatherAnswerBox`), not a bug. But it means an admin cannot fire
off N real questions and walk away: each pause needs a human "Skip" or
answer. Orthogonal to concurrency itself, but directly relevant to whether
this scales to concurrent real usage without a human babysitting every tab.

## Limitations of this one test

- **Pre-fix code.** Re-running this exact test after the persistence fix
  ships would show whether Finding 1's 33% actually drops — see the fix
  plan doc.
- **One run per question, one test session.** Every number above is n=1;
  none of it is a rate with error bars.
- **Sequential launch, not simultaneous.** Real overlap existed but wasn't
  a true instant burst.
- **Manual clarification-skipping** by the operator (me) is not what
  N independent real admin users hitting the pipeline concurrently would
  look like — each of them would answer differently, on their own
  schedule, not all skip in a tight loop.
- **Different model than what's now the local default.** This measured
  Qwen3-235B, not DeepSeek-V4-Flash-0731 — no concurrent-load data exists
  yet for the model currently in the local working tree.
