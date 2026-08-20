# 03 — Orchestration, concurrency, and failure handling

## Orchestrator

The orchestrator is the only stateful component — it spawns agents, routes
packets, invokes review panels, and enforces gates/budgets. No agent talks to
another directly.

## Sequencing and concurrency

- **Strict sequencing:** layer *k+1* does not spawn until layer *k*'s
  `overall_pass` is true, or — for a degradable unit — retries are exhausted
  and it's marked degraded. This is a deliberate latency-for-rigor tradeoff;
  the design optimizes for depth of reasoning over response speed.
- **Within a layer:** the `n` perspective bundles run in parallel (capped,
  ~15–20 concurrent). Within each bundle, stance generates first; then
  sub-questions/assumptions/counterargument run in parallel
  (`perspectives-generate-details`); evidence's own 3 phases
  (strategy → populate → confidence, 2026-08-13) run afterward, sequentially,
  since populate needs strategy's decision and confidence needs populate's
  items — see [01](01-layers-and-standards.md).

## Bounded retries and scoped regeneration

- A failing bundle or global layer gets up to 2 regenerations (3 attempts
  total) after a failed panel verdict.
- The regenerating agent is the one place that sees more than the bare
  minimum context — its own prior output plus the panel's failing-standard
  notes. This is targeted repair, not an independent judgment.
- Only the failing unit regenerates. One perspective's bundle failing doesn't
  touch any other perspective. A failing sub-element (say, evidence) inside an
  otherwise-passing bundle can regenerate on its own before the whole bundle
  is resubmitted to the panel.
- **Which sub-element failed is now tracked** (2026-08-13, `SubElementFailure`
  — see [02](02-data-contracts.md)): every perspectives fan-out step uses
  `Promise.allSettled` and reports every rejected `(perspectiveId,
  subElement)` pair, not just the first. Motivated by real debugging pain —
  Vercel Hobby's 1-hour log retention made it very hard to tell, after the
  fact, whether a bare "ai-empty-output" was sub-questions, assumptions,
  counterargument, or one of evidence's 3 phases.

## Degrade vs. hard-block

- A perspective bundle that exhausts retries is marked `degraded: true` and
  passed forward anyway — implications and conclusions can note "one
  viewpoint's analysis was inconclusive."
- Frame, breadth-scoping, or either global layer exhausting retries instead
  **halts the pipeline and escalates to a human** — there is no meaningful way
  to compute conclusions from evidence or assumptions that never passed
  review. These are single points of failure the whole pipeline depends on;
  only an individual perspective bundle has enough redundancy (the other
  bundles) to degrade safely.

## Budget enforcement

A per-request ceiling on total agent calls and/or wall-clock time. If
projected cost exceeds it (large `n`, retries stacking up), the orchestrator
reduces `n` or tightens retry allowance dynamically rather than letting cost
run away silently.

## Tunable knobs

| Knob | Default |
|---|---|
| `n` (perspective count) | 4–6; scaled up for explicit deep-dive requests |
| `max_concurrent_agents` | ~15–20 |
| `max_retries_per_unit` | 2 |
| `panel_pass_threshold` | 9/9 (all standards must pass) |
| `degraded_threshold` | how many degraded bundles trigger a user-visible caveat in the final answer |

## Subagent count model

Per request, as a function of `n`. Updated 2026-08-13 (Samir's evidence
redesign, [24](24-evidence-redesign-and-failure-tracking.md)): evidence
generation split from 1 call into 3 (strategy → populate → confidence),
both per-perspective and globally — `+2` per perspective, `+2` fixed for the
global-evidence trio replacing its old single call. See `budget.ts`, the
canonical source (`estimatePipelineCost`) — this table mirrors it.

- **Generators:** `2` (context-gather) `+ 1` (frame) `+ 1` (breadth-scoping)
  `+ 7n` (perspective bundles: stance `+` sub-questions/assumptions/
  counterargument `+` evidence-strategy/populate/confidence)
  `+ 1` (global assumptions) `+ 3` (global evidence: strategy/populate/
  confidence) `+ 1` (conclusions) `+ 1` (implications) `+ 1` (final
  composition) = **`7n + 11`**
- **Reviewers:** `9` (frame) `+ 9n` (perspectives) `+ 9` (global assumptions)
  `+ 9` (global evidence) `+ 9` (conclusions) `+ 9` (implications) =
  **`9n + 45`** — unchanged; evidence still isn't independently reviewed, it's
  reviewed as part of the whole bundle/packet at `perspectives-review` /
  `global-evidence-review`, same as before.
- **Total (happy path, no retries):** **`16n + 56`**

| n | Generators | Reviewers | Total |
|---|---|---|---|
| 3 | 32 | 72 | 104 |
| 5 | 46 | 90 | 136 |
| 8 | 67 | 117 | 184 |
| 12 | 95 | 153 | 248 |

Retries can push the perspective-layer portion (`7n` generators + `9n`
reviewers = `16n`) up to roughly 3× in the worst case for whichever bundles
keep failing — the budget cap and "degrade, don't retry forever" rule aren't
optional at this scale. The review panels dominate the total by design (nine
reviewers per reviewed artifact) — a rigor-for-cost trade the architecture is
explicitly making, not an inefficiency to optimize away.
