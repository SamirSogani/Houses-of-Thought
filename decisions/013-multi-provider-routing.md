# Decision 013 — Multi-provider routing engine (supersedes 012)

**Date:** 2026-07-11
**Status:** Implemented — `lib/ai/router.ts` routes every AI call by **role** down
a provider failover lane. Replaces the Groq-only two-tier chain of
[decision 012](012-groq-tiered-failover.md). `completeJSON` keeps its signature
plus a required `role`, so routes changed only that one field.

## Context

One provider (Groq) meant one org's rate limits gated every student action. We
want zero visible downtime and low latency per surface, spreading load across the
free tiers of several OpenAI-compatible providers.

## Decision

Five providers, one OpenAI-compatible SDK client per **key** (base URLs fixed;
each model authenticates with its own model-named env var):

| Provider | Base URL | Models used |
|---|---|---|
| Mistral | `api.mistral.ai/v1` | `ministral-8b-latest` |
| Groq | `api.groq.com/openai/v1` | `qwen/qwen3.6-27b`, `openai/gpt-oss-20b` |
| Google | `generativelanguage.googleapis.com/v1beta/openai/` | `gemini-2.5-flash` |
| Cerebras | `api.cerebras.ai/v1` | `gpt-oss-120b` |
| OpenRouter | `openrouter.ai/api/v1` | `qwen/qwen3-coder:free` (airbag only) |

### Lanes, keyed by role

- **Suggestor (sidebar suggestions)** — the most latency-sensitive surface, so it
  leads with Cerebras' ultra-fast custom hardware, then falls onto the real-time
  tail: **Cerebras `gpt-oss-120b` → Mistral → Groq → Google**. (The research
  route's internal query-derivation is *not* the sidebar; it stays on the
  real-time lane via the `coach` role.)
- **Real-time background (coach | critic)** — **Mistral `ministral-8b-latest` →
  Groq `qwen3.6-27b` → Google `gemini-2.5-flash` → Cerebras `gpt-oss-120b`.**
- **Drafter (on-demand complex)** — **Google `gemini-2.5-flash` → Cerebras
  `gpt-oss-120b`**, for the large context + daily budget.

### Groq penalty box

A Groq 429 is read as an *org-wide* block, so we do not hop to the other Groq
model. Instead a 30s penalty box opens: while it holds, real-time / suggestor
traffic skips Groq and diverts to Google (then Cerebras). After it clears, Groq
resumes on the safer `gpt-oss-20b` until one call succeeds, then reverts to qwen.

### Daily airbag

OpenRouter stays completely isolated. Only a **verified daily-quota** 429 (matched
by explicit per-day markers, not a bare `RESOURCE_EXHAUSTED`) flips the global
`dailyLimitsExhausted` flag, after which OpenRouter's free model is the terminal
fallback for the rest of the UTC day.

### Cascade discipline

Only HTTP 429 advances to the next target. 401 / 400 / 5xx / network throw
immediately (`maxRetries: 0`), so a misconfiguration surfaces instead of draining
the chain. `reasoning_effort` and `response_format` are still mapped per model
family (gpt-oss → `low`/`high` + `json_schema`; qwen *reasoning* → `none`/`default`;
Mistral / Gemini / qwen *coder* → omitted, `json_object`).

## Notes

- Model IDs, key env-var names, and base URLs are all env-overridable.
- Observability + the admin monitor (`/admin`) read `getRouterSnapshot()` and can
  actively probe each target; see the per-model detail at `/admin/model`.
- The `qwen/qwen-2.5-coder-32b:free` id from the original spec does not exist on
  OpenRouter; the live free coder is `qwen/qwen3-coder:free`.
