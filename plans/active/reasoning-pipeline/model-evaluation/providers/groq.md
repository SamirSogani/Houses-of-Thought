# Provider: Groq

See [README.md](../README.md) for the 🟢/📋/⏳ provenance legend.
Everything here is 📋, sourced from
[router-lanes.ts](../../../../../lib/ai/router-lanes.ts),
[router-shared.ts](../../../../../lib/ai/router-shared.ts), and
[doc 20](../../20-deepinfra-tuning-real-verification.md).

## Role across lanes

Two distinct Groq models, used for different purposes:

- **`groqGptOss20b` (`openai/gpt-oss-20b`)** — `drafter` lane's primary.
  Pinned specifically (not `currentGroqTarget()`'s qwen default) because
  Groq's strict `json_schema` structured output "is only reliable on the
  gpt-oss family" — confirmed live 2026-07-31 the first real run after Groq
  went primary here, when the qwen model 400'd with `json_validate_failed`
  on the looser `json_object` mode Groq forces qwen into.
- **`currentGroqTarget()` (`qwen/qwen3.6-27b`)** — suggestor and realtime
  lanes' Groq step, reached via a stateful penalty-box gate (below).
- **Was** `swarm`/`synthesis`'s leader once (pre-decision-020's DeepInfra
  addition), but is now excluded from both entirely — see
  [reliability.md](../reliability.md) for why (zero repair-mode calls ever
  succeeded via Groq on this traffic shape).
- Shares one penalty box, account-level, across every lane that uses it.

## The penalty box — Groq is treated as special

A Groq 429 is read as an **org-wide** block, not a per-model one — so the
router does not immediately hop to the fallback gpt-oss-20b on the same
account. Instead it opens a strict 30s penalty box
(`openGroqPenalty()`/`groqCoolingDown()`, router-state.ts): while open, every
lane that touches Groq skips it entirely and diverts to Google, then
Cerebras. Once the window clears, Groq is allowed again but only on the
safer fallback model (gpt-oss-20b) until one call actually succeeds.

## Known failure modes

- **`json_validate_failed`** (400) — Groq's own strict `json_schema`
  constrained-decoding validation rejecting the model's OWN generation, not
  a malformed request from this app. Confirmed live 2026-07-31 on
  `frame_packet`: a fully coherent response that just never closed its final
  string's quote, and separately, one missing a required field. Classified
  as cascade-worthy (same treatment as an empty generation), not a terminal
  400 — `isGroqJsonValidateFailed()` (router-shared.ts).
- **413 "Request too large" (TPM ceiling)** — a single request's *size*
  (not rate) can exceed Groq's account-level 8000 TPM ceiling outright,
  distinct from an ordinary 429. Real-verified 2026-08-12: once
  `REPAIR_TOKEN_HEADROOM` (budget.ts) widened repair-mode requests, some
  started tripping this. This did NOT cascade before the fix — it fell
  through every classification in `execute()` to the terminal throw,
  killing the whole fallback chain immediately without ever reaching
  Gemini. Fixed via `isGroqTokenLimitExceeded()`. Deliberately **not**
  routed through the 429/penalty-box path — a temporary cooldown doesn't
  fix a request that's structurally too big.
- **Zero repair-mode calls ever succeeded via Groq**, across every
  regeneration attempt observed in [doc 20](../../20-deepinfra-tuning-real-verification.md)'s
  session — always either the 413 above or `json_validate_failed` just
  under it. This (plus doc 20's Confirmed Hobby-plan duration ceiling at
  the time) is the direct reason `swarmAttempts()`/`synthesisAttempts()`
  skip Groq entirely when `allowHighReasoning` is set, and — once
  decision-020's DeepInfra-only pinning shipped — skip it unconditionally.

## Reasoning-effort vocabulary

`qwen3.6-27b` (the reasoning variant) accepts only `none`/`default` — no
distinct `medium` tier, unlike gpt-oss. `qwen3-coder`/`qwen-2.5-coder`
(coder variants) accept no `reasoning_effort` field at all — excluding
`coder` from the qwen match is what keeps the OpenRouter airbag (which also
runs a qwen coder model) from 400ing.
`gpt-oss-20b`'s `'high'` effort is capped to `'low'` by default unless a
caller explicitly opts in via `allowHighReasoning` — confirmed live that
uncapped `'high'` reasoning can consume an entire `maxTokens` budget on
internal reasoning tokens before emitting any answer content, reproduced on
both `qwen` and `gpt-oss-20b` via Groq specifically (surfaced as
`json_validate_failed` with an empty `failed_generation`).

## ⏳ Still needed

- Real success-rate numbers outside the specific incidents above (doc 20's
  investigation is thorough but scoped to one tuning session).
- Current status of the drafter-lane gpt-oss-20b pinning under real traffic
  since 2026-07-31 — no later real-verification of this specific lane is on
  file.
