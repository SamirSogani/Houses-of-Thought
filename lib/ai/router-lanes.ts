// Failover-lane composition for the routing engine: which providers, in
// which order, per role. Split out of router.ts (repo's 600-LOC rule) —
// router.ts's execute() only needs attemptsForRole()/Attempt/
// ATTEMPT_TIMEOUT_MS from here; everything about WHY a given order was
// chosen lives in this file, next to the code it explains. See decisions/006
// (model choice), 012 (failover), 013 (multi-provider), and 013's addendum
// (2026-08-10, swarm/synthesis — the reasoning pipeline's own dedicated
// lanes, DeepInfra-led).
//
// Five lanes, keyed by role. Three are shared across the whole app
// (suggestor, coach|critic, drafter); swarm and synthesis belong ONLY to the
// reasoning pipeline (lib/ai/reasoning/*) — see swarmAttempts()/
// synthesisAttempts() below for why they're separate from drafter/critic
// rather than reusing them.
//
//   SIDEBAR SUGGESTIONS  (suggestor)
//   The most latency-sensitive surface, so it leads with Cerebras' ultra-fast
//   custom hardware, then falls onto the real-time resilience tail.
//     1. Cerebras  gpt-oss-120b           (primary — ultra-fast)
//     2. Mistral   ministral-8b-latest    (on Cerebras 429)
//     3. Groq      qwen3.6-27b            (on Mistral 429)  ── stateful, see below
//     4. Google    gemini-2.5-flash       (while Groq cools / on Groq 429)
//
//   REAL-TIME BACKGROUND  (coach | critic)
//   Latency-sensitive background events fired by user activity. Kept off the big
//   models to preserve the shared Mistral 50k TPM budget.
//     1. Mistral   ministral-8b-latest    (primary)
//     2. DeepInfra gpt-oss-20b            (on Mistral 429)  ── paid relief valve, added
//                                          2026-08-10 (Samir): the reasoning pipeline's
//                                          9-parallel review panel (all `critic`) plus
//                                          real-time `coach` traffic were exhausting
//                                          Mistral's free tier and spilling onto Groq
//                                          fast enough that even n=2 test runs failed
//                                          roughly half the time — and Groq's paid
//                                          Developer tier wasn't available to upgrade
//                                          to at the time. TARGETS.deepinfra
//                                          (router-config.ts) is deliberately
//                                          model-agnostic in its naming — a same-day
//                                          detour through gpt-oss-20b and back needed a
//                                          4-file rename each way, which is why the model
//                                          itself is a one-line change (TARGETS.deepinfra's
//                                          `model` default, or DEEPINFRA_MODEL env, no code
//                                          change at all). Swapped to gpt-oss-20b again the
//                                          same day (Samir): real review-panel runs showed
//                                          Llama wasn't reliably incorporating the panel's
//                                          regeneration feedback. Same model id this
//                                          codebase already runs successfully on Groq (see
//                                          draftAttempts() below) and Cerebras, and it gets
//                                          the strict json_schema path (supportsJsonSchema(),
//                                          router-shared.ts) instead of the looser
//                                          json_object path Llama got — not cheaper, this
//                                          swap is for reliability.
//     3. Groq      qwen3.6-27b            (on DeepInfra failure)  ── stateful, see below
//     4. Google    gemini-2.5-flash       (while Groq cools / on Groq 429)
//     5. Cerebras  gpt-oss-120b           (multi-throttle bridge, on Google 429)
//
//   ON-DEMAND COMPLEX  (drafter)
//   Heavy framework generation. Leads with Groq (Samir's call, 2026-07-31: no
//   prior-project history of Groq itself failing — a problem here points at
//   this app's setup, not the provider), then falls back to Gemini's large
//   context and Cerebras. Mistral was tried here too and deliberately dropped
//   (2026-07-31): under real drafter traffic it reproducibly returned
//   malformed JSON on this role's more complex structured-output schemas
//   (perspectives' multi-field packets) — wrapping array items in stray
//   objects, or degenerating into repeated whitespace instead of finishing
//   valid JSON — not a rate-limit or token-budget problem, just this model
//   class under-provisioned for what drafter role actually asks of it.
//   Mistral stays primary/fallback in the suggestor and real-time lanes,
//   where the ask is simpler. Gemini stays in the chain (not primary) as the
//   large-context escape hatch: size-aware routing already skips Groq/
//   Cerebras's 128k windows for anything too big, landing on Gemini's ~1M
//   regardless of nominal order.
//
//   Drafter's Groq attempt deliberately pins gpt-oss-20b, NOT the qwen model
//   the other two lanes default to (currentGroqTarget()) — confirmed live
//   (2026-07-31) the very first real run after Groq went primary here:
//   supportsJsonSchema() (router-shared.ts) already documents that Groq's
//   strict json_schema structured output "is only reliable on the gpt-oss
//   family"; qwen gets the looser json_object mode (schema hinted in the
//   prompt, not enforced), and Groq's own API-side validation in that mode
//   400s with json_validate_failed when the model's freeform output doesn't
//   parse. Exactly what hit perspectives-generate-stances immediately. Not a
//   Groq reliability problem — a model-choice bug in what this lane asked
//   Groq for.
//     1. Groq      gpt-oss-20b            (primary — strict json_schema)
//     2. Google    gemini-2.5-flash       (on Groq cooling / 429)
//     3. Cerebras  gpt-oss-120b           (on Google 429)
//
// Groq is special. A Groq 429 is read as an *org-wide* block, so we do NOT
// immediately hop to gpt-oss-20b on the same account. Instead we open a strict
// 30s penalty box: while it is open, real-time traffic skips Groq entirely and
// diverts to Google (then Cerebras). Once the window clears, Groq is allowed
// again but on the safer fallback model gpt-oss-20b until one call succeeds.
// This penalty box is account-level state (router-state.ts), shared by every
// lane below, not lane-scoped.

import { TARGETS, type Target } from './router-config'
import { currentGroqTarget, groqCoolingDown } from './router-state'
import type { AiRole } from './router-shared'

export interface Attempt extends Target {
  // Real-time Groq attempts open the penalty box on a (non-daily) 429 instead of
  // hopping straight to another Groq model.
  penaltyOnRateLimit?: boolean
  // Per-attempt override of ATTEMPT_TIMEOUT_MS[role] (router.ts's execute()
  // reads this if set). Only swarmAttempts()'s DeepInfra entry sets it today
  // — see DEEPINFRA_SWARM_TIMEOUT_MS below.
  timeoutMs?: number
}

// One slow-but-alive target must not eat the whole serverless budget. Each
// role's route has its own maxDuration (most AI routes: 30s; the reasoning
// pipeline's app/api/admin/reasoning/route.ts, serving swarm/synthesis: 60s
// as of 2026-08-10 — see CHAIN_DEADLINE_MS, router.ts, for how these two
// numbers combine per role.
export const ATTEMPT_TIMEOUT_MS: Record<AiRole, number> = {
  suggestor: 8_000,
  coach: 8_000,
  critic: 8_000,
  drafter: 20_000,
  swarm: 20_000, // same budget as drafter — real generation/review work, not a quick check
  synthesis: 8_000, // packaging only, same budget as coach
}

// DeepInfra-in-swarm-specific widen (2026-08-10, Samir, real-verified live):
// the swarm lane's generic 20s was cutting off DeepInfra gpt-oss-20b calls
// that were NOT actually failing — DeepInfra's own dashboard showed those
// requests completed and billed (tiny amounts, these are small calls), our
// client just stopped waiting first. gpt-oss-20b is a real reasoning model —
// even reasoning_effort:"low" spends genuine wall-clock time on hidden
// "thinking" tokens before the visible JSON, which Llama-3.1-8B (no
// reasoning mode) never had to pay for — so the timeout tuned for Llama's
// flat completion speed is too tight for gpt-oss-20b's latency profile.
// Only DeepInfra gets this — Groq/Gemini/Mistral/Cerebras in the same lane
// are fast and don't need more room.
//
// Widened again the same day once the actual ceiling moved: DeepInfra's
// spend is a non-issue (paid account, these are cheap calls — real
// $-per-call is <$0.01), so the constraint here was never budget, only the
// route's serverless duration cap. app/api/admin/reasoning/route.ts's
// maxDuration went 30s → 60s alongside this (Vercel Hobby plan — needs
// Fluid Compute enabled to actually honor 60s; unverified from this
// codebase, confirm in the Vercel dashboard). CHAIN_DEADLINE_MS.swarm
// (router.ts) followed to 55s. DeepInfra is swarmAttempts()' FIRST attempt,
// so widening it still eats directly into that shared budget — 45s leaves
// ~10s for Groq's burst-absorber (or the schema-retry pass) if DeepInfra
// genuinely fails rather than just running slow, a healthier margin than
// the previous ~2s. Still a real trade-off, not a free win: raise further
// only alongside the route's maxDuration and CHAIN_DEADLINE_MS[swarm], kept
// in lockstep so the deadline never promises more than the route can honor.
const DEEPINFRA_SWARM_TIMEOUT_MS = 45_000

// Real-time background lane (coach | critic): Mistral primary, then the paid
// DeepInfra relief valve (see header comment above), then the Groq
// penalty-aware bridge to Google / Cerebras.
function realtimeAttempts(): Attempt[] {
  const attempts: Attempt[] = [{ ...TARGETS.mistral8b }, { ...TARGETS.deepinfra }]
  if (groqCoolingDown()) {
    // Shock absorber: Groq penalty is open — skip it entirely.
    attempts.push({ ...TARGETS.geminiFlash })
    attempts.push({ ...TARGETS.cerebrasGptOss120b })
  } else {
    attempts.push({ ...currentGroqTarget(), penaltyOnRateLimit: true })
    // On a Groq 429 we do not chain to another Groq model; we bridge to Google
    // then Cerebras while the freshly-opened penalty box holds.
    attempts.push({ ...TARGETS.geminiFlash })
    attempts.push({ ...TARGETS.cerebrasGptOss120b })
  }
  return attempts
}

// Sidebar suggestions ride an ultra-fast Cerebras-first lane — its custom hardware
// is the lowest-latency target, and suggestions are the most latency-sensitive
// surface. On a Cerebras 429 it falls onto the standard real-time resilience tail
// (Mistral → Groq → Google), sharing the same Groq penalty box.
function suggestorAttempts(): Attempt[] {
  const attempts: Attempt[] = [{ ...TARGETS.cerebrasGptOss120b }, { ...TARGETS.mistral8b }]
  if (groqCoolingDown()) {
    attempts.push({ ...TARGETS.geminiFlash })
  } else {
    attempts.push({ ...currentGroqTarget(), penaltyOnRateLimit: true })
    attempts.push({ ...TARGETS.geminiFlash })
  }
  return attempts
}

// On-demand complex generation (drafter): Groq leads (Samir's call, see the
// header comment above), sharing the same Groq penalty box as the other two
// lanes — while it's open, drafter traffic skips Groq entirely and leads
// with Gemini instead, same as realtimeAttempts()/suggestorAttempts().
// Pins gpt-oss-20b specifically (NOT currentGroqTarget()'s qwen default) —
// see the header comment above for why. Mistral deliberately excluded, also
// see the header comment above.
function draftAttempts(): Attempt[] {
  if (groqCoolingDown()) {
    return [{ ...TARGETS.geminiFlash }, { ...TARGETS.cerebrasGptOss120b }]
  }
  return [
    { ...TARGETS.groqGptOss20b, penaltyOnRateLimit: true },
    { ...TARGETS.geminiFlash },
    { ...TARGETS.cerebrasGptOss120b },
  ]
}

// Reasoning-pipeline-only lane (lib/ai/reasoning/*, decision 019 addendum,
// 2026-08-10): every generate/review call in the pipeline EXCEPT final
// composition (see synthesisAttempts() below). Not used anywhere else in the
// app — the rest of the app keeps suggestor/coach/critic/drafter untouched.
//
// DeepInfra leads (this is the highest-volume traffic in the app: 9 parallel
// review-panel calls per gate, repeated across 6 gates, plus every generate
// step) — TARGETS.deepinfra (router-config.ts), currently gpt-oss-20b
// (~$0.04/$0.15 per 1M — swapped from Llama-3.1-8B-Instruct the same day,
// Samir: Llama wasn't reliably incorporating the panel's regeneration
// feedback). Groq is the paid "burst absorber" behind it, pinned to the SAME
// gpt-oss-20b id for the same strict-json_schema reliability reason
// draftAttempts() pins it (NOT currentGroqTarget()'s qwen default — see
// draftAttempts()'s comment) — so these first two attempts are now the same
// model on two different providers' infrastructure. Worth remembering: a
// DeepInfra failure here says nothing about whether the MODEL itself is
// struggling, only that one provider's capacity is; Groq is still genuinely
// independent capacity, not a genuinely different fallback strategy, unless
// one of the two gets pointed at a different model again.
// Gemini → Mistral → Cerebras close out the chain — same three providers the
// rest of the app already relies on, just reordered behind the two paid
// targets here. Shares the same Groq penalty box as every other lane (it's an
// account-level signal, not lane-scoped): while Groq is cooling, this lane
// leads with DeepInfra → Gemini instead of trying Groq at all. DeepInfra's
// own attempt timeout is widened past the lane's generic 20s — see
// DEEPINFRA_SWARM_TIMEOUT_MS above for why and the ceiling it pushes against.
function swarmAttempts(): Attempt[] {
  const attempts: Attempt[] = [{ ...TARGETS.deepinfra, timeoutMs: DEEPINFRA_SWARM_TIMEOUT_MS }]
  if (!groqCoolingDown()) {
    attempts.push({ ...TARGETS.groqGptOss20b, penaltyOnRateLimit: true })
  }
  attempts.push({ ...TARGETS.geminiFlash })
  attempts.push({ ...TARGETS.mistral8b })
  attempts.push({ ...TARGETS.cerebrasGptOss120b })
  return attempts
}

// Reasoning-pipeline-only lane, final-composition step ONLY (runFinalComposition,
// orchestrator-global.ts) — packaging the vetted reasoning into the answer the
// admin actually reads, not another reasoning stage. Groq leads here (pinned to
// gpt-oss-20b, same reason as swarmAttempts()); DeepInfra is the first fallback
// rather than the lead, since this step runs once per pipeline run, not ~200
// times — the cost difference between "Groq-first" and "DeepInfra-first" is
// negligible at that volume, so it defers to Groq the way the original spec's
// "Synthesis" tier asked for. Same tail and same penalty-box sharing as
// swarmAttempts().
function synthesisAttempts(): Attempt[] {
  const attempts: Attempt[] = []
  if (!groqCoolingDown()) {
    attempts.push({ ...TARGETS.groqGptOss20b, penaltyOnRateLimit: true })
  }
  attempts.push({ ...TARGETS.deepinfra })
  attempts.push({ ...TARGETS.geminiFlash })
  attempts.push({ ...TARGETS.mistral8b })
  attempts.push({ ...TARGETS.cerebrasGptOss120b })
  return attempts
}

// Built fresh per request so it reflects current penalty-box / recovery state.
export function attemptsForRole(role: AiRole): Attempt[] {
  if (role === 'drafter') return draftAttempts()
  if (role === 'suggestor') return suggestorAttempts()
  if (role === 'swarm') return swarmAttempts()
  if (role === 'synthesis') return synthesisAttempts()
  return realtimeAttempts() // coach | critic
}
