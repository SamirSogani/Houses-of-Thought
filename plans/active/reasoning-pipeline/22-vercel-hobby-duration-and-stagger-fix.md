# 22 — Root cause: "consistently stops on perspectives-generate or global-assumptions"

**Date:** 2026-08-12 · Branch: `reasoning-pipeline-deepinfra-tuning`, same
session as [20](20-deepinfra-tuning-real-verification.md)'s DeepInfra-only
pinning. Samir reported the pipeline consistently stopping on **real Vercel
Hobby traffic** (not just local dev) at either `perspectives-generate-details`
or `global-assumptions-generate`, and asked for the root cause — explicitly
staying on Hobby, not upgrading.

## Root cause 1 (primary, deterministic) — the stagger schedule

`perspectives-generate-details`'s 4n sub-element calls were staggered by
`(i*4+j) * DRAFTER_STAGGER_MS` (20s, up to 4x under detected stress) — sized
to protect Groq's account-level TPM ceiling, back when these calls rode the
`drafter` role. At n=2 that schedules 8 calls from 0s to **140s** — comfortably
past the route's own `maxDuration` even before any stress multiplier, so
every n=2 run was guaranteed to schedule calls past the ceiling by
construction, independent of DeepInfra's actual reliability. This constraint
stopped applying the moment Groq left the swarm chain entirely (doc 20's own
addendum, same session) — DeepInfra is a paid account with no such
per-request ceiling — but the stagger itself was never revisited until now.

## Root cause 2 (compounding) — a self-imposed duration ceiling

`maxDuration = 60` (route.ts) was assumed to be close to Hobby's real limit
("Vercel Hobby plan — needs Fluid Compute enabled to actually honor 60s;
unverified from this codebase" — the route's own prior comment). Checked
Vercel's current docs rather than carry that assumption forward: **Hobby +
Fluid Compute supports up to 300s**, and Fluid Compute has been on by default
for all new projects since April 23, 2025 — this project's first commit is
2026-06-28, well after that cutoff. Function-code `maxDuration` always
overrides the Fluid default (Vercel's own settings-precedence order), so the
code's own 60s was the actual binding constraint the whole time, not
something Hobby required. **Confirmed live in the Vercel dashboard: Fluid
Compute is enabled on this project.**

## Fixes, both Hobby-compatible, no plan upgrade

1. **`orchestrator-perspectives.ts`** — retired `DRAFTER_STAGGER_MS`,
   `effectiveStaggerMs()`, and the `drafterLaneStress()` import entirely (that
   lane-stress signal was already flagged in-code as an inaccurate proxy for
   swarm, and is now fully unused in this file — every call here is `swarm`,
   never `drafter`). Replaced with `SWARM_STAGGER_MS = 150`, matching
   `runReviewPanel`'s existing `REVIEWER_STAGGER_MS` pattern: small and fixed,
   purely to avoid firing every call in the same instant, not to throttle a
   rate limit that no longer exists in this lane. `drafterLaneStress()`
   itself, and its OTHER call site (route.ts's `clampNForStress`, capping `n`
   under real drafter-lane pressure) are untouched — out of scope here.
2. **Duration budget, kept in lockstep per the existing convention:**
   - `maxDuration`: 60 → **280** (route.ts)
   - `CHAIN_DEADLINE_MS.swarm`/`.synthesis`: 55s → **260s** (router.ts)
   - `DEEPINFRA_SWARM_TIMEOUT_MS`: 45s → **60s** (router-lanes.ts)
   - `DEEPINFRA_SWARM_LARGE_TIMEOUT_MS`: 50s → **75s** (router-lanes.ts)

   280 leaves ~20s under Hobby's real 300s ceiling for Vercel's own
   per-invocation overhead; 260s leaves ~20s under that. The two DeepInfra
   timeouts are modest, real increases over previously-observed latency
   (worst single-call success ~18s) rather than a blind blow-up to the new
   ceiling — a genuinely hung request still fails with reasonably prompt
   feedback instead of hanging for minutes. 75s × up to 3
   `generateWithOptionalSearch` rounds = 225s, comfortably inside the new
   260s chain deadline (the old 50s × up to 3 rounds = 150s already exceeded
   the old 55s TOTAL chain deadline by construction — this is the same class
   of bug as root cause 1, just on the evidence steps' internal search-round
   chain instead of perspectives-generate-details' external call schedule).

## Real-verification

One real (non-dry-run) n=2 run against `/admin/reasoning`, local dev (Vercel's
own platform-level `maxDuration` kill can't be exercised outside a real
deployment — see caveat below):

- **`perspectives-generate-details` (first pass) completed in 49s** —
  previously structurally guaranteed to exceed 140s. Direct, conclusive
  confirmation the stagger fix works: the step now actually finishes instead
  of being scheduled past any ceiling by construction.
- Both perspective bundles failed review (6/9, 7/9 — a normal content-quality
  gate, unrelated to this fix) and entered repair mode, exercising
  `DEEPINFRA_SWARM_LARGE_TIMEOUT_MS`'s new 75s ceiling directly — observed
  timeouts landed at ~72-74s (previously would have hit the old 45-50s wall
  far earlier, and cascaded nowhere since there's no fallback). One retry got
  a genuine full second attempt at `completeJSON`'s own parse-retry (2.0min
  total — both the first call and the retry each running close to their own
  ~75s share) instead of being starved by the old 55s TOTAL chain deadline —
  the extended `CHAIN_DEADLINE_MS` giving real, working headroom where it
  previously gave almost none.
- Target Health: **100 OK / 10 FAIL, all on `deepinfra`** across the whole
  run — every other provider stayed 0/0, confirming the DeepInfra-only
  pinning (doc 20's addendum) still holds under the new timing.

**New finding, not fixed here:** across 3 repair-mode attempts on the same
bundle, DeepInfra failed by 3 different mechanisms — a plain timeout, an
empty completion (`finishReason: "length"` on `perspective_counterargument`,
the same class of bug doc 20's fix #1 already covers but recurring even with
`REPAIR_TOKEN_HEADROOM` applied), and truncated/invalid JSON on
`perspective_evidence` (cut off mid-string on both the first attempt AND
completeJSON's own parse-retry). This is DeepInfra/gpt-oss-20b's own
real-world repair-mode variability under the no-fallback posture — exactly
the accepted trade-off from doc 20's addendum, not a regression from today's
fix. Since `perspectives-review` is the one `degrade`-on-exhaustion gate (not
hard-block), a bundle this stubborn should eventually degrade and let the run
continue rather than halt outright — not independently confirmed this
session (would have meant a 4th+ retry past what real-cost discipline
justified for one investigation).

## Caveat — what local dev can't prove

`next dev` doesn't enforce Vercel's platform-level `maxDuration` kill at
all — that's deployment-only. Local real-verification proves the stagger fix
(root cause 1, deterministic, doesn't depend on the platform) and that the
new timeout/deadline numbers are correctly wired and taking effect. It
cannot prove root cause 2's fix (raising `maxDuration` to 280) actually
avoids a real Vercel hard-kill in production — that requires a real deployed
run. Samir confirmed Fluid Compute is enabled on the project; the next real
deploy is the actual test of whether 280s is honored as configured.
