# Decision 012 — Two-tier Groq failover (supersedes 006's single-model choice)

**Date:** 2026-07-10
**Status:** Implemented — `lib/ai/groq.ts` routes every AI call through an ordered
two-tier chain that falls through on HTTP 429. Supersedes the `openai/gpt-oss-120b`
single-model default from [decision 006](006-groq-model-choice.md); the 006
reasoning about *why* reasoning-capable structured-output models (JSON adherence,
safety, the effort knob) still holds and is unchanged.

## Context

The single `openai/gpt-oss-120b` client meant one rate-limit bucket between every
student and every critique. Under classroom-scale bursts a 429 surfaced as an
error mid-critique — the exact moment we least want one. We want zero visible
downtime: a rate-limited request should silently degrade to a faster model, not
fail.

## Decision

Two tiers, each with its own Groq key, tried in order. **Only HTTP 429 advances
to the next tier**; 401/400/5xx are logged and surfaced (we bypass rate limits,
not real bugs).

| Tier | Model | Key env | Role |
|---|---|---|---|
| 1 | `qwen/qwen3.6-27b` | `GROQ_QWEN_3_POINT_6_27B_API_KEY` | The standard for everything, incl. suggestions, under light traffic |
| 2 | `openai/gpt-oss-20b` | `GROQ_OPENAI_GPT_OSS_20B_API_KEY` | Fast fallback on a Tier-1 429; also the entry point for low-effort work under heavy traffic |

No third fallback: if the entry tier and everything below it 429, the call throws
429 (the rate-limit UX handles it). Model IDs are env-overridable
(`GROQ_TIER{1,2}_MODEL`). `completeJSON`'s signature is unchanged, so the five
routes were untouched. Both remaining models are reasoning models, so
`reasoning_effort` is always sent.

### Entry tier = `effort` + a live traffic gauge
- **High-effort** work (`effort:'high'` — house health, research, context) always
  starts on **Tier 1**.
- **Low-effort** work (`effort:'low'` — suggestions/strawman/interview) starts on
  **Tier 1 when traffic is light**, and drops to **Tier 2 under heavy traffic** to
  shed load.

"Heavy traffic" is an **in-memory in-flight gauge**: a module-level counter of
concurrent `completeJSON` calls, `>= 2` ⇒ heavy (matching the "<2 people = light"
line). The app has no real-time concurrency signal — `ai_usage` (migration 0011)
is a *daily* counter, useless for "right now" — and a DB-backed sliding window is
extra infra + a per-call round-trip we don't want. The gauge's one honest limit:
on Vercel's serverless runtime each instance keeps its own counter, so under real
fan-out it under-counts. That fails safe — it degrades toward Tier 1, never
wrongly starves the heavy model — and needs zero infra. Swap for a shared counter
if a global signal is ever required.

### Single account, per-model buckets
All keys are on one Groq account. Groq's rate limits are **per-model**, so a
Tier-1 429 (qwen bucket exhausted) still leaves Tier 2's (gpt-oss-20b) bucket
available — the failover works without separate accounts. Multiple keys on one
account share nothing extra; the resilience comes from switching models.

### Brave is unchanged
Brave Search authenticates with its own `BRAVE_SEARCH_API_KEY`, independent of
Groq keys — there is nothing to "wire into" the Groq keys. It already runs across
all tiers/routes.

## Notes

- Old symbols removed: `GROQ_API_KEY`, `GROQ_MODEL`, `AI_MODEL`, single shared
  client. The gpt-oss-120b key is disconnected.
- No `llama-3.1-8b-instant` tier: it retires 2026-08-16, and a third fallback
  wasn't wanted. `.env.example` documents the two tier keys + optional overrides.
