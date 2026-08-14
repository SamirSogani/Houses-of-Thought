# 25 — Concurrent load test, and the deploy plan for the persistence fix it validates

**Date:** 2026-08-14. Full load-test data:
[model-evaluation/concurrency.md](model-evaluation/concurrency.md) — this
doc is the fix plan only; read that one first for what was actually found.

## The one-line version

Two persistence fixes already exist in the working tree
(`app/api/admin/reasoning/route.ts`, uncommitted) — a generic catch-all that
now records `haltReason` on any unhandled failure, and a switch from bare
`void persistRunStep(...)` to `next/server`'s `after()` so the write can't
lose its race against Vercel freezing the function post-response. A 9-way
concurrent real-run test against production (still running the *old*,
unpatched code) just measured a **33% silent-completion-loss rate** —
3 of 9 runs genuinely finished but the DB never recorded it. This doc plans
getting the fix live and proving it actually closes that gap, without
conflating it with the separate, riskier model swap sitting in the same
working tree.

## Why this needs its own plan, not just "deploy it"

**The persistence fix and the DeepSeek-V4-Flash-0731 model swap are two
independent changes that happen to be uncommitted at the same time** — one
in `app/api/admin/reasoning/route.ts`, one in `lib/ai/router-config.ts`.
Shipping them together would conflate two variables: if a post-deploy
re-test still shows problems, there'd be no way to tell whether it's the
persistence fix not working or the new model misbehaving under load (it has
zero concurrent-load data on it at all — see
[model-evaluation/reliability.md](model-evaluation/reliability.md)'s known
hidden-reasoning-channel risk, still unconfirmed either way). **Recommendation:
split them into two commits/branches, ship and verify persistence first.**

## Step 1 — Split the working tree

```bash
git diff --stat
#  app/api/admin/reasoning/route.ts | 52 +++++++++++++++++++++-----
#  lib/ai/router-config.ts          | 74 ++++++++++++++++++++++++++++-
```
Stage and commit only `app/api/admin/reasoning/route.ts` on a new branch
(not `main` — per this repo's CLAUDE.md). `lib/ai/router-config.ts`'s model
swap stays uncommitted/stashed until its own plan.

```bash
git checkout -b fix/reasoning-persistence-race
git add app/api/admin/reasoning/route.ts
git commit -m "Fix reasoning pipeline persistence: catch-all now records \
haltReason; persist() uses after() instead of fire-and-forget"
```

## Step 2 — Push and open a PR

No `gh` CLI on this machine (dev-machine-tooling memory) and the repo is
private — push the branch, then open the PR from an authenticated browser
(github.com/SamirSogani/houses-of-thought) rather than via CLI:

```bash
git push -u origin fix/reasoning-persistence-race
```

Vercel's GitHub integration should auto-build a preview deployment on push
— worth confirming that's still configured before assuming it (haven't
verified this session).

## Step 3 — Pre-merge check on the preview deployment

Before merging to `main` (which presumably auto-deploys to production —
also unverified this session, worth confirming), sanity-check on the
preview URL:
- One real (non-dry-run) n=2 run completes cleanly and the Past Runs
  record shows `status: "done"` with a populated `finalAnswer` — the basic
  regression check the local dev test earlier this session already covered
  once, but preview deployments run under real Vercel serverless
  conditions (local dev can't reproduce the freeze-after-response behavior
  the bug depends on), so this is the first environment that can actually
  exercise the fix properly.
- Watch Vercel's function logs for the route's actual duration. `after()`
  callbacks share the route's `maxDuration=280s` budget
  ([route.ts](../../../app/api/admin/reasoning/route.ts)'s own comment) —
  `persistRunStep` is one small Supabase upsert, should cost low
  hundreds-of-ms, but this has never been directly measured, only assumed
  cheap.

## Step 4 — Merge, deploy, then re-run the exact load test

Once live on production, **repeat the same shape of test**
([model-evaluation/concurrency.md](model-evaluation/concurrency.md)'s
setup — as many concurrent tabs as the Browser pane allows, n=2, real
questions) and compare directly:

| Metric | Pre-fix (this session) | Post-fix target |
|---|---|---|
| Runs that complete but show `status: "running"` forever | 3/9 (33%) | 0/9 |
| Runs with a `haltReason` on any hard failure | Not tested (none hit the generic catch-all this run — the one halt was a proper `halted()` call, which already persisted correctly) | 100% of failures |

If the post-fix rate isn't ~0%, the `after()` mechanism itself needs
re-examination (e.g., confirm Vercel's Fluid Compute — already confirmed
enabled on this project, see
[22-vercel-hobby-duration-and-stagger-fix.md](22-vercel-hobby-duration-and-stagger-fix.md)
— genuinely honors `after()`'s extended-lifetime contract under concurrent
load, not just single-request load).

## Step 5 — Only then: the model swap, on its own plan

DeepSeek-V4-Flash-0731 stays local/uncommitted until this lands. Once
persistence is verified fixed, the model swap gets its own branch, its own
PR, and — given it has zero concurrent-load data and an explicitly
flagged, unconfirmed hidden-reasoning-channel risk
([model-evaluation/providers/deepinfra.md](model-evaluation/providers/deepinfra.md))
— its own concurrent real-run verification before being trusted, not
inherited from this one.

## Explicitly out of scope for this fix

[model-evaluation/concurrency.md](model-evaluation/concurrency.md)'s other
two findings aren't addressed here:
- **Finding 2** (the school-homework question hard-halting 8/9 standards
  failing) — a content-quality question, not a persistence one. No fix
  planned; flagged as worth watching on the next real run of that specific
  question.
- **Finding 3** (every run needing manual clarification-pause
  intervention) — a real UX/product question (should concurrent admin
  runs auto-skip clarification, or is the pause-and-wait the right
  design?), not a bug. Samir's call if/when it matters.

## Not done yet

Nothing in this doc has been executed — no branch created, no commit made,
no push. Waiting on Samir to confirm before touching git, per this repo's
own "commit or push only when asked" rule.
