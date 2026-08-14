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
| `deepseek-ai/DeepSeek-V4-Flash-0731` | ✅ yes | None observed this run — including no `ai-empty-output` despite this model having a hidden `reasoning_effort`/`reasoning_content` channel, the same *shape* of risk that broke gpt-oss-20b | 1/1 real-verification run clean (22/22 calls, zero regenerations) |

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
ones that later showed real production trouble (gpt-oss-20b, Qwen) both
passed their own initial real-verification cleanly first.

## Specific error classes seen, by name

For grep-ability against future logs:

- `ai-empty-output` — HTTP 200, but `completion.choices[0].message.content`
  is empty. gpt-oss-20b's signature failure (hidden reasoning phase never
  hands off).
- `ai-invalid-output` — content came back, but failed `JSON.parse` (even
  after `stripMarkdownFence`) or failed Zod schema validation, twice in a
  row (first attempt + completeJSON's one corrective retry). Qwen's
  production failure this session.
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
  table, including the current default.
- Re-measurement of the Past Runs DONE/HALTED/RUNNING split after the
  `after()` persistence fix ships, to separate model reliability from
  persistence reliability.
- `Llama-3.1-8B-Instruct`'s and `openai/gpt-oss-20b`'s exact real attempt
  counts pre-decision-020 — only qualitative descriptions survive in
  router-config.ts's comments, not raw counts.
