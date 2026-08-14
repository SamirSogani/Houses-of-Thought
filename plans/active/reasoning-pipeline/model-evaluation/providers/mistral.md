# Provider: Mistral

See [README.md](../README.md) for the 🟢/📋/⏳ provenance legend.
Everything here is 📋, sourced from
[router-lanes.ts](../../../../../lib/ai/router-lanes.ts) and
[router-config.ts](../../../../../lib/ai/router-config.ts).

## Role across lanes

- **Realtime (`coach`/`critic`)** — primary, first in the chain. Kept off
  the bigger models deliberately to preserve the shared free-tier 50k TPM
  budget for this lane's latency-sensitive traffic.
- **Suggestor (sidebar suggestions)** — secondary, after Cerebras.
- **Not in `drafter`** — deliberately excluded, see below.
- **Not in `swarm`/`synthesis`** — those lanes are DeepInfra-only by policy;
  see [providers/deepinfra.md](deepinfra.md).

Model: `ministral-8b-latest` — the only model on this target; no swap
history recorded (unlike DeepInfra's six swaps).

## Why it's excluded from `drafter`

Tried, then deliberately dropped (2026-07-31): under real drafter traffic,
it reproducibly returned malformed JSON specifically on this role's more
complex structured-output schemas (perspectives' multi-field packets) —
wrapping array items in stray objects, or degenerating into repeated
whitespace instead of finishing valid JSON. Router-lanes.ts's own framing:
*"not a rate-limit or token-budget problem, just this model class
under-provisioned for what drafter role actually asks of it."* This predates
— and is a different failure shape from — the markdown-fence-wrapping bug
later found on DeepInfra's Llama-3.3-70B (see
[providers/deepinfra.md](deepinfra.md)); the two aren't the same root cause,
just adjacent evidence that json_object-fallback models can fail differently
under complex schemas.

## Reasoning effort

No `reasoning_effort` field — `reasoningEffortFor()` (router-shared.ts)
omits it entirely for Mistral (`undefined`), unlike every other provider on
this target's roster.

## ⏳ Still needed

- Real success-rate data for Mistral's realtime/suggestor traffic — no
  numbered doc in this folder has investigated Mistral specifically the way
  several exist for DeepInfra and Groq.
- Whether the drafter-lane exclusion has been re-tested since 2026-07-31, or
  is still standing on that one session's finding.
- Pricing (not recorded anywhere in-repo).
