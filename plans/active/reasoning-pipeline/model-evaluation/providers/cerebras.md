# Provider: Cerebras

See [README.md](../README.md) for the 🟢/📋/⏳ provenance legend.
Everything here is 📋, sourced from
[router-lanes.ts](../../../../../lib/ai/router-lanes.ts) and
[router.ts](../../../../../lib/ai/router.ts).

## Role across lanes

`gpt-oss-120b` on Cerebras's custom hardware:

- **Suggestor** — primary, leads the whole lane. Sidebar suggestions are
  the most latency-sensitive surface in the app, and Cerebras's hardware is
  this fleet's lowest-latency target — the explicit reason it's first here
  and nowhere else.
- **Realtime (`coach`/`critic`)** — "multi-throttle bridge," last in the
  chain, reached on a Google 429 (i.e. everything else already struggling).
- **`drafter`** — last fallback, after Groq and Gemini.
- **Not in `swarm`/`synthesis`** — DeepInfra-only by policy; see
  [providers/deepinfra.md](deepinfra.md).

## Known bug: weaker `json_schema` enforcement than Groq's

Confirmed live 2026-08-02
([plans/active/reasoning-pipeline/14](../../14-dynamic-budget-enforcement.md)):
despite strict `json_schema` mode being requested, Cerebras returned a
**200** with the correct object wrapped in a one-element array — a shape
Groq's own strict-schema enforcement would have rejected outright as
`json_validate_failed` (see [providers/groq.md](groq.md)), cascading
cleanly. Cerebras's `200`-with-wrong-shape response only gets caught by this
app's own Zod parse, one layer later — a real reliability gap between how
strictly the two providers actually honor the schema they both nominally
support.

**Fix:** `completeJSON`'s `tryParse` (router.ts) does a defensive unwrap —
if the schema fails against the raw parsed value AND that value is a
one-element array, it retries validation against the unwrapped element.
Retried only on this exact observed shape (not a general JSON-repair tool):
if the array-of-one doesn't *also* satisfy the schema, the original error is
what's reported. `JSON_SHAPE_GUARDRAIL` (router.ts) — a prompt-level
instruction not to wrap the response in an array — was added as a
complementary prevention layer, unconditional across every provider since it
costs nothing where the shape was already correct.

## ⏳ Still needed

- How often the array-wrapping bug actually recurs after the guardrail +
  unwrap fix shipped — no dedicated real-verification session for Cerebras
  specifically is on file, only the original 2026-08-02 finding.
- Real latency numbers for the suggestor lane (where Cerebras is primary) —
  no numbered doc has measured this directly.
- Pricing (not recorded anywhere in-repo).
