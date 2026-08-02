# 14 — Dynamic budget enforcement (Phase 2 item 2)

Built 2026-08-02, directly motivated by [13](13-two-more-real-runs-and-a-grant-bug.md)'s
run 3: Groq daily-exhausted → Gemini absorbed the full drafter load and
started rate-limiting itself → Cerebras (the drafter lane's last resort) got
concentrated concurrent load and returned schema-invalid JSON that failed
even its own retry. [03](03-orchestration-and-failure-handling.md)'s "Budget
enforcement" section spec'd this; Phase 1 shipped only
[budget.ts](../../../lib/ai/reasoning/budget.ts)'s static `clampN`.

**Code below is committed** — check `git log` if that ever seems stale.
**Real-verified 2026-08-02, same day** — see "Real verification" below.

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

## What's tested

Unit-tested (`router.test.ts`, `orchestrator-perspectives.test.ts`): the
signal's tier transitions (driven through real `completeJSON`/`execute`
cascades, not by reaching into `router-state.ts` internals), and that the
stagger schedule actually widens under each stress level.

## Real verification — 2026-08-02

Two real runs, same session the code was built in, provider health checked
at `/admin` first each time (all UP except Gemini rate-limited).

**Run A (n=2), "Should our neighborhood association ban short-term rentals
like Airbnb?":** started with Groq healthy. Mid-run, Groq's `gpt-oss-20b` hit
its real **daily** token cap (TPD: 198,728/200,000 used) on a
`perspective_evidence` call and got marked exhausted; Gemini then 429'd on
every subsequent drafter call in that same `perspectives-generate-details`
invocation (8 of 8 flattened calls) — the doc 13 cascade shape, live. The
*existing* (unmodified) router cascade absorbed all 8 onto Cerebras
correctly: both perspective bundles passed review 9/9 on the first attempt,
and the full 17-step run completed cleanly through final composition. Since
stress is read once per `runPerspectivesGenerateDetails` call and Groq only
went out mid-call, this run's own stagger stayed at the base 20s — it
verified the *pre-existing* cascade held under a genuine live exhaustion
event, not the new stagger widening.

**Run B (requested n=3), "Should our public library system eliminate late
fees for overdue books?":** started with Groq already daily-exhausted from
Run A and Gemini already showing 0 OK / 17 FAIL in its recent event log —
`/admin` confirmed both before starting. This is the first run where both new
mechanisms actually engaged, confirmed directly from server logs and the
network response body:

```
{"level":"warn","scope":"ai/reasoning/route","msg":"drafter lane under stress — shrinking n pre-flight","stress":"critical","requestedN":3,"effectiveN":2}
{"level":"warn","scope":"ai/reasoning/perspectives","msg":"drafter lane under stress — widening stagger","stress":"critical","staggerMs":40000}
```

The `breadth-scoping` response confirmed the clamp landed: `"breadthScoping":
{"n":2, ...}` with only 2 `candidate_viewpoint_labels`, even though the
model's own rationale argued for more perspectives — `clampNForStress`
correctly overrode both the model and the user's requested n=3.

**But:** the run still didn't reach a clean finish. With Groq fully out and
Gemini this saturated (worse than run 3's original conditions, where only
Groq was out and Gemini was merely self-rate-limiting), Cerebras — the only
thing actually serving drafter calls at this point — produced schema-invalid
JSON on a `perspective_assumptions` call (content wrapped in a stray array
instead of the expected object) and failed `completeJSON`'s one built-in
retry too, surfacing as a 502 `ai-invalid-output` that paused the pipeline
("Could not reach a stage of the pipeline"). Stopped there rather than
clicking Retry and spending more quota chasing a clean run under what was
today an unusually severe compounded-provider day — same precedent as 13's
"stopped rather than continuing to retry."

**Conclusion:** both mechanisms verified working exactly as designed — the
pre-flight clamp and the stagger widening both measurably reduce
concentration on the fallback lane. But they're mitigations, not a
guarantee: under sufficiently severe *simultaneous* multi-provider stress
(not just Groq out, but the sole remaining live target itself heavily
loaded), Cerebras can still occasionally produce invalid JSON on the first
two attempts. A genuine residual gap, not a bug in this change — worth a
separate decision (e.g., a third stagger tier, or a targeted extra retry on
`ai-invalid-output` specifically under `critical` stress) rather than folding
into this change silently.
