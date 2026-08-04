# 16 — A/B the review panel (Phase 2 item 3)

Built 2026-08-03, following [15](15-persistence.md) (Phase 2 item 1) and
[14](14-dynamic-budget-enforcement.md) (Phase 2 item 2). Resolves decision
019's verification stage 3
([04](04-verification-and-open-questions.md)): "run identical queries with
panels on vs. off (auto-pass) and compare final-answer quality before scaling
`n` up."

**Code below is committed** — check `git log` if that ever seems stale.
**Real-verified 2026-08-03, same day** — see "Real verification" below.

## Design (confirmed with Samir before implementing)

**A new `panelsOff` boolean, threaded alongside `dryRun` end-to-end** — not a
reuse of `dryRun`. The two are structurally different: `dryRun` skips *every*
real call, including generation, to exercise the 17-step state machine for
free. `panelsOff` keeps every `*-generate` call real — the whole point is
comparing real generated content with vs. without review gating — and only
short-circuits the panel call itself.

- `orchestrator-panel.ts`: `autoPassVerdict()`, a sibling to the existing
  `dryRunVerdict()` — same shape (all 9 standards pass, `overall_pass: true`,
  `degraded: false`), distinguished only by its notes text (`"[panels off] …
  not actually graded"` vs. `dryRunVerdict`'s `"[dry run] …"`). `runReviewPanel`
  takes a new `panelsOff` param, checked after the existing `dryRun` check.
- Threaded through all 6 review-wrapper functions (the same 6 gates
  `runReviewPanel` is reused at): `runFrameReview` (orchestrator-setup.ts),
  `runPerspectivesReview` (orchestrator-perspectives.ts, nested per bundle),
  `runGlobalAssumptionsReview` / `runGlobalEvidenceReview` /
  `runConclusionsReview` / `runImplicationsReview` (orchestrator-global.ts) —
  each gained a `panelsOff = false` parameter passed straight through to its
  `runReviewPanel` call.
- `route.ts`: `panelsOff` added to `RequestSchema` (optional boolean, same
  shape as `dryRun`), extracted once, passed to all 6 review call sites in the
  switch.
- `ReasoningPipelinePage.tsx`: a second checkbox under "Dry run" — "Panels off
  (auto-pass every review gate — real generation, no reviewer calls; for A/B
  comparison against a panels-on run)" — sent as `panelsOff` on every step
  fetch, alongside a `PANELS OFF` badge during a run (mirrors the existing
  `DRY RUN` badge).
- `budget.ts`'s `estimatePipelineCost(n, panelsOff)`: when `panelsOff`,
  `reviewers = 0` instead of `9n + 45` — the pre-flight cost display would
  otherwise sit right next to the new checkbox showing a silently-wrong
  number. The UI's "peak concurrent" figure also switches from `9n` (panel
  fan-out) to `4n` (the next-largest fan-out point, perspectives' own 4
  sub-calls per bundle) when panels are off.

**No persistence-schema change.** A stored run doesn't need a separate
"was this panels-off" column — the auto-pass verdict's own `"[panels off]"`
notes text already carries that signal into `reasoning_runs.run_state`,
visible in the browsing UI's per-standard notes exactly like `dryRunVerdict`'s
`"[dry run]"` text already does. Same reasoning as [15](15-persistence.md)'s
JSONB-blob choice: don't add machinery a need hasn't shown up for.

## Follow-up — runs-browser summary indicator

Added same day, once actually requested (Samir, after the section above
originally flagged it as a deliberate gap). The summary list at
`/admin/reasoning/runs` previously distinguished two runs of the same
question only by timestamp, once you opened each — the auto-pass verdicts'
`"[panels off]"` notes text is only visible in the detail view.

**A dedicated column, not a JSONB read** — unlike packet/verdict content
([15](15-persistence.md)'s reasoning for keeping `run_state` a single JSONB
blob), `panels_off` is run-level metadata fixed for that run's whole
lifetime, the same tier as the existing `status`/`last_step` columns. Reading
it out of `run_state` on every list row would mean pulling the full blob just
to check one flag; a flat column matches how the adjacent metadata already
works.

- [`0032_reasoning_runs_panels_off.sql`](../../../supabase/migrations/0032_reasoning_runs_panels_off.sql) —
  `panels_off boolean not null default false`, additive-only, no RLS/grant
  change (same deny-all/service-role-only access as 0030/0031). Defaults
  `false` so every pre-existing row reads correctly as panels-on.
- `persistence.ts`: `persistRunStep` takes a `panelsOff` param, written on
  every upsert; `ReasoningRunSummary`/`ReasoningRunDetail` and both selects
  (`listReasoningRuns`, `getReasoningRun`) gained the field.
- `route.ts`'s `persist()` helper passes the request's `panelsOff` through.
- `ReasoningRunsBrowser.tsx`: a plain-mono-text `PANELS OFF` tag (matching
  the live pipeline page's own run-state badge style, not `StatusPill`'s
  amber "done" pill scheme — reusing that would read as a second status)
  next to the status pill, in both the list row and the detail header.

**Migration not yet applied — real-verified failure mode, not success.**
Checked 2026-08-04: a minimal real run (n=2, panels off, stopped after 6
cheap steps rather than let it run to completion) surfaced this in the server
log on every single step, not just the panels-off ones:

```
{"level":"error","scope":"ai/reasoning/persistence","msg":"failed to persist run step (non-fatal)","step":"context-gather-pre","error":"Could not find the 'panels_off' column of 'reasoning_runs' in the schema cache"}
```

This confirms the write path is correctly wired (right column name, right
value) and, more importantly, surfaces a real regression risk: until 0032 is
applied, `persistRunStep`'s existing non-fatal try/catch
([persistence.ts](../../../lib/ai/reasoning/persistence.ts)) silently
swallows this error for **every** real run, not just panels-off ones — no
`reasoning_runs` row gets written at all, with no visible failure anywhere
except the server log. The pipeline itself is unaffected (persistence
failures were always designed to be non-fatal to the run), but the audit
trail [15](15-persistence.md) exists for goes dark until this migration
lands. Once 0032 is applied, no further code change is needed — real
verification then is just: trigger one real step, confirm the row (and its
`PANELS OFF` tag, if applicable) appears in the browser.

## Real verification — 2026-08-03

Provider health checked at `/admin` first (Run live check): all 5
drafter/critic/coach-lane targets UP; only OpenRouter (used solely once a
whole lane daily-exhausts, not on this path) showed an unrelated 404.

**Question (n=2, both runs):** "Should our city ban gas-powered leaf
blowers?"

**Run 1 — panels off.** Pre-flight cost display read "≈ 19 calls (19
generators + 0 reviewers), peak ~8 concurrent" (was 82/63/18 with panels on) —
confirms `estimatePipelineCost`'s fix live. First attempt hit a transient
`ai-invalid-output` (502) at `perspectives-generate-details` — the same known
residual gap [14](14-dynamic-budget-enforcement.md) documented (a drafter-lane
generation failure, structurally unrelated to `panelsOff`: this step makes no
`runReviewPanel` call at all). One click of the UI's own Retry button cleared
it; the run then completed cleanly through final composition. Confirmed via
network response bodies:
- `frame-generate` returned a genuine, substantive Frame packet (real
  definitions, purpose, scope notes) — not dry-run placeholder text.
- `frame-review`'s response was the exact auto-pass shape: all 9 standards
  `pass: true`, notes `"[panels off] <Standard> not actually graded."`,
  `overall_pass: true` — confirming zero real reviewer calls happened.
- All 6 gates (Frame; both perspective bundles at perspectives-review; Global
  assumptions; Global evidence; Conclusions; Implications) showed the
  identical trivial "9/9 standards passed" in the UI — the auto-pass shape,
  not a real panel that happened to unanimously agree.
- Reached a real final answer. Appeared correctly in `/admin/reasoning/runs`
  and rendered identically in the detail view (same `ReasoningStagesList`
  component the live page uses, per [15](15-persistence.md)'s design).

**Run 2 — panels on**, same question, same n=2, no retries needed this
attempt. Reviewer verdicts were genuinely differentiated, not rubber-stamped:
`frame-review`'s response body showed 9 distinct, substantive per-standard
notes (e.g. clarity citing the specific unambiguous phrasing, breadth citing
the specific alternatives the scope notes opened up) — confirming
`LAYER_STANDARD_CRITERIA` is producing real per-standard judgment, matching
[05](05-phase1-status-and-next-phases.md)'s earlier finding. Five of six gates
passed 9/9; **Implications review passed 8/9** — one standard genuinely
failed and was tolerated under `MAX_PANEL_FAILURES = 1`
(orchestrator-panel.ts) rather than trivially passing, the clearest live
evidence in this run that panels-on is doing real, fallible grading work
panels-off cannot do by construction. Also appeared correctly in the browsing
UI, alongside Run 1, distinguishable by timestamp.

### Final-answer comparison

**Panels off:** "Yes, the city should enact a ban... The long-term
improvements in public health and environmental quality outweigh the
near-term economic costs and potential resistance... incentives and city
programs can mitigate this. Additionally, the ban could stimulate local
economic activity in the electric equipment market..." No caveats.

**Panels on:** "Yes, a city should ban gas-powered leaf blowers... While
landscaping businesses would face initial costs... the city's capacity for
enforcement and availability of alternatives suggest the ban is feasible.
However, small businesses may face competitive challenges during the
transition, requiring targeted support to mitigate disruption." Plus two
explicit caveats: economic disruption risk to small landscaping businesses
absent support programs, and that the long-term benefits are conditional on
enforcement and adoption actually happening.

Both runs land on the same directional answer (ban it), which is itself a
useful negative check — panel review isn't flipping the conclusion, just its
framing. The panels-on answer is the more epistemically hedged of the two: it
surfaces a genuine tension (cost to small businesses) as an open risk needing
mitigation, where the panels-off answer resolves the same tension by
assertion ("can be mitigated," "could stimulate... new opportunities") and
carries no caveats section at all. Directionally consistent with the panel
doing its intended job — surfacing tension rather than smoothing it over —
but this is one real trial at n=2, not a repeated or statistically powered
comparison; real LLM stochasticity means a second pair of runs on the same
question could land closer together or further apart. Treat this as
confirmation the mechanism is worth its cost, not as a settled effect size.

## What's tested

Not unit-tested at the `autoPassVerdict`/`panelsOff` granularity — mirrors
existing precedent: `dryRunVerdict` itself has never had a dedicated test
either (dry-run correctness has always been verified live via the UI/E2E, not
unit-pinned at that level). `estimatePipelineCost`'s existing behavior is
covered only by the type system (no dedicated `budget.test.ts` predates this
change); the new `panelsOff` parameter is additive and defaults to `false`,
so no prior caller's behavior changed.
