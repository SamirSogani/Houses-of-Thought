# 21 — AI-call-mechanics reference: what each step actually sends the model

**Date:** 2026-08-12 · Branch: `reasoning-pipeline-deepinfra-tuning`

This is **not** [01-layers-and-standards.md](01-layers-and-standards.md) (the
conceptual/schema-contract doc — what each layer *means* and what shape it
returns). This is the mechanics reference: which function fires, what
`completeJSON`/`generateWithOptionalSearch` options it passes, and how
retries actually work, per step. Line numbers are as of this doc's date —
expect drift.

Every generate call below lives in `lib/ai/reasoning/`:
`orchestrator-setup.ts` (context-gather, frame, breadth-scoping),
`orchestrator-perspectives.ts` (perspectives), `orchestrator-global.ts`
(global layers, conclusions, implications, final composition). Every
`-review` gate routes through the shared `runReviewPanel` in
`orchestrator-panel.ts` — see **Review-panel mechanics** below the table
rather than repeated per row.

| Step | Function | Role | Effort (first-pass/repair) | maxTokens (first-pass/repair) | Search? | Failure mode | Notes |
|---|---|---|---|---|---|---|---|
| Context-gather (pre) | `runContextGather` — orchestrator-setup.ts:40 | swarm | low (fixed, no repair path) | 400 (fixed) | Post-hoc only — `runSearches` (search.ts:44) enriches the question shown to the user when `needs_user_input`; not `generateWithOptionalSearch`, no round-trip back into the model | No panel — a thrown `AiError` surfaces as a route-level failure (client shows "Could not reach a stage," Retry). `needs_user_input: true` does **not** halt the pipeline — it auto-continues to `nextStep` (doc 18) | Called at 2 fixed checkpoints (pre/post) plus any ad-hoc mid-pipeline call — identical shape every time |
| Frame | `runFrameGenerate` (orchestrator-setup.ts:86) → `runFrameReview` (orchestrator-setup.ts:142) | swarm | medium / high | 2000 / 2000 (no `REPAIR_TOKEN_HEADROOM` — not one of the 8 call sites that get it) | No | **hard-block** (`STEP_FAILURE_MODE['frame-review']`) | First reviewed gate; sets `original_query`/`core_question` everything downstream reads |
| Context-gather (post) | `runContextGather` — same function as the pre-checkpoint | swarm | low (fixed) | 400 (fixed) | Post-hoc only, same as above | No panel — same as above | Runs after frame passes review |
| Breadth-scoping | `runBreadthScoping` — orchestrator-setup.ts:162 | swarm | low (fixed, no repair path) | 500 (fixed) | No | No panel — same as context-gather | Model proposes `n`; `clampN`/`clampNForStress` (budget.ts) is the real ceiling, not the model's raw answer |
| Perspectives — stance | `runPerspectivesGenerateStances` — orchestrator-perspectives.ts:95 | swarm | medium (fixed — "no repair path exists for stance generation") | 1000 (fixed) | No | Feeds into the bundle; see Perspectives-review row for the actual gate | One call per perspective (n total), independent sessions (decision 019) |
| Perspectives — sub-questions | `runPerspectivesGenerateDetails` — orchestrator-perspectives.ts:202 | swarm | medium / high | 1100 / 4100 (1100 + `REPAIR_TOKEN_HEADROOM`) | No | degrade (bundle-level, see below) | 1 of 4 sub-elements generated in parallel per bundle |
| Perspectives — assumptions | same function — orchestrator-perspectives.ts:216 | swarm | medium / high | 1200 / 4200 | No | degrade | " |
| Perspectives — evidence | same function — orchestrator-perspectives.ts:229 | swarm | medium / high | 2400 / 5400 | **Yes** — `generateWithOptionalSearch` (search.ts:68), up to `MAX_SEARCH_ROUNDS`=2 round-trips + 1 forced-finalize round | degrade | Same claim/source_ref/confidence shape as global-evidence; both bumped to 2400 the same day after a live truncation |
| Perspectives — counterargument | same function — orchestrator-perspectives.ts:248 | swarm | medium / high | 1600 / 4600 | No | degrade | Cross-assigned to a different perspective's session (decision 019) |
| Perspectives — review | `runPerspectivesReview` — orchestrator-perspectives.ts:287 → `runReviewPanel` | swarm | low (panel, fixed) | 800 (panel, fixed) | No | **degrade** — the one step that degrades per-bundle instead of hard-blocking (`STEP_FAILURE_MODE['perspectives-review']`); other bundles unaffected | One panel run per bundle (n panels, not one shared panel) |
| Global assumptions | `runGlobalAssumptionsGenerate` (orchestrator-global.ts:70) → `runGlobalAssumptionsReview` (orchestrator-global.ts:104) | swarm | medium / high | 900 / 3900 | No | **hard-block** | Question-level, informed by all vetted perspectives but scoped to none |
| Global evidence | `runGlobalEvidenceGenerate` (orchestrator-global.ts:122) → `runGlobalEvidenceReview` (orchestrator-global.ts:166) | swarm | medium / high | 2400 / 5400 | **Yes** — `generateWithOptionalSearch`, same as perspectives-evidence | **hard-block** | Twin of perspectives-evidence; same truncation history |
| Conclusions | `runConclusionsGenerate` (orchestrator-global.ts:183) → `runConclusionsReview` (orchestrator-global.ts:219) | swarm | medium / high | 1800 / 4800 | No | **hard-block** | Reads global assumptions + evidence + all vetted perspectives |
| Implications | `runImplicationsGenerate` (orchestrator-global.ts:236) → `runImplicationsReview` (orchestrator-global.ts:281) | swarm | medium / high | 1800 / 4800 | No | **hard-block** | Carries forward `caveats_from_degraded_layers` from any degraded perspective bundle |
| Final composition | `runFinalComposition` — orchestrator-global.ts:298 | **synthesis** | medium (fixed — "no repair path exists... every call here is a first-pass call by definition") | 1200 (fixed) | No | No panel — packaging only, thrown error → route-level failure/Retry | The one step on the `synthesis` role/lane, not `swarm` |

## Review-panel mechanics (shared by every `-review` row above)

Every `-review` gate calls the same `runReviewPanel` (orchestrator-panel.ts:80):
**9 parallel calls**, one per Universal Intellectual Standard, staggered 150ms
apart (`REVIEWER_STAGGER_MS`) to avoid firing all 9 in the same instant. Each
reviewer call: role `swarm`, effort **low** (fixed — a per-standard pass/fail
is closer to classification than open-ended reasoning), `maxTokens` **800**
(fixed), no repair concept of its own — a reviewer call never retries itself;
the underlying *artifact* regenerates and the whole panel re-runs against the
new version. `MAX_PANEL_FAILURES = 1`: up to 1 of 9 standards may fail and the
gate still passes (orchestrator-panel.ts's own comment on why 9-way unanimity
is a near-coin-flip even on strong content).

## The retry ladder (how "repair" actually resolves)

`MAX_REGENERATION_ATTEMPTS = 3` (budget.ts): a failing hard-block layer or
perspective bundle gets up to 2 regenerations (3 attempts total) — every
regeneration attempt is what flips a call from first-pass to repair columns
above (`effort: high`, `allowHighReasoning: true`, `+REPAIR_TOKEN_HEADROOM`
where applicable). What happens after attempt 3 still fails differs by
failure mode:
- **hard-block** (frame, global-assumptions, global-evidence, conclusions,
  implications): one further attempt, `runMasterReview`
  (orchestrator-panel.ts:164) — role swarm, effort **high** +
  `allowHighReasoning: true`, `maxTokens` **2600** — synthesizes guidance
  across all 9 standards' verdicts (something the blind panel can't do
  itself) for one masterguided regeneration. If that also fails, the
  pipeline halts and escalates to a human.
- **degrade** (perspectives only): the bundle is marked `degraded: true` and
  carried forward as-is — no master-review escalation, since the other
  bundles already give downstream layers something to work with (the
  redundancy hard-block layers don't have).

## Role/lane note

Every row above is `swarm` except final composition (`synthesis`) — both
lanes are DeepInfra-only as of this branch (see
[20-deepinfra-tuning-real-verification.md](20-deepinfra-tuning-real-verification.md)'s
addendum). This doc describes *what* gets sent to the model; which
provider(s) actually receive it is [router-lanes.ts](../../../lib/ai/router-lanes.ts)'s
concern, not this one.
