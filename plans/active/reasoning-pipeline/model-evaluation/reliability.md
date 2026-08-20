# Reliability — did it actually work?

Scope: `TARGETS.deepinfra`, swarm/synthesis lanes. See [README.md](README.md)
for the 🟢/📋/⏳ provenance legend.

## Matrix

| Model | Completed a full real run? | Known failure mode(s) | Real sample size |
|---|---|---|---|
| `Llama-3.1-8B-Instruct` | ⏳ not recorded | Poor regeneration-feedback incorporation — repeatedly re-failed the same review standards instead of converging | ⏳ |
| `openai/gpt-oss-20b` | ⏳ never on record as a clean full run | Hidden "Harmony" reasoning phase sometimes never hands off to the visible answer (`ai-empty-output`, `finishReason: "stop"`, zero content); repair-mode calls exhaust their own token budget on hidden reasoning (`finishReason: "length"`) | 5 consecutive real failures on `global-assumptions-generate` (the incident that triggered the whole swap saga); separately, 3 real attempts at one step in another session — 2 failed, 1 succeeded |
| `deepseek-ai/DeepSeek-V3` | ✅ yes, twice | None found — genuinely fixed the empty-output bug (no hidden reasoning channel). Only issue was speed (see [latency.md](latency.md)), not correctness | 2/2 real-verification runs clean: Frame 9/9 first try both times, both Perspectives bundles passed review first try, zero regenerations |
| `meta-llama/Llama-3.3-70B-Instruct-Turbo` | ❌ no | Wrapped otherwise-valid JSON in a markdown code fence (` ```json ... ``` `), breaking `JSON.parse` before Zod ever saw it. Root cause: never granted `supportsJsonSchema()` (DeepInfra's docs don't confirm strict-schema support for it), so it ran on the looser `json_object` fallback with no constrained-decoding guarantee | **4/4 real attempts failed**, same way each time |
| `Qwen/Qwen3-235B-A22B-Instruct-2507` | ✅ yes, once cleanly — but see caveat below | `ai-invalid-output` (schema-invalid JSON surviving completeJSON's one corrective retry) observed in later production traffic, at `perspectives-evidence-strategy` | 1/1 real-verification run clean (22/22 calls, zero regenerations, zero JSON-parsing failures) — but the *next day*, a real production run failed. See caveat. |
| `deepseek-ai/DeepSeek-V4-Flash-0731` | ⚠️ mostly — but see concurrent-load caveat below | Solo run: none observed (no `ai-empty-output` despite the hidden `reasoning_effort`/`reasoning_content` channel). Under 9-way concurrent load: `ai-invalid-output` (5 events across 3/9 questions, at `frame-generate`, `global-assumptions-generate` x2, and `final-composition`) plus a distinct silent-stall pattern (`status: "running"`, `haltReason: null`, `lastStep` frozen across retries — 2/9 questions) | 1/1 solo real-verification run clean (22/22 calls). Concurrent: 9-way real load, n=2, same 9 questions as Qwen's — **6/9 (67%) done, 3/9 (33%) permanent failure** after 2 retries each |

## Caveat: Qwen's one clean run vs. the next day's production failure

This is the most important finding in this folder, and it argues against
trusting any single real-verification run as proof of reliability:

- **2026-08-13, same evening as the swap:** one real run, 22/22 calls
  succeeded, zero regenerations, zero JSON-parsing failures. Router-config.ts
  recorded this as Qwen "clearing the bar."
- **2026-08-14, this session:** a real production run against
  `houses-of-thought.vercel.app` failed at `perspectives-evidence-strategy`
  with `ai-invalid-output` — the model returned schema-invalid JSON twice in
  a row (completeJSON's first attempt + its one corrective retry), on a
  model that was never granted `supportsJsonSchema()` in the first place
  (DeepInfra's docs only confirm DeepSeek-V3 for strict mode — see
  [providers/deepinfra.md](providers/deepinfra.md)).
- **Browsing `/admin/reasoning/runs`'s full history this same session:** of
  ~35 recorded runs, only ~2 show `DONE` and ~4 show `HALTED` — the
  overwhelming majority sit at `RUNNING` with no `haltReason`. **This is a
  confounded signal, not a clean reliability measurement** — this session
  also found and fixed a real persistence-race bug (fire-and-forget writes
  losing to Vercel freezing the function right after the response returns;
  see the [route.ts fix](../../../../app/api/admin/reasoning/route.ts)),
  so an unknown fraction of those "stuck" rows may be runs that actually
  succeeded or failed cleanly but never got their terminal state recorded.
  **Do not read the ~35-row history as "Qwen failed ~90% of the time"** —
  that number conflates two different bugs (model reliability + persistence
  reliability) that are not yet separated. Re-measuring the DONE/HALTED/
  RUNNING split *after* the `after()` fix ships is the way to actually
  isolate the model's real success rate going forward.

**Practical takeaway:** one real-verification run — even a perfect 22/22 —
is a smoke test, not a reliability measurement. Every model swap in this
project's history has been "real-verified" on 1-2 runs before shipping; the
ones that later showed real production trouble (gpt-oss-20b, Qwen,
**and now DeepSeek-V4-Flash-0731**) all passed their own initial
real-verification cleanly first.

## DeepSeek-V4-Flash-0731's concurrent-load result — the caveat confirmed a third time

Same pattern as Qwen's caveat above, on the very next model tried: one
clean solo real-verification run (22/22, 2026-08-14), swapped in as
default, merged and deployed same day
([26-deepseek-v4-flash-model-swap-plan.md](../26-deepseek-v4-flash-model-swap-plan.md)),
then a 9-way concurrent real-load test (same shape as Qwen's, same 9
questions) run against production later that day found real trouble the
solo run couldn't have caught: **6/9 (67%) completed, 3/9 (33%) permanent
failure** after 2 retries each, split across two distinct failure modes —
explicit `ai-invalid-output` crashes (the exact risk this model's hidden
reasoning channel was flagged for before testing) and a separate,
previously-unseen silent-stall pattern with no `haltReason` at all. Full
breakdown: [26-deepseek-v4-flash-model-swap-plan.md](../26-deepseek-v4-flash-model-swap-plan.md)'s
"Final results" section. **Decision: rolled back to
`Qwen/Qwen3-235B-A22B-Instruct-2507`** via `DEEPINFRA_MODEL` env var.

Three for three now: gpt-oss-20b, Qwen, and DeepSeek-V4-Flash-0731 have
each passed a clean solo (or near-solo) real-verification run and then
shown a real failure mode only concurrent/production load surfaced. **No
model in this project should be trusted as a default off a single clean
run — concurrent-load testing before trusting a swap is no longer
optional, it's the pattern.**

## Specific error classes seen, by name

For grep-ability against future logs:

- `ai-empty-output` — HTTP 200, but `completion.choices[0].message.content`
  is empty. gpt-oss-20b's signature failure (hidden reasoning phase never
  hands off).
- `ai-invalid-output` — content came back, but failed `JSON.parse` (even
  after `stripMarkdownFence`) or failed Zod schema validation, twice in a
  row (first attempt + completeJSON's one corrective retry). Qwen's
  production failure this session; also DeepSeek-V4-Flash-0731's dominant
  concurrent-load failure (5 events across 3/9 questions in the 9-way test),
  at `frame-generate`, `global-assumptions-generate` (x2), and notably
  `final-composition` — the very last of 22 steps, after every prior gate
  passed 9/9.
- **Silent stall, no `haltReason`** — API `status` stays `"running"`,
  `haltReason: null`, and `lastStep`/`updatedAt` never move again, even
  across repeated manual retries. Client UI shows "Could not reach a stage
  of the pipeline" with no error detail. First seen on
  DeepSeek-V4-Flash-0731's concurrent-load test (2/9 questions, one of them
  stuck at the same step across all 3 attempts spanning the whole ~50min
  test). Not yet explained — could be a genuine server-side hang the Retry
  button can't fix, or a client-stream issue; unconfirmed which.
- Markdown-fence-wrapped JSON — a *cause* of `ai-invalid-output`/parse
  failure, not a separate error code. Llama-3.3-70B's signature failure,
  4/4 real attempts. `stripMarkdownFence` (router.ts) is the general-purpose
  defense added in response.
- `finishReason: "length"` on a repair-mode call — the model's hidden
  reasoning tokens consumed the entire `maxTokens` budget before any visible
  JSON. Fixed generically via `REPAIR_TOKEN_HEADROOM` (budget.ts), but only
  ever confirmed on gpt-oss-20b.
- `"Request timed out."` — SDK-level timeout at the attempt's configured
  window. Seen on gpt-oss-20b at the *old* (pre-2026-08-12) 60s ceiling;
  current ceiling is `DEEPINFRA_SWARM_TIMEOUT_MS = 200_000` (200s), not yet
  hit by any model tested since that raise.

## ⏳ Still needed

- Multiple real runs per model (n≥3) to get an actual success *rate*
  instead of a single pass/fail data point — true of every model in this
  table except DeepSeek-V4-Flash-0731 (now has 10 real runs total: 1 solo +
  9 concurrent) and Qwen (1 solo + 1 later production run).
- `Llama-3.1-8B-Instruct`'s and `openai/gpt-oss-20b`'s exact real attempt
  counts pre-decision-020 — only qualitative descriptions survive in
  router-config.ts's comments, not raw counts.
- Root-cause the silent-stall failure mode (no `haltReason`, frozen
  `lastStep`) found on DeepSeek-V4-Flash-0731 — unconfirmed whether it's
  server-side or client-side, and whether it's specific to that model or a
  latent bug any model could hit under load.
- Now that persistence is confirmed fixed (doc 25) and the same 9-way
  concurrent-load rig has been run twice (Qwen once, DeepSeek-V4-Flash-0731
  once), worth eventually re-running Qwen's exact same test again on
  current code to get a second data point under identical conditions —
  right now the two models' concurrent numbers aren't perfectly
  apples-to-apples (different days, different underlying code versions).
