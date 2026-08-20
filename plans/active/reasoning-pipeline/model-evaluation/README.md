# Model evaluation — index

**Started:** 2026-08-14. A standing doc set for comparing the models/providers
the reasoning pipeline's `swarm`/`synthesis` lanes have run against, separate
from the numbered narrative docs one level up (those are dated session
write-ups; this folder is a living comparison you update as new data comes
in, not a sequence to read in order).

Scope is the reasoning pipeline's dedicated lanes
([decision 020](../../../../decisions/020-deepinfra-swarm-synthesis-lanes.md),
[router-lanes.ts](../../../../lib/ai/router-lanes.ts)) — `swarm` (every
generate/review call except final composition) and `synthesis` (final
composition only), both currently DeepInfra-only by deliberate, temporary
policy ("no matter what for now" — Samir, doc 20's addendum). The provider
docs also cover the other four lanes (suggestor/realtime/drafter) where
relevant, since those share providers even though they don't share models.

## Docs in this folder

- [latency.md](latency.md) — side-by-side latency across every model tested
  on the DeepInfra swarm/synthesis target, broken down by pipeline area.
- [reliability.md](reliability.md) — did it actually complete a real run?
  Pass/fail per model, real failure modes observed, with counts where known.
- [cost.md](cost.md) — per-token pricing where known, the pipeline's call-
  count formula, and planning-vs-measured cost — mostly ⏳ pending real
  telemetry, see that doc's own note.
- [concurrency.md](concurrency.md) — 9 simultaneous real production runs:
  a 33% persistence-write loss rate, one genuine content halt, and the
  UX reality that every run needs manual intervention.
- `providers/` — one doc per provider (`deepinfra.md`, `groq.md`,
  `mistral.md`, `google.md`, `cerebras.md`, `openrouter.md`): that provider's
  role across every lane it's used in, and every quirk/bug this codebase has
  had to work around on it.

## Data provenance — read this before trusting a number

Every figure in this folder is tagged:

- 🟢 **Real-verified this session** (2026-08-14) — Claude ran it directly
  (browser-driven admin panel or local dev server) and is reporting a
  first-hand result.
- 📋 **From commit history / a prior numbered doc** — real, but Claude did
  not witness it directly; sourced from a specific commit message, code
  comment, or doc in `plans/active/reasoning-pipeline/`, cited inline.
- ⏳ **TBD** — not available to Claude from the repo or this session. Samir:
  paste in raw data (Vercel logs, DeepInfra dashboard exports, `/admin`
  monitor screenshots, whatever you have) and these get filled in for real
  rather than estimated.

Nothing in this folder is fabricated or interpolated — an ⏳ stays an ⏳
rather than getting a plausible-looking guess.

## Models covered so far

All on `TARGETS.deepinfra` ([router-config.ts](../../../../lib/ai/router-config.ts)),
in swap order:

1. `Llama-3.1-8B-Instruct` — original default, pre-decision-020 era
2. `openai/gpt-oss-20b` — 2026-08-10 → 2026-08-13
3. `deepseek-ai/DeepSeek-V3` — 2026-08-13 (same-day incident response)
4. `meta-llama/Llama-3.3-70B-Instruct-Turbo` — 2026-08-13 (hours later)
5. `Qwen/Qwen3-235B-A22B-Instruct-2507` — 2026-08-13 (same evening) → 2026-08-14
6. `deepseek-ai/DeepSeek-V4-Flash-0731` — 2026-08-14, current active default

Full narrative for all six: [providers/deepinfra.md](providers/deepinfra.md).
