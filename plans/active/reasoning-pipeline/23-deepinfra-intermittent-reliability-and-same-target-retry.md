# 23 — DeepInfra's own intermittent reliability: production investigation and same-target retry

**Date:** 2026-08-12/13 · Branch: `reasoning-pipeline-deepinfra-tuning`, same
session as [20](20-deepinfra-tuning-real-verification.md) (DeepInfra-only
pinning) and [22](22-vercel-hobby-duration-and-stagger-fix.md) (stagger/
duration fix). After 22 shipped, Samir reported the deployed pipeline still
failing consistently at `perspectives-generate`/`global-assumptions` — this
doc is that investigation and its fix.

## False leads, ruled out with real evidence

- **Missing API key.** First hypothesis for an instant "AI seems disabled"
  failure — turned out to be real (unrelated to this session's other work)
  but already fixed by the time this investigation started.
- **A rate limit.** Doc 20's addendum already accepted this as a real risk of
  going DeepInfra-only, but the client-visible symptom ("Could not reach a
  stage of the pipeline") can't actually distinguish a 429 from anything else
  — traced this to a real, separate UI bug: `ReasoningPipelinePage.tsx`
  compares against `RATE_LIMITED_CODE` from `lib/ai/findings.ts` (`'rate-limited'`,
  a *different* feature's daily-quota code), not this route's actual
  `'ai-rate-limited'` message — so a genuine 429 here has always rendered as
  the same generic text. Confirmed not the cause anyway: never once saw an
  actual 429 in any real test, and [DeepInfra's status page](https://status.deepinfra.com/)
  showed no incident.
- **Vercel's `maxDuration=280` not being honored.** Ruled out once real logs
  were captured (below) — every failure was well under 280s.
- **Silent failure, DeepInfra never contacted.** Samir's own hypothesis when
  Vercel's Function Logs first showed nothing for a failing request. Traced
  the code: `ai-empty-output` can ONLY be produced by one line
  ([router.ts:407-419](../../../lib/ai/router.ts#L407-L419)), immediately
  preceded by an unconditional, synchronous `log.error(...)` — the response
  body itself proves that exact code ran, which proves the log line fired.
  **Real cause of "nothing in the logs": Vercel Hobby's runtime log retention
  is 1 hour** ([Vercel docs](https://vercel.com/docs/logs); Pro gets 1 day,
  Enterprise 3 — 30-day retention needs Observability Plus, a Pro/Enterprise-
  only add-on; log drains also need Pro/Enterprise). By the time Samir
  searched, the window had already expired. A fresh test, checked within the
  hour, surfaced the real log lines immediately.

## What the real logs actually showed

Three failures on `perspective_evidence` within one production run, all
`effort: "medium"` — **first-pass, not repair-mode**:
```
"msg":"upstream call failed", ... "detail":"Request timed out.   "
"msg":"upstream empty output", ... "finishReason":"stop"
"msg":"upstream call failed", ... "detail":"Request timed out.   "
```
This is a materially different (and worse) finding than doc 20's original
one: that was specifically about *repair-mode* (`'high'` effort +
`REPAIR_TOKEN_HEADROOM`) calls exhausting their token budget on hidden
reasoning tokens (`finishReason: "length"`). This is an ordinary,
`'medium'`-effort, 2400-token first-pass call — either timing out at the full
60s client-side window, or completing (`finishReason: "stop"`, not `"length"`
— not truncated) with genuinely nothing in the visible-answer channel. A
separate production run also failed the same way on `global_assumptions_packet`
— a *plain* `completeJSON` call, 900 tokens, no search rounds, nothing
complex. Small, simple, first-pass calls are failing too, not just the hard
ones.

## DeepInfra's own dashboard, checked for the exact failure window

Samir checked directly: the requests were **received**, **billed**, and
**no rate limit was flagged** on the account. That rules out a network/transit
failure and rules out DeepInfra throttling the account — the request/response
cycle completed successfully at the infrastructure level. The failure is
`gpt-oss-20b`'s own behavior under `reasoning_effort` (the same mechanism
doc 20's fix #1 already named) — sometimes the hidden reasoning phase runs
long enough to blow the 60s window; sometimes it apparently finishes and
still doesn't surface anything in the visible `content` field. Neither is an
outage or a bug in DeepInfra's infrastructure — it's model behavior, and
it's **intermittent**: 3 real attempts at this exact step in one production
session — 2 failed, 1 succeeded outright, no code changed in between.

## Fix: retry the same target, not a different one

Intermittent failure is exactly what a retry recovers from — but Samir's
"DeepInfra, no matter what" instruction (doc 20's addendum) is still in
force, so the fix is **not** a different provider. `swarmAttempts()`/
`synthesisAttempts()` ([router-lanes.ts](../../../lib/ai/router-lanes.ts))
now list `TARGETS.deepinfra` `DEEPINFRA_SAME_TARGET_ATTEMPTS` (3) times
instead of once. `execute()`'s existing cascade logic (router.ts) already
walks an attempt list on exactly the error classes seen here (timeout,
`ai-empty-output`, 5xx) — no new mechanism needed, just more entries in the
list. Still zero other providers. The shared `CHAIN_DEADLINE_MS`/`deadlineAt`
check already caps how many attempts actually run if time is short, so this
can't blow the route's budget even worst-case (3 × 75s repair-mode = 225s,
under `CHAIN_DEADLINE_MS.swarm`'s 260s with margin).

## Verification

`router.test.ts`: two new deterministic cases per lane — recovers after one
transient failure (`['deepinfra', 'deepinfra']`), and exhausts all 3 before
failing with no other provider ever called
(`['deepinfra', 'deepinfra', 'deepinfra']`) — plus the existing single-call
success/penalty-box cases, all still passing. `npx tsc --noEmit`, `npx eslint .`,
`npx vitest run` clean (97/97).

Real end-to-end re-verification against production, given the failure is
probabilistic, needs multiple real runs post-deploy to see a rate shift, not
just one — noted here as a follow-up rather than done in this session, to
keep real API cost proportionate to what a single fix-confirmation needs.
