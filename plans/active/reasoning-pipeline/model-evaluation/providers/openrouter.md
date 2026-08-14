# Provider: OpenRouter

See [README.md](../README.md) for the 🟢/📋/⏳ provenance legend.
Everything here is 📋, sourced from
[router.ts](../../../../../lib/ai/router.ts) and
[router-config.ts](../../../../../lib/ai/router-config.ts).

## Role: the daily-exhaustion airbag, not a normal lane member

OpenRouter is structurally different from every other provider in this
fleet — it is **not** part of any lane's normal ordered failover chain. It
stays completely isolated from ordinary traffic: a per-second or per-minute
429 anywhere else **never** reaches it. It only fires as a last-resort
"airbag" when a whole lane is verifiably **daily**-exhausted — every
configured, size-adequate target in the attempted lane either just 429'd on
a daily quota or was already marked exhausted earlier that day
(`laneDailyBlackout` in `execute()`, router.ts). A single provider merely
rate-limited or erroring (with the rest of the lane still healthy) never
reaches OpenRouter.

Model: `qwen/qwen3-coder:free`. **Not** in any of `swarm`/`synthesis` (which
are DeepInfra-only by policy) — the airbag exists app-wide but the reasoning
pipeline's own dedicated lanes opted out of even this last-resort fallback
as part of the same "no matter what" posture; see
[providers/deepinfra.md](deepinfra.md).

## A wrong model id was already caught here once

Router-config.ts's own comment flags this directly: the spec's
`'qwen/qwen-2.5-coder-32b:free'` is **not** a real OpenRouter model id — it
400s. The live free coder model is `'qwen/qwen3-coder:free'`. Worth knowing
if this ever gets revisited from a spec/plan doc rather than the code
itself, since the plan and the code disagree on the id.

## Reasoning-effort exclusion

`reasoningEffortFor()` (router-shared.ts) matches on `qwen` but explicitly
excludes anything containing `coder` — this is specifically what keeps the
OpenRouter airbag's qwen-coder model from 400ing on a `reasoning_effort`
field that coder variants don't accept (unlike the reasoning variant,
`qwen3.6-27b`, used on Groq — see [providers/groq.md](groq.md)).

## ⏳ Still needed

- Has the airbag ever actually fired in production? No real-verification
  doc records a genuine whole-lane daily blackout being observed live —
  every daily-quota discussion elsewhere in this folder is about the
  *mechanism*, not a confirmed real trigger.
- Pricing — `:free` suggests zero cost, but this hasn't been explicitly
  confirmed against OpenRouter's actual billing for this specific model.
