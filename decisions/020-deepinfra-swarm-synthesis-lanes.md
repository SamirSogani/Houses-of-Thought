# Decision 020 — DeepInfra provider + reasoning-pipeline-only swarm/synthesis lanes

**Date:** 2026-08-10
**Status:** Implemented (routing, tests, docs) — pending real-key validation.
`DEEP_INFRA_API_KEY` was added to `.env` this same day; no live DeepInfra
traffic has been exercised yet, deliberately (Samir's call — key added,
testing deferred). **Extends** [decision 013](013-multi-provider-routing.md);
does not touch [016](016-draft-mode.md)–[018](018-house-chat-conclusion-candidates.md)'s
invariants, same scoping as [019](019-multi-agent-reasoning-pipeline.md) §Context.

## Context

The reasoning pipeline's real call volume — `14n + 54` (see
[budget.ts](../lib/ai/reasoning/budget.ts)'s `estimatePipelineCost`) — landed
almost entirely on two free-tier accounts (Mistral, primary for `critic`;
Groq, primary for `drafter`). Even the smallest supported run (n=2, 82 calls)
failed roughly half the time. Groq's Developer tier — zero code change, just
add a card — was not available to upgrade to at decision time, which is what
opened a provider search rather than a Groq upgrade.

## Decision

### 1. DeepInfra added as a sixth provider
[router-config.ts](../lib/ai/router-config.ts): new `ProviderId`, base URL
`https://api.deepinfra.com/v1/openai`, one target: `TARGETS.deepinfra`.

### 2. The target and key names are deliberately model-agnostic
The model was swapped mid-rollout (Llama-3.1-8B-Instruct → gpt-oss-20b → back
to Llama-3.1-8B-Instruct, gpt-oss-20b staged as the ready alternative) and
each swap required renaming across 4 files under the old, model-baked-in
naming (`deepinfraLlama8b` / `deepinfraGptOss20b`). The target is now just
`TARGETS.deepinfra`; switching models is one line — the `model` default in
router-config.ts, or `DEEPINFRA_MODEL` in env, no code change.

### 3. The real key is `DEEP_INFRA_API_KEY` — underscore, by exception
Every other DeepInfra override var (`DEEPINFRA_MODEL`, `DEEPINFRA_BASE_URL`,
`DEEPINFRA_KEY_ENV`, `DEEPINFRA_CONTEXT`) has no underscore, matching this
router's naming convention. The actual secret is `DEEP_INFRA_API_KEY` (with
one) because that's what was actually configured in `.env` — the code default
was changed to match the real key, not the other way around. Noted here so
the inconsistency reads as intentional, not a bug, the next time someone
greps for it.

### 4. DeepInfra joins the realtime lane as a relief valve
`coach`/`critic` traffic (shared app-wide, not reasoning-pipeline-specific):
Mistral → **DeepInfra** → Groq (penalty-aware) → Gemini → Cerebras. Not added
to `drafter` — see [router-lanes.ts](../lib/ai/router-lanes.ts)'s comment for
why that's still an open question, not a settled no.

### 5. Two new roles, scoped ONLY to the reasoning pipeline
`swarm` (every generate/review call in `lib/ai/reasoning/*` except final
composition) and `synthesis` (final composition only) — see
[router-lanes.ts](../lib/ai/router-lanes.ts) for the full lane order and
per-function rationale. Not used anywhere else in the app; `suggestor`,
`coach`, `critic`, `drafter` are unchanged for every other feature.

| Lane | Role(s) | Scope |
|---|---|---|
| Suggestor | `suggestor` | App-wide |
| Realtime | `coach`, `critic` | App-wide |
| Drafter | `drafter` | App-wide |
| **Swarm** | `swarm` | Reasoning pipeline only |
| **Synthesis** | `synthesis` | Reasoning pipeline only, final-composition step |

## Consequences

- Cost, at current pricing and pipeline volume: well under the original
  $0.012/decision and $36/month@100-decisions/day planning targets at both
  n=2 and n=3, assuming DeepInfra serves most calls — see the financial-case
  writeup prepared alongside this decision (not committed to the repo; ask
  Samir if it's needed again).
- `app/api/admin/reasoning/route.ts` and every other reasoning-pipeline file
  are otherwise untouched — only the `role` field passed to `completeJSON`
  changed at each call site.
- `components/admin/AiMonitor.tsx` renders the two new lanes.

## Deferred / open

- **Real rate limits, unverified.** Confirmed pricing and API shape by
  documentation search; never confirmed throughput under this app's actual
  9-parallel-panel burst pattern. First real run is the test.
- **Complex-schema risk carried over from Mistral's exclusion from
  `drafter`.** `swarm` routes perspectives/global-layer generation — the same
  class of multi-field structured output — through DeepInfra's
  Llama-3.1-8B-Instruct, a model of the same size class untested on this
  app's harder schemas. The one-line model swap to gpt-oss-20b (§2) exists
  specifically as the mitigation if this doesn't hold up.
- **No per-run cost/token telemetry yet.** The financial estimates above are
  planning estimates, not measurements — real per-run tracking is a separate,
  not-yet-built piece of work.
