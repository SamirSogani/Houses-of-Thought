# 21 — AI-call-mechanics reference: what each step actually sends the model

**Date:** 2026-08-12 · Branch: `reasoning-pipeline-deepinfra-tuning`

This is **not** [01-layers-and-standards.md](01-layers-and-standards.md) (the
conceptual/schema-contract doc — what each layer *means* and what shape it
returns). This is the mechanics reference: which function fires, what
`completeJSON`/`runSearches` options it passes, and how retries actually
work, per step. Line numbers are as of this doc's date — expect drift.

**Updated 2026-08-13** for Samir's evidence redesign
([24](24-evidence-redesign-and-failure-tracking.md)): evidence generation
(per-perspective and global) split from 1 call into 3 — strategy → populate →
confidence. `generateWithOptionalSearch` (the old multi-round search loop) is
retired entirely; `runSearches` (search.ts) now runs at most once per unit,
inside the populate phase, since strategy decides search terms once, up
front, leaving nothing left to iterate on.

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
| Perspectives — stance | `runPerspectivesGenerateStances` — orchestrator-perspectives.ts:63 | swarm | medium (fixed — "no repair path exists for stance generation") | 1000 (fixed) | No | Feeds into the bundle; see Perspectives-review row for the actual gate | One call per perspective (n total), independent sessions (decision 019) |
| Perspectives — sub-questions | `runPerspectivesGenerateDetails` — orchestrator-perspectives.ts:226 | swarm | medium / high | 1100 / 4100 (1100 + `REPAIR_TOKEN_HEADROOM`) | No | degrade (bundle-level, see below) | 1 of 3 sub-elements generated in parallel per bundle (evidence moved out to its own 3-phase sequence below, 2026-08-13) |
| Perspectives — assumptions | same function — orchestrator-perspectives.ts:239 | swarm | medium / high | 1200 / 4200 | No | degrade | " |
| Perspectives — counterargument | same function — orchestrator-perspectives.ts:252 | swarm | medium / high | 1600 / 4600 | No | degrade | Cross-assigned to a different perspective's session (decision 019) |
| Perspectives — evidence strategy | `runPerspectivesEvidenceStrategy` — orchestrator-perspectives.ts:339 | swarm | medium (fixed — no repair-mode bump; "deciding search-vs-ask is a simple call by design," nothing to revise) | 500 (fixed) | No — decides `search_queries`/`needs_user_input` only, doesn't search itself | degrade | New 2026-08-13; runs after stance/sub-questions/assumptions/counterargument settle, not alongside them |
| Perspectives — evidence populate | `runPerspectivesEvidencePopulate` — orchestrator-perspectives.ts:391 | swarm | medium / high | 2400 / 5400 | **Yes** — `runSearches` (search.ts), ONE round per unit that asked, not a loop | degrade | "Another agent... fetch the data then input it into the JSON" (Samir) — writes claim/source_ref/caveats from real search results and/or the user's answer only; no confidence field yet |
| Perspectives — evidence confidence | `runPerspectivesEvidenceConfidence` — orchestrator-perspectives.ts:440 | swarm | medium / high | 800 / 3800 | No | degrade | Separate call/subagent scores each populated item's confidence (Samir's explicit scoping); also does the final merge into `PerspectiveBundle` |
| Perspectives — review | `runPerspectivesReview` — orchestrator-perspectives.ts:468 → `runReviewPanel` | swarm | low (panel, fixed) | 800 (panel, fixed) | No | **degrade** — the one step that degrades per-bundle instead of hard-blocking (`STEP_FAILURE_MODE['perspectives-review']`); other bundles unaffected | One panel run per bundle (n panels, not one shared panel) |
| Global assumptions | `runGlobalAssumptionsGenerate` (orchestrator-global.ts:76) → `runGlobalAssumptionsReview` (orchestrator-global.ts:110) | swarm | medium / high | 900 / 3900 | No | **hard-block** | Question-level, informed by all vetted perspectives but scoped to none |
| Global evidence strategy | `runGlobalEvidenceStrategy` — orchestrator-global.ts:137 | swarm | medium (fixed — same no-repair-bump rule as perspectives-evidence-strategy) | 500 (fixed) | No | **hard-block** | One question-level unit, not n per-perspective ones |
| Global evidence populate | `runGlobalEvidencePopulate` — orchestrator-global.ts:185 | swarm | medium / high | 2400 / 5400 | **Yes** — `runSearches`, ONE round | **hard-block** | Twin of perspectives-evidence-populate |
| Global evidence confidence | `runGlobalEvidenceConfidence` — orchestrator-global.ts:228 | swarm | medium / high | 800 / 3800 | No | **hard-block** | Twin of perspectives-evidence-confidence; merges into `GlobalEvidencePacket` |
| Global evidence review | `runGlobalEvidenceReview` — orchestrator-global.ts:259 → `runReviewPanel` | swarm | low (panel, fixed) | 800 (panel, fixed) | No | **hard-block** | Reviews the merged `GlobalEvidencePacket` (confidence phase's output) |
| Conclusions | `runConclusionsGenerate` (orchestrator-global.ts:276) → `runConclusionsReview` (orchestrator-global.ts:312) | swarm | medium / high | 1800 / 4800 | No | **hard-block** | Reads global assumptions + evidence + all vetted perspectives |
| Implications | `runImplicationsGenerate` (orchestrator-global.ts:329) → `runImplicationsReview` (orchestrator-global.ts:374) | swarm | medium / high | 1800 / 4800 | No | **hard-block** | Carries forward `caveats_from_degraded_layers` from any degraded perspective bundle |
| Final composition | `runFinalComposition` — orchestrator-global.ts:391 | **synthesis** | medium (fixed — "no repair path exists... every call here is a first-pass call by definition") | 1200 (fixed) | No | No panel — packaging only, thrown error → route-level failure/Retry | The one step on the `synthesis` role/lane, not `swarm` |

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
