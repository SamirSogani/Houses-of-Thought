# Runbook — AI model sunset / provider incident

What to do when a provider retires a model id or a lane starts failing.
Companion: `lib/ai/router.ts` header (lanes), `analysis/ai-subsystem.md` (M1/M5).

## Symptom

- A lane's traffic degrades onto its fallbacks (the router now cascades past
  5xx/404/timeouts, so users mostly won't notice — the monitor will).
- `/admin` target health shows a target stuck on ERROR with `HTTP 404` or
  `HTTP 400`; okCount stops moving.

## Diagnose

1. Open `/admin` → **Run live check**. Probes send the same structured-output
   shape as real traffic, so a sunset model id or a broken `response_format`
   shows ERROR here (a bare "ping" used to probe UP while real calls failed).
2. Check the provider's changelog/deprecations page for the model id shown.

## Fix (env override — no code change, no deploy of new code)

Every target's model id, base URL, and key env var are overridable via env
(`.env.example` documents the full matrix). In Vercel → Settings → Environment
Variables, set the relevant override and redeploy:

| Target | Override |
|---|---|
| Mistral ministral-8b | `MISTRAL_MODEL` |
| Groq qwen | `GROQ_QWEN_MODEL` |
| Groq gpt-oss-20b | `GROQ_GPT_OSS_MODEL` |
| Gemini flash | `GEMINI_FLASH_MODEL` |
| Cerebras gpt-oss-120b | `CEREBRAS_GPT_OSS_MODEL` |
| OpenRouter free | `OPENROUTER_FREE_MODEL` |

After redeploy: **Run live check** again; all targets should probe UP.

## Standing risks to check quarterly

- **Pin the floating alias:** `ministral-8b-latest` can be re-pointed by
  Mistral under prompts tuned to current behavior — pin a dated id via
  `MISTRAL_MODEL` once one is chosen.
- **Groq rotates its lineup** (decisions 006/012 — llama-3.1-8b sunset
  2026-08-16): re-verify both Groq model ids.
- **Gemini free-tier RPD**: `lib/ai/router.ts` assumes a ~1,500/day budget in
  its header; Google has repeatedly cut free RPD. Verify the live number — it
  is the drafter lane's binding capacity constraint.
- **OpenRouter free model id** has already rotated once (router.ts, target
  comment); confirm `qwen/qwen3-coder:free` still exists.
- Re-verify the Gemini `reasoning_effort` mapping (`reasoningEffortFor`) still
  matches Google's OpenAI-compat contract.
