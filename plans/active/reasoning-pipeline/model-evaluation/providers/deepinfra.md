# Provider: DeepInfra

See [README.md](../README.md) for the 🟢/📋/⏳ provenance legend. Cross-refs:
[latency.md](../latency.md), [reliability.md](../reliability.md),
[cost.md](../cost.md).

## Role across lanes

- **`swarm`/`synthesis`** ([router-lanes.ts](../../../../../lib/ai/router-lanes.ts)):
  the *only* target, no fallback — "DeepInfra, no matter what for now"
  (Samir, verbatim, [doc 20](../../20-deepinfra-tuning-real-verification.md)'s
  addendum). Deliberate, temporary reduction in resilience: a genuine
  DeepInfra outage now fails a swarm/synthesis call outright. Retried on
  itself `DEEPINFRA_SAME_TARGET_ATTEMPTS = 3` times per call before giving
  up (added after [doc 23](../../23-deepinfra-intermittent-reliability-and-same-target-retry.md)
  found DeepInfra's own failures are intermittent, not systemic).
- **Realtime (`coach`/`critic`)**: paid relief valve, second in the chain
  after Mistral — added 2026-08-10 when Mistral's free tier plus the
  reasoning pipeline's 9-parallel review panels were exhausting shared quota
  fast enough that even n=2 test runs failed roughly half the time.
- Not in `drafter` or `suggestor` — see those providers' own docs.

## Model history — six swaps, one target, one line to change

`TARGETS.deepinfra.model` ([router-config.ts](../../../../../lib/ai/router-config.ts))
is deliberately model-agnostic in naming (not `deepinfraGptOss20b` etc.) —
2026-08-10, after the first swap required a 4-file rename. Every entry below
is 📋 from that file's own comment history plus commit `e8a8682`, except the
last two (this session, 🟢).

1. **`Llama-3.1-8B-Instruct`** (original). Swapped away: didn't reliably
   incorporate the review panel's regeneration feedback — repeatedly
   re-failed the same standards instead of converging.
2. **`openai/gpt-oss-20b`** (2026-08-10). Chosen for the same-model-family
   confidence Groq already had with it. Failure mode: its "Harmony" response
   format has a hidden internal reasoning phase that sometimes never hands
   off to the visible answer — 5 consecutive real failures on
   `global-assumptions-generate` in one incident, confirmed via DeepInfra's
   own dashboard (received, billed, no rate limit — model behavior, not
   infra). Full investigation: [doc 23](../../23-deepinfra-intermittent-reliability-and-same-target-retry.md).
3. **`deepseek-ai/DeepSeek-V3`** (2026-08-13, same-day incident response).
   Plain non-reasoning model — no hidden channel, structurally can't hit
   gpt-oss-20b's failure class. Real-verified twice, clean both times
   (Frame 9/9, both Perspectives 9/9, zero regenerations). Only problem:
   very slow (671B/37B active MoE) — one step alone took 2.3 minutes; the
   whole Perspectives layer over 8 minutes. Forced
   `DEEPINFRA_SWARM_TIMEOUT_MS` 60s→200s just to let it finish; never
   right-sized back down since. The only model on this target with
   confirmed strict `json_schema` support
   (`supportsJsonSchema()`, router-shared.ts — DeepInfra's docs explicitly
   name it).
4. **`meta-llama/Llama-3.3-70B-Instruct-Turbo`** (2026-08-13, hours later).
   Theory: keep DeepSeek-V3's no-hidden-channel win, smaller (70B dense) so
   faster. Speed theory held (~25-27s/call) but never got assessed properly:
   **4/4 real attempts failed** — wrapped valid JSON in a markdown code
   fence, breaking `JSON.parse`. Root cause: never granted
   `supportsJsonSchema()` (unconfirmed on DeepInfra), so it ran on the
   looser `json_object` fallback with no constrained-decoding guarantee.
   Note the exact id matters: the bare `meta-llama/Llama-3.3-70B-Instruct`
   404s on DeepInfra — only the FP8-quantized `-Turbo` variant is served.
5. **`Qwen/Qwen3-235B-A22B-Instruct-2507`** (2026-08-13, same evening).
   Chosen for a *structural* guarantee against gpt-oss-20b's failure class:
   its model page states it "supports only non-thinking mode and does not
   generate `<think></think>` blocks" — not a default that could be
   accidentally overridden. Real-verified once, clean (22/22, zero
   regenerations, zero JSON-parsing failures) — added
   `stripMarkdownFence()` (router.ts) as general insurance the same session,
   whether or not Qwen actually needed it is unconfirmed either way. **Then
   failed in real production traffic the next day** (this session,
   `ai-invalid-output` at `perspectives-evidence-strategy`) — see
   [reliability.md](../reliability.md)'s caveat section for why one clean
   run isn't proof.
6. **`deepseek-ai/DeepSeek-V4-Flash-0731`** (2026-08-14, current default) 🟢.
   Exploratory swap — Qwen hadn't failed *its own* real-verification, this
   was tried because DeepSeek released V4-Flash the same week (284B/13B
   active MoE, 1M context, "agentic"-tuned). Confirmed the exact dated id
   (`-0731`) over the bare `DeepSeek-V4-Flash`, which DeepInfra's own page
   copy marks as the superseded preview. **Known, flagged-before-testing
   risk:** unlike DeepSeek-V3 and Qwen, this model's page documents a
   `reasoning_effort` param and `reasoning_content` field — it *does* have a
   hidden reasoning channel, the same shape of mechanism that broke
   gpt-oss-20b. Real-verified once this session: full 22/22 real run, zero
   regenerations, zero `ai-empty-output` — the risk didn't materialize this
   run, but per the same "one run isn't proof" lesson from Qwen, that's not
   confirmation it never will. Also not granted `supportsJsonSchema()` —
   DeepInfra's structured-outputs docs still only confirm DeepSeek-V3.

## `supportsJsonSchema()` status — one model, out of six

Only `deepseek-ai/DeepSeek-V3` has confirmed strict `json_schema` support on
DeepInfra ([router-shared.ts](../../../../../lib/ai/router-shared.ts), matched
via a `deepseek-v3` substring, deliberately not a bare `deepseek` match so R1
and other variants don't silently inherit it). Every other model this target
has run — including the current default — runs on the looser `json_object`
fallback (schema described in the prompt, not enforced), backed only by
`JSON_SHAPE_GUARDRAIL` (a prompt-level ask) and `stripMarkdownFence()` (a
parse-time defense). This codebase's own rule, learned from Llama-3.3-70B:
a model's own "Supports JSON" badge is not a reliable signal — only an
explicit mention in DeepInfra's structured-outputs docs earns the flag.

## Known open items

- `perspective_evidence`/`global_evidence` — the two step-families that
  route through `generateWithOptionalSearch`'s multi-round search chain —
  are the most exposed by the no-fallback policy: a slow/empty DeepInfra
  round has nothing to fail over to. Flagged in doc 20's addendum, partly
  addressed by [doc 22](../../22-vercel-hobby-duration-and-stagger-fix.md)
  (duration/stagger) and [doc 23](../../23-deepinfra-intermittent-reliability-and-same-target-retry.md)
  (same-target retry), not eliminated.
- Gemini truncates `global_assumptions_packet` at 900 tokens on repair —
  a DeepInfra-adjacent finding (surfaced while DeepInfra was the primary
  suspect), not yet fixed; see doc 20's "Known gaps."
- No per-request cost/token telemetry — see [cost.md](../cost.md).
