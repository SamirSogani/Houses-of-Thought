# 04 — Verification approach and open questions

No code exists yet to run. Validate the design in stages as it's built.

## Verification stages

1. **Minimal build first:** `n = 2–3`, retries disabled, one full pass through
   all 8 layers — manually inspect every packet and every panel verdict.
   Confirm perspectives actually diverge, the counterargument attacks rather
   than restates a softened version, and the global layers surface something
   none of the individual perspectives said.
2. **Instrument everything:** log every packet and every one of the nine
   per-standard verdicts at every gate — an audit trail and the raw material
   for tuning each standard reviewer's prompt independently.
3. **A/B the review-panel layer:** run identical queries with panels on vs.
   off (auto-pass) and compare final-answer quality before scaling `n` up —
   confirms the nine-reviewer cost is earning better answers, not just adding
   latency.
4. **Test the escalation path deliberately:** force a frame or global-layer
   failure through all retries and confirm it halts and escalates rather than
   silently degrading — this is the one failure mode that must never fail
   open (see [03 — Degrade vs. hard-block](03-orchestration-and-failure-handling.md)).
5. **Load-test the budget cap:** force an artificially large `n` and confirm
   the orchestrator shrinks `n` or tightens retries rather than running away
   in cost or latency.

## Open questions deferred to implementation

- Concrete concurrency primitive (queue, worker pool, SDK-native subagent
  calls) — depends on the actual runtime.
- Structured-output validation mechanism (schema library, tool-use enforced
  JSON, etc.) — depends on the LLM provider/SDK in use.
- Whether packets and panel verdicts are persisted (for audit/replay), and
  where.
- Whether the nine standard reviewers for a given panel run as nine separate
  agent calls or one agent producing nine scored fields. This plan assumes
  nine separate calls (true independence per standard, matching "nine-agent
  panel"), but this is the single biggest cost lever if it turns out
  unaffordable.

## Product-level questions this doc does not resolve

These are tracked in
[decision 019's Deferred/open section](../../../decisions/019-multi-agent-reasoning-pipeline.md#deferred--open),
not here, because they're product decisions rather than architecture details:

- Whether/how this pipeline ever attaches to `/admin/chat`, given decision
  017's "the chat never answers the question" design.
- Whether a Conclusions-layer output surfaced to a human revisits decision
  018's fenced, admin-only exception to invariant 1.
