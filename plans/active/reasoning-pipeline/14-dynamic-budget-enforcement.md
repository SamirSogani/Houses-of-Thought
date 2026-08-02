# 14 — Dynamic budget enforcement (Phase 2 item 2)

Built 2026-08-02, directly motivated by [13](13-two-more-real-runs-and-a-grant-bug.md)'s
run 3: Groq daily-exhausted → Gemini absorbed the full drafter load and
started rate-limiting itself → Cerebras (the drafter lane's last resort) got
concentrated concurrent load and returned schema-invalid JSON that failed
even its own retry. [03](03-orchestration-and-failure-handling.md)'s "Budget
enforcement" section spec'd this; Phase 1 shipped only
[budget.ts](../../../lib/ai/reasoning/budget.ts)'s static `clampN`.

**Code below is committed** — check `git log` if that ever seems stale. **Not
yet real-verified** — needs a live run while the drafter lane is actually
under stress (same provider-quota discipline as every prior session in this
plan: check `/admin` first, don't force it).

## Design (confirmed with Samir before implementing)

**Signal — two-tier**, in
[`drafterLaneStress()`](../../../lib/ai/router-state.ts):

- `'none'` — Groq (drafter primary) is live.
- `'degraded'` — Groq is out (daily-exhausted, or in its 30s penalty box), so
  the lane is down to 2 live targets (Gemini, Cerebras), but neither fallback
  shows elevated recent failures.
- `'critical'` — Groq is out **and** at least one fallback's recent event log
  (`eventsFor`) shows a rate-limited/error ratio ≥ 40% over its last 10
  events — the exact shape of run 3.

**Enforcement — two places:**

1. Mid-run, reactive: `runPerspectivesGenerateDetails`
   ([orchestrator-perspectives.ts](../../../lib/ai/reasoning/orchestrator-perspectives.ts))
   computes stress once per call and widens `DRAFTER_STAGGER_MS` (1.5× under
   `degraded`, 2× under `critical`) via `effectiveStaggerMs()` — same
   flattened call schedule, spread further apart so the same request rate
   lands on fewer live providers.
2. Pre-flight: the `breadth-scoping` case in
   [route.ts](../../../app/api/admin/reasoning/route.ts) computes stress and
   runs `capN` through `clampNForStress()`
   ([budget.ts](../../../lib/ai/reasoning/budget.ts)) before calling
   `runBreadthScoping` — `degraded` asks for one fewer perspective than
   requested, `critical` forces `MIN_N`. At today's narrow `MIN_N=2`/
   `MAX_N_PHASE1=3` range both collapse a requested n=3 to 2 — a real
   distinction only once `MAX_N_PHASE1` grows past 3, but still the correct
   policy now. No client-side change needed: the shrunk n flows back through
   the existing `breadthScoping.n`/`candidate_viewpoint_labels` packet
   fields, which `perspectives-generate-stances` already reads as ground
   truth.

**Deliberately not touched:** `MAX_REGENERATION_ATTEMPTS`. Run 3 failed
inside `completeJSON`'s own built-in retry, before ever reaching the
bundle-regeneration loop — tightening that knob wouldn't have changed this
incident.

**Why `budget.ts` takes `stress` as a parameter instead of reading it
directly:** that file is imported by the client component
(`ReasoningPipelinePage.tsx`) for the pre-flight cost display and is
documented "client-safe" — it must never import a server-only module with
runtime state (Supabase client, module-global provider maps). Only the
route handler calls `drafterLaneStress()` and passes the result in; the type
itself is imported with `import type` (compile-time only, erased from any
bundle).

## What's tested vs. what isn't

Unit-tested (`router.test.ts`, `orchestrator-perspectives.test.ts`): the
signal's tier transitions (driven through real `completeJSON`/`execute`
cascades, not by reaching into `router-state.ts` internals), and that the
stagger schedule actually widens under each stress level. **Not yet
exercised live** — this session's own quota was already burned down (see 13),
so there was no safe way to real-verify against genuine Groq daily-exhaustion
today. Next real-testing session: check `/admin` for a stale
`dailyExhaustedProviders` entry (auto-clears at UTC midnight) or force
`degraded`/`critical` via a throwaway script against `router-state.ts`'s
test-only reset/marking hooks before running a real pipeline test, and
confirm the stagger/n-clamp actually engaged (look for the new `log.warn`
lines: `ai/reasoning/perspectives` and `ai/reasoning/route`).
