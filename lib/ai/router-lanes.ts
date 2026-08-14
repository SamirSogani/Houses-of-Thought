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
// pipeline's app/api/admin/reasoning/route.ts, serving swarm/synthesis: 280s
// as of 2026-08-12 — see CHAIN_DEADLINE_MS, router.ts, for how these two
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
// Only DeepInfra gets this — Groq/Gemini/Mistral/Cerebras aren't in this
// lane's chain at all anymore (2026-08-12 pinning, see swarmAttempts()).
//
// 45s → 60s (2026-08-12, Samir, root-causing "the pipeline consistently
// stops on perspectives-generate or global-assumptions" on real Vercel
// Hobby traffic): CORRECTION to the assumption below this constant carried
// until today — the route's maxDuration was NOT actually capped at ~60s by
// the Hobby plan itself; that was this codebase's own self-imposed number.
// CONFIRMED live in the Vercel dashboard: Fluid Compute is enabled on this
// Hobby project, which raises the real ceiling to 300s (Vercel's own
// function-duration docs). The route's maxDuration is now 280s and
// CHAIN_DEADLINE_MS.swarm/.synthesis (router.ts) 260s — DeepInfra is now the
// ONLY attempt in this lane (no fallback since the same session's pinning),
// so its own timeout can safely use most of that shared budget without
// starving anything else. 60s is a modest, real increase over the
// previously-observed ~18s-worst-case single-call latency, not a blind
// blow-up to the new ceiling — a genuinely hung request should still fail
// with reasonably prompt, actionable feedback rather than hanging for
// minutes. Full real-verified diagnosis:
// plans/active/reasoning-pipeline/20-deepinfra-tuning-real-verification.md's
// addendum. Raise further only alongside the route's maxDuration and
// CHAIN_DEADLINE_MS[swarm], kept in lockstep so this never promises more
// than the route can honor.
// TEMP diagnostic bump, 2026-08-13: real local traffic against the new
// DeepSeek-V3 default (router-config.ts) showed EVERY perspectives-generate-
// details call — a 671B-param model, no hidden reasoning channel but a much
// bigger one than gpt-oss-20b's 20B — timing out at the old 60s ceiling,
// every single attempt, not intermittently. 60s was tuned for gpt-oss-20b's
// specific latency profile; this value is deliberately generous (not a
// measured right-size yet) so one real run can show the actual completion
// time before this gets tuned properly. Still self-limiting regardless of
// this number — execute()'s Math.min(attempt.timeoutMs, deadlineAt -
// Date.now()) (router.ts) clamps any single attempt to whatever's left of
// CHAIN_DEADLINE_MS.swarm (260s), so this can't blow the route's budget on
// its own even set this high.
const DEEPINFRA_SWARM_TIMEOUT_MS = 200_000

// Repair/high-reasoning-effort calls (allowHighReasoning, router-shared.ts)
// only, in swarm/synthesis — 2026-08-12, Samir: real traffic showed EVERY
// repair-mode call that reached Groq failed there (413/429 TPM ceiling once
// REPAIR_TOKEN_HEADROOM (lib/ai/reasoning/budget.ts) pushed a single
// request's size past Groq's 8000 TPM cap, or a json_validate_failed on the
// requests just under that line) — not one succeeded across the whole
// session, so swarmAttempts()/synthesisAttempts() skip Groq entirely here,
// and DeepInfra's own attempt gets the time that would have gone to a doomed
// Groq call instead.
//
// 50s → 75s (2026-08-12, same session as DEEPINFRA_SWARM_TIMEOUT_MS's 45→60
// widen above — see that comment for the corrected Hobby/Fluid-Compute
// ceiling this is now measured against). Repair-mode calls carry
// REPAIR_TOKEN_HEADROOM (budget.ts) on top of their first-pass maxTokens and
// run at 'high' reasoning effort — genuinely slower than a first-pass call by
// construction, hence the extra margin over the 60s sibling above. This is
// also the per-round budget generateWithOptionalSearch (search.ts) uses for
// perspective_evidence/global_evidence's search rounds when repairing — up
// to 3 rounds sharing ONE CHAIN_DEADLINE_MS=260s, so 75s/round comfortably
// fits 3 rounds (225s) with real margin, unlike the old 50s/round against a
// 55s TOTAL chain deadline that could only ever fit one round.
const DEEPINFRA_SWARM_LARGE_TIMEOUT_MS = 75_000

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
// DELIBERATE, TEMPORARY, DeepInfra-only — no fallback (2026-08-12, Samir,
// verbatim: "it should always be using deep infra (no matter what for
// now)"). Groq/Gemini/Mistral/Cerebras removed from this lane entirely, not
// just reordered. Two reasons, both Samir's:
//   (a) A clean read on DeepInfra's real success rate on THIS traffic (9
//       parallel review-panel calls per gate × 6 gates, plus every generate
//       step) without another provider's failures confounding the signal —
//       decision 020's ~85% (59/10) OK/FAIL figure was measured on the
//       realtime lane, not this one, and doc 20's fix #3 already found Groq
//       structurally can't serve this lane's repair-mode calls at all.
//   (b) DeepInfra is a paid account with no hard per-request rate ceiling
//       the way Groq's on-demand tier has (the exact thing that made fix #3
//       necessary) — most of what a fallback chain exists to protect
//       against (a free-tier 429/cooldown) doesn't apply here by
//       construction, so the chain was buying less than it looks like for
//       this specific lane.
// This is a KNOWN, INTENTIONAL reduction in resilience, not an oversight: a
// genuine DeepInfra outage now fails every swarm call outright instead of
// failing over to Gemini/Mistral/Cerebras. Revisit once real DeepInfra-only
// traffic answers (a) — this is a posture for now, not a permanent
// architecture decision. suggestor/coach/critic/drafter are untouched; this
// scoping is swarm/synthesis only, same as everything else in this lane.
// NOT "one shot at DeepInfra, then fail" though — see
// DEEPINFRA_SAME_TARGET_ATTEMPTS below: real production traffic showed
// DeepInfra's own failures here are intermittent, so the lane retries the
// SAME target a few times before giving up. Zero other providers involved —
// still fully within "no matter what."
//
// isGroqTokenLimitExceeded()/isGroqJsonValidateFailed()/groqCoolingDown()
// (router-shared.ts / router-state.ts) are now unused BY THIS LANE
// specifically — left alone, the other four lanes above still call them.
//
// DeepInfra's own attempt timeout keeps the first-pass/repair-mode split —
// DEEPINFRA_SWARM_TIMEOUT_MS / DEEPINFRA_SWARM_LARGE_TIMEOUT_MS above — that
// distinction is about gpt-oss-20b's own latency profile under
// allowHighReasoning, orthogonal to which (or how many) providers are in the
// chain, so it survives this change untouched.
//
// Listed DEEPINFRA_SAME_TARGET_ATTEMPTS times, not once (2026-08-12, Samir,
// real-verified in production the same day): a real n=2 run against
// houses-of-thought.vercel.app failed repeatedly at perspectives-generate/
// global-assumptions, both `ai-empty-output` (finishReason "stop", zero
// content) and plain SDK-level timeouts at the full DEEPINFRA_SWARM_TIMEOUT_MS
// window — on ordinary first-pass/medium-effort calls, not just repair-mode.
// Checked DeepInfra's own dashboard for that exact window: the requests were
// RECEIVED and BILLED, no rate-limit flagged on the account. That rules out a
// network/transit failure or a 429 — this is gpt-oss-20b's own reasoning-
// token behavior (the same mechanism doc 20's fix #1 already named)
// occasionally either running past the timeout or finishing with nothing in
// the visible-answer channel, and it's INTERMITTENT — 3 real attempts on one
// step that session: 2 failed, 1 succeeded outright, no code changed between
// them. `execute()` (router.ts) already cascades through a role's attempt
// list on exactly these error classes (timeout, ai-empty-output, 5xx) — no
// new mechanism needed, just more attempts at the SAME target, so a
// transient failure gets another real shot at DeepInfra specifically before
// the step actually fails. Still zero other providers in this lane — Samir's
// "no matter what" instruction stands; this is a retry, not a fallback.
// `execute()`'s own shared CHAIN_DEADLINE_MS/deadlineAt check already caps
// how many of these attempts actually get tried if time runs out, so this
// can't blow the route's budget even in the worst case (3 × 75s repair-mode
// = 225s, still under CHAIN_DEADLINE_MS.swarm's 260s with real margin). Full
// diagnosis: plans/active/reasoning-pipeline/20-deepinfra-tuning-real-verification.md's
// addendum.
const DEEPINFRA_SAME_TARGET_ATTEMPTS = 3

function swarmAttempts(allowHighReasoning: boolean): Attempt[] {
  const timeoutMs = allowHighReasoning ? DEEPINFRA_SWARM_LARGE_TIMEOUT_MS : DEEPINFRA_SWARM_TIMEOUT_MS
  return Array.from({ length: DEEPINFRA_SAME_TARGET_ATTEMPTS }, () => ({ ...TARGETS.deepinfra, timeoutMs }))
}

// Reasoning-pipeline-only lane, final-composition step ONLY (runFinalComposition,
// orchestrator-global.ts) — packaging the vetted reasoning into the answer the
// admin actually reads, not another reasoning stage.
//
// DELIBERATE, TEMPORARY, DeepInfra-only — same posture and same reasoning as
// swarmAttempts() immediately above (Samir, 2026-08-12); see that comment for
// the full rationale. Groq no longer leads here (it used to, pinned to
// gpt-oss-20b) and Gemini/Mistral/Cerebras no longer close out the chain —
// removed, not reordered. No call site sets allowHighReasoning for this role
// today (runFinalComposition has no repair path — packaging only), but the
// switch is threaded through anyway for consistency if that ever changes, and
// it now ALSO applies DEEPINFRA_SWARM_TIMEOUT_MS to the first-pass case
// (previously only the repair-mode branch got a DeepInfra-specific timeout
// here — the plain first-pass attempt fell through to
// ATTEMPT_TIMEOUT_MS.synthesis's 8s, sized for Groq's speed, not gpt-oss-20b's
// hidden-reasoning-token latency on DeepInfra. Harmless while DeepInfra was
// only ever synthesis's fallback; live-broken now that it is the only
// attempt — real-verified during this change, see doc 20's addendum).
//
// Listed DEEPINFRA_SAME_TARGET_ATTEMPTS times, same reasoning and same day as
// swarmAttempts() above — see that comment for the full real-verified
// diagnosis (received + billed + no rate limit on DeepInfra's own dashboard,
// intermittent model-behavior failures, not a network/infra problem).
function synthesisAttempts(allowHighReasoning: boolean): Attempt[] {
  const timeoutMs = allowHighReasoning ? DEEPINFRA_SWARM_LARGE_TIMEOUT_MS : DEEPINFRA_SWARM_TIMEOUT_MS
  return Array.from({ length: DEEPINFRA_SAME_TARGET_ATTEMPTS }, () => ({ ...TARGETS.deepinfra, timeoutMs }))
}

// Built fresh per request so it reflects current penalty-box / recovery state.
// allowHighReasoning only changes anything for swarm/synthesis (see
// DEEPINFRA_SWARM_LARGE_TIMEOUT_MS above) — every other role ignores it.
export function attemptsForRole(role: AiRole, allowHighReasoning = false): Attempt[] {
  if (role === 'drafter') return draftAttempts()
  if (role === 'suggestor') return suggestorAttempts()
  if (role === 'swarm') return swarmAttempts(allowHighReasoning)
  if (role === 'synthesis') return synthesisAttempts(allowHighReasoning)
  return realtimeAttempts() // coach | critic
}
