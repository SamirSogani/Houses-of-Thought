# Decision 019 — Multi-agent reasoning pipeline for admin chat

**Date:** 2026-07-30
**Status:** Phase 1 implemented; Phase 1.5's bounded retries shipped. Real
testing across several sessions found and fixed a chain of real bugs
(schema caps, a reasoning_effort budget-starvation root cause spanning
three providers, a Groq structured-output failure mode wrongly classified
as terminal, and a client-side bug that silently disabled every hard-block
layer's 3-attempt halt) — real runs now reach past Perspectives into the
global layers for the first time. Current status, known open issues, and
next phases:
[plans/active/reasoning-pipeline/08-phase1.5-root-cause-and-halt-bug.md](../plans/active/reasoning-pipeline/08-phase1.5-root-cause-and-halt-bug.md)
(05-07 are the dated history of how it got there).
Full spec: [plans/active/reasoning-pipeline/](../plans/active/reasoning-pipeline/README.md).
**Relates to:** [016](016-draft-mode.md) (stage loop), [017](017-house-chat-admin-beta.md)
(admin chat), [018](018-house-chat-conclusion-candidates.md) (conclusion
candidates), [plans/active/ai/07-critic.md](../plans/active/ai/07-critic.md)
(existing Socratic critic — see §3 below).

## Context

Admin chat (017) currently reasons via one drafter-lane call per house-build
stage (016's loop) plus one call for conclusion candidates (018). This
decision records the architecture for a much deeper alternative: a strictly
sequential, multi-layer reasoning pipeline modeled on Paul & Elder's Elements
of Reasoning, where most layers are reviewed by a nine-agent panel — one
agent per Universal Intellectual Standard — before the next layer starts.

This is scoped as a **separate reasoning surface**, not a replacement:

- It does not touch `/api/ai/draft`, decision 016's stage loop, or decision
  018's plural-conclusion-candidates requirement.
- It does not amend any of the six invariants in
  [plans/active/ai/README.md](../plans/active/ai/README.md).
- Whether/how it ever attaches to `/admin/chat` is explicitly deferred (§Deferred).

## Decisions made

### 1. Eight sequential layers, one fan-out point
Context-gather → Frame → Breadth-scoping → Perspectives (the only layer that
fans out into `n` independent bundles) → Global assumptions → Global evidence
→ Conclusions → Implications → Final composition. Full layer contracts:
[01-layers-and-standards.md](../plans/active/reasoning-pipeline/01-layers-and-standards.md).

### 2. Five structural choices, confirmed as specified (2026-07-30)
Assumptions-before-evidence ordering, no review panel for the two scoping
layers, parallel (not sequential) generation of a perspective bundle's four
sub-elements, no panel on final composition, and the hard-block/degrade split
(§Orchestration in the plan doc) — all confirmed with Samir as-written; none
changed.

### 3. "Review panel," not "critic" — deliberate rename
The source draft called the nine reviewing agents "critics." This repo
already ships a *different* critic (`/api/ai/critique`, six Paul-Elder
standards, one agent, reviews finished house content — 07-critic.md above).
To avoid conflating the two, every doc under `plans/active/reasoning-pipeline/`
uses **review panel** (the group of nine) and **standard reviewer** (one
member) instead. The nine-per-panel math and gating behavior are unchanged
from the source draft — only the name changed.

### 4. Orchestrator-only state, strict sequencing, bounded retries
One stateful orchestrator; no agent talks to another directly; layer *k+1*
never starts until layer *k* passes review or is marked degraded. Full failure
handling, concurrency limits, and budget enforcement:
[03-orchestration-and-failure-handling.md](../plans/active/reasoning-pipeline/03-orchestration-and-failure-handling.md).

## Consequences

- Nothing in decisions 016–018 changes; no existing route, schema, or
  invariant is touched.
- The design is fully specified (layers, data contracts, failure handling)
  but unimplemented — see the plan directory's verification approach for how
  to validate it once building starts.

## Deferred / open

- **Answers-directly tension with 017:** this pipeline's `FinalAnswer` is a
  direct textual response. Decision 017's entire premise is "the chat never
  answers the question — its only reply is a claim-gated house." If this
  pipeline ever attaches to `/admin/chat`, that conflict needs a product
  decision first; it is not resolved by this document.
- **Conclusion-authorship precedent:** if this pipeline's Conclusions layer
  output is ever surfaced to a human as a decision input, decision 018's
  fenced, admin-only exception to invariant 1 is the precedent to revisit —
  not something this pipeline inherits automatically.
- Implementation-level open questions (concurrency primitive, structured-output
  validation, packet/verdict persistence, 9-calls-vs-1-call panel execution):
  [04-verification-and-open-questions.md](../plans/active/reasoning-pipeline/04-verification-and-open-questions.md).
