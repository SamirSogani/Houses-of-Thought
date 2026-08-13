# Plan — Multi-agent reasoning pipeline

**Scoped:** 2026-07-30 · **Status:** Phase 1 implemented; Phase 1.5 real
bugs found and fixed live across several sessions — see
[08-phase1.5-root-cause-and-halt-bug.md](08-phase1.5-root-cause-and-halt-bug.md)
for current status, what's done, what's open, and the next phases
(05-07 are the dated history of how it got there). Decided by
[decision 019](../../../decisions/019-multi-agent-reasoning-pipeline.md), which
also records why this is a separate reasoning surface rather than a
replacement for decision 016's stage loop or 018's conclusion candidates.

## What it is

A strictly sequential pipeline of reasoning **layers**, modeled on Paul &
Elder's Elements of Reasoning (frame, perspectives, assumptions, evidence,
conclusions, implications). No layer starts until the previous one finishes
and passes review. Every substantive layer is reviewed by a **nine-agent
panel, one per Universal Intellectual Standard** (clarity, accuracy,
precision, relevance, depth, breadth, logic, significance, fairness) — see
[decision 019 §3](../../../decisions/019-multi-agent-reasoning-pipeline.md)
for why this repo calls it the **review panel**, not "critics." Perspectives
are the one layer that fans out into independent, non-converging viewpoints;
each carries its own sub-questions, assumptions, evidence, and counterargument,
reviewed together as one bundle.

## Architecture

```
0.  Context-gather (pre-frame)         — 1 agent, no review panel
1.  Frame                              — 1 agent  → 9-standard review panel (must pass)
    Context-gather (post-frame)        — 1 agent, no review panel
2.  Breadth-scoping                    — 1 agent, decides n, no review panel
3.  Perspectives (× n, independent sessions):
      per perspective, stance first, then generated in parallel:
        - stance                      — 1 agent
        - sub-questions               — 1 agent
        - assumptions (this stance)   — 1 agent
        - counterargument             — 1 agent, different session than the stance's author
      then evidence (this stance), its own 3 sequential phases:
        - strategy    — decide search terms and/or ask the user  — 1 agent
        - populate     — fetch (Brave search) and/or use the answer, write the evidence — 1 agent
        - confidence   — score each item's confidence, separate call    — 1 agent
      → whole bundle reviewed together by the 9-standard panel (one per perspective)
4.  Global assumptions (question-level) — 1 agent → 9-standard review panel
5.  Global evidence (question-level), same 3-phase split as perspectives':
      strategy → populate → confidence  — 1 agent each → 9-standard review panel
6.  Conclusions                         — 1 agent → 9-standard review panel
7.  Implications                        — 1 agent → 9-standard review panel
8.  Final composition                   — 1 agent, packaging only, no review panel
```

Evidence's strategy phase can pause the run for a clarifying question, the
same way context-gather does — see
[24-evidence-redesign-and-failure-tracking.md](24-evidence-redesign-and-failure-tracking.md).

Context-gather is also callable at any layer boundary, not just its two fixed
checkpoints — any layer can trigger "ask the user something" mid-pipeline.

Layer-by-layer contracts and the standards table:
[01-layers-and-standards.md](01-layers-and-standards.md).
Packet shapes: [02-data-contracts.md](02-data-contracts.md).
Sequencing, concurrency, and failure handling:
[03-orchestration-and-failure-handling.md](03-orchestration-and-failure-handling.md).
Verification plan and deferred implementation questions:
[04-verification-and-open-questions.md](04-verification-and-open-questions.md).
Current build status, known open issues, and next phases (start here to
resume work): [08-phase1.5-root-cause-and-halt-bug.md](08-phase1.5-root-cause-and-halt-bug.md).
AI-call mechanics per step (which function, what gets sent to the model,
how retries actually work — not a duplicate of the layer/schema doc above):
[21-ai-call-mechanics-reference.md](21-ai-call-mechanics-reference.md).
Root cause of the pipeline consistently stopping on `perspectives-generate`
or `global-assumptions` on real Vercel Hobby traffic (a self-inflicted call
stagger plus a self-imposed duration ceiling, both fixed without upgrading
the plan): [22-vercel-hobby-duration-and-stagger-fix.md](22-vercel-hobby-duration-and-stagger-fix.md).
Why it kept failing even after that fix — DeepInfra's own intermittent
reliability on ordinary first-pass calls (confirmed via its dashboard: received,
billed, no rate limit — model behavior, not infra), and the same-target-retry
fix that keeps "DeepInfra, no matter what" intact:
[23-deepinfra-intermittent-reliability-and-same-target-retry.md](23-deepinfra-intermittent-reliability-and-same-target-retry.md).
Evidence generation's strategy/populate/confidence split (each phase its own
agent, evidence-strategy able to pause the run for a clarifying question same
as context-gather), the removed epistemic-hedging language, and per-
sub-element failure tracking for perspectives:
[24-evidence-redesign-and-failure-tracking.md](24-evidence-redesign-and-failure-tracking.md).

## Why perspectives fan out and nothing else does

Point of view is the one Element of Reasoning whose value depends on genuine
independence — one agent writing three "perspectives" in a single session
would hedge them toward each other. Frame, the two global layers, conclusions,
and implications are each a single coherent judgment over everything produced
so far; forcing independent parallel copies wouldn't add diversity, it would
just require reconciling near-identical drafts.

A perspective's counterargument still needs its own session even though it
shares the parent bundle's review panel: a counterargument written by (or
delegated by) the same context that argued the stance gets softened — the
same failure mode as a model reviewing its own work. It comes from a blind
fresh agent with no ownership of the stance, or is cross-assigned (the agent
arguing perspective *j* writes the counterargument for perspective *i*). It is
still reviewed in the same panel as the rest of that bundle — two sides of one
perspective, one panel.

## Global layers vs. per-perspective layers

Each perspective's own assumptions/evidence are scoped to defending or testing
*that stance*. Global assumptions/evidence (layers 4–5) are scoped to the
*original question*, informed by all vetted perspectives but confined to none
of them — this is where a gap that cuts across every perspective (or that
none of them individually surfaced) gets caught.

## Five structural choices — confirmed as specified, 2026-07-30

1. Global-layer order is assumptions before evidence (surface what's assumed
   before deciding what would test it).
2. Context-gather and breadth-scoping are routing decisions, not reasoning
   content — no review panel, keeping the reviewer count exactly `9n + 45`.
3. A perspective bundle's sub-questions/assumptions/counterargument generate
   in parallel — each only needs the perspective's own stance, not each
   other. Evidence is the exception (2026-08-13): its own 3 phases
   (strategy/populate/confidence) run sequentially afterward, since populate
   needs strategy's decision and confidence needs populate's items — see
   [24](24-evidence-redesign-and-failure-tracking.md).
4. Final composition (packaging Implications into the chat-facing answer) is
   not its own reviewed layer.
5. Frame, breadth-scoping, and either global layer hard-block and escalate to
   a human on exhausted retries; only an individual perspective bundle may
   degrade-and-continue (full rule: [03](03-orchestration-and-failure-handling.md)).
