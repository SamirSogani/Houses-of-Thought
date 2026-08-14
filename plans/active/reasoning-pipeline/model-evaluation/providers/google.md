# Provider: Google (Gemini)

See [README.md](../README.md) for the 🟢/📋/⏳ provenance legend.
Everything here is 📋, sourced from
[router-lanes.ts](../../../../../lib/ai/router-lanes.ts),
[router-shared.ts](../../../../../lib/ai/router-shared.ts), and
[doc 20](../../20-deepinfra-tuning-real-verification.md).

## Role across lanes

`gemini-2.5-flash` is the deliberate **large-context escape hatch**
(~1M-token window, `CTX.gemini`) across every lane it appears in:

- **Realtime (`coach`/`critic`)** — shock absorber while Groq is cooling
  down or 429'd, positioned after DeepInfra's relief valve.
- **Suggestor** — same shock-absorber role, after Mistral.
- **`drafter`** — not primary, but stays in the chain specifically so
  size-aware routing (any request too big for Groq/Cerebras's 128k windows)
  lands here regardless of nominal lane order.
- **Not in `swarm`/`synthesis`** — DeepInfra-only by policy; see
  [providers/deepinfra.md](deepinfra.md).

Also: on a Groq 429, Gemini is one of the two targets (with Cerebras) every
non-swarm lane bridges to while the Groq penalty box holds — see
[providers/groq.md](groq.md).

## Cost-driven reasoning-effort cap — different from every other model here

Gemini 2.5's OpenAI-compatible endpoint accepts `reasoning_effort` and
**defaults to dynamic thinking**, billed as output tokens at the priciest
out-rate in this app's whole provider fleet — "~50-70% of drafter-lane cost
when left on" (router-shared.ts's own comment). `reasoningEffortFor()` caps
anything above `'low'` down to `'low'` for Gemini specifically —
**unconditionally**, `allowHighReasoning` does *not* override this the way
it does for gpt-oss/qwen's floor. This is the one place in the routing
engine where a cap exists for cost, not for an empty-completion risk.

## Known bug: truncates `global_assumptions_packet` at 900 tokens

Found during [doc 20](../../20-deepinfra-tuning-real-verification.md)'s
tuning session, while DeepInfra was the primary suspect for a different
issue — Gemini itself was observed truncating this specific first-pass call
at its 900-token budget. Same class of problem as the repair-mode
token-exhaustion bug that motivated `REPAIR_TOKEN_HEADROOM`, but on a
**first-pass** call, outside that fix's scope. **Flagged, not fixed** — see
doc 20's "Known gaps."

## ⏳ Still needed

- Whether the 900-token truncation bug has recurred or been fixed since
  doc 20 (2026-08-12) — no follow-up doc addresses it directly.
- Real latency/reliability numbers for Gemini specifically — it has never
  been the primary target in a real-verification session, only ever a
  fallback, so no dedicated data exists.
- Pricing (not recorded anywhere in-repo, beyond the qualitative "priciest
  out-rate" note above).
