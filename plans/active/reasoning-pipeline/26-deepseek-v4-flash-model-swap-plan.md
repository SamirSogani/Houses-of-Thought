# 26 — DeepSeek-V4-Flash-0731 model swap: verification and deploy plan

**Date:** 2026-08-14, later the same day as
[doc 25](25-concurrent-load-test-and-persistence-fix-plan.md) (the
persistence fix this plan was deliberately split from — now merged and
verified, see that doc's "What actually happened" section). Background:
[model-evaluation/providers/deepinfra.md](model-evaluation/providers/deepinfra.md)'s
swap #6 entry, [model-evaluation/reliability.md](model-evaluation/reliability.md)'s
matrix and Qwen caveat.

## The one-line version

`lib/ai/router-config.ts` has an uncommitted swap of
`TARGETS.deepinfra.model` from `Qwen/Qwen3-235B-A22B-Instruct-2507` to
`deepseek-ai/DeepSeek-V4-Flash-0731` — real-verified once, locally, clean
(22/22 real calls, zero regenerations, zero `ai-empty-output`). It has
**zero concurrent-load data** and a **known, flagged-before-testing risk**:
unlike DeepSeek-V3 and Qwen (both chosen specifically for having no hidden
reasoning channel), V4-Flash's own model page documents a `reasoning_effort`
param and `reasoning_content` field — the same *shape* of mechanism that
caused `gpt-oss-20b`'s 5-consecutive-real-failure incident that started this
project's whole multi-model saga. This plan gets it real-verified under
real concurrent load before it's trusted as the default, the same discipline
doc 25 just applied to the persistence fix.

## Why this needs its own plan, not just "ship it"

Two reasons, both already named in doc 25 when this swap was deliberately
left uncommitted:

1. **It's an independent variable.** Shipping it alongside another change
   would conflate two things if something later looks wrong — no longer a
   risk now that persistence shipped separately and cleanly, but the
   principle still applies to whatever ships next after this.
2. **It has a real, named, unconfirmed risk that only concurrent real load
   can test.** The one existing real-verification run (2026-08-14, local
   dev, one full 22-step pass) didn't trigger the hidden-reasoning-channel
   failure — but per
   [reliability.md](model-evaluation/reliability.md)'s caveat (Qwen passed
   its own clean real-verification run, then failed in production traffic
   the very next day), **one clean run is not proof of reliability**,
   especially for a risk that's explicitly about a hidden internal phase
   that "sometimes never hands off to the visible answer" under load.

## Current state

- `lib/ai/router-config.ts`: uncommitted swap, `git diff` shows the model
  id change plus extensive comment history (context window, pricing,
  `supportsJsonSchema()` status — still unconfirmed, runs on the
  `json_object` fallback same as every model except DeepSeek-V3 — and the
  risk flag above). Not yet exercised on deployed Vercel traffic at all.
- `.claude/launch.json`: also has an uncommitted addition — a
  `deepinfra-tuning-dev` launch entry pointing at
  `/Users/samir/code/hot-deepinfra-tuning-worktree`, an absolute path
  specific to this machine. **Separate concern, not part of this swap** —
  flagged below, not folded into the steps.

## What this plan is actually trying to learn

Two open questions, neither answered yet:

1. **Does the hidden reasoning channel cause gpt-oss-20b-style
   empty-output failures under real concurrent production load?** Zero
   data either way today.
2. **Is it otherwise fast/reliable/cheap enough to keep as the default
   over Qwen** — which itself only has one clean run plus one real
   production failure on record, so this isn't "beat a proven baseline,"
   it's "compare two thinly-verified models under the same real load."

## Step 1 — Split, commit

```bash
git checkout -b model-swap-deepseek-v4-flash
git add lib/ai/router-config.ts
git commit -m "Swap DeepInfra swarm/synthesis default to DeepSeek-V4-Flash-0731"
```

Leave `.claude/launch.json` out of this commit (see "Also uncommitted"
below) unless Samir says otherwise.

## Step 2 — Push and open a PR

```bash
git push -u origin model-swap-deepseek-v4-flash
```

Repo is public — the PR can be read via the GitHub API with no `gh` CLI
and no authenticated browser session, same as PR #4.

## Step 3 — Pre-merge check, revised for this session's lesson

Doc 25's Step 3 assumed the PR's Vercel preview URL would be reachable; it
wasn't — account-level Deployment Protection gated it with no bypass token
available, and Samir approved skipping straight to a production check
instead. **Don't repeat that assumption here** — before relying on the
preview URL, either confirm a Protection Bypass token is available, or plan
from the start to do the first regression check directly on production
(one real n=2 run, `status: "done"` with a populated `finalAnswer`) rather
than discovering the same blocker mid-flight.

## Step 4 — Merge, deploy, then a concurrent load test aimed at the real open question

Once live, run the same shape of test as doc 25's (up to 9 tabs, n=2, real
questions — reusing the same 9 questions keeps it comparable) — but this
time the primary signal isn't persistence (already verified fixed and
model-agnostic), it's **the hidden-reasoning-channel risk**. Specifically
watch for, per question/run:

- `ai-empty-output` — content came back empty despite a 200. gpt-oss-20b's
  exact signature failure.
- `finishReason: "length"` on any repair-mode call — hidden reasoning
  tokens consuming the whole budget before visible JSON.
- Wall-clock time per run, compared against both baselines already on
  record: DeepSeek-V4-Flash's own uncontended solo run (~4m6s) and Qwen's
  9-way concurrent numbers (roughly 2-4x its solo time, several needing
  internal retries) — a useful three-way comparison point, not just
  pass/fail.

## Step 5 — Compare and decide

Update [reliability.md](model-evaluation/reliability.md)'s matrix and
[providers/deepinfra.md](model-evaluation/providers/deepinfra.md)'s swap
history with the concurrent-load results, same as doc 25 did for
persistence. Rollback is cheap regardless of outcome — `DEEPINFRA_MODEL`
env var reverts to Qwen without a code deploy (per
`router-config.ts`'s own comment on the deployed override).

## Also uncommitted, not part of this swap — resolved

`.claude/launch.json`'s `deepinfra-tuning-dev` entry (hardcoded to
`/Users/samir/code/hot-deepinfra-tuning-worktree`) was moved to a new
`.claude/launch.local.json`, gitignored, same pattern as
`settings.local.json`. `launch.json` itself is back to its original
committed state. **Caveat:** `preview_start` (the tool used to launch dev
servers) only reads `.claude/launch.json` by name — `launch.local.json` is
not auto-discovered by it, so this entry is inert for that tool unless its
contents get merged back in manually when needed.

## Methodology note — real runs must answer clarification questions, not skip them

Established 2026-08-14/15, this test: when a real (non-dry-run) pipeline
run pauses on `needs_user_input` evidence-gathering clarification, the
operator must **type real answers into the form and click "Submit
answers,"** not click "Skip." Doc 25's load tests all used Skip, which
routes the pipeline down a generic/unclarified evidence-gathering path;
answering for real exercises the actual intended UX path
(`EvidenceGatherAnswerBox`) and produces more representative evidence and
timing data. Applies to all future real-run testing on this pipeline, not
just this swap.

## What actually happened (2026-08-14/15)

Steps 1–4 executed. Branch `model-swap-deepseek-v4-flash` pushed, PR #5
opened, merged to `main` (commit `aed37c8`), confirmed live on production.
Preview URL was blocked by the same Vercel Deployment Protection wall as
doc 25 (confirmed via `curl -I`, redirected to `vercel.com/sso-api`) — went
straight to production, per plan.

**Concurrent load test (9 tabs, n=2, same 9 questions as doc 25) is
in progress.** Automated form-filling worked for question text, but the
Browser pane's permission classifier explicitly blocked toggling "Dry run"
off via automation — flagged to Samir rather than worked around; Samir did
every real-mode toggle and pipeline-launch click by hand.

**First-pass results, before any retries:**

| Question | Outcome |
|---|---|
| Should our school ban homework? | ✅ Done — clean final answer, 8/9 global-assumptions (tolerated) |
| Should a city require solar panels on all new residential construction? | ❌ Halted — `Builders and developers — assumptions: ai-invalid-output` |
| Should a startup outsource its customer support to a call center? | ❌ Halted — `frame-generate threw: ai-invalid-output` |
| Should public libraries eliminate late fees? | ❌ Halted — "Could not reach a stage of the pipeline," no error tag surfaced in the UI |
| Should a college make standardized testing optional for admissions? | ⏸→▶️ Paused on evidence clarification, answered for real, resumed |
| Should a mid-sized city switch its bus fleet to electric buses? | ⏸→▶️ Paused on evidence clarification, answered for real, resumed |
| Should a hospital adopt a four-day work week for nurses? | ⏸→▶️ Paused on evidence clarification, answered for real, resumed |
| Should a nonprofit accept cryptocurrency donations? | ⏸→▶️ Paused on evidence clarification, answered for real, resumed |
| Should a manufacturing plant switch to a four-day production week? | ⏸→▶️ Paused on evidence clarification, answered for real, resumed |

**3 of 9 (33%) halted on the first pass, 2 of those with an explicit
`ai-invalid-output` tag.** That's not the literal `ai-empty-output`
signature this doc flagged as the risk to watch for, but it's the same
failure family — the model's output didn't parse as valid structured
content under real concurrent load — and it showed up at meaningful
volume. Samir directed continuing rather than stopping: all three halts
were retried via the app's own "Retry" button; final outcome pending.

**A fourth `ai-invalid-output` surfaced after the retries started**, on
the standardized-testing question — and notably at `final-composition`,
the very last of the 22 steps, after every single gate up to that point
passed 9/9 clean (Frame, both Perspectives, Global assumptions, Global
evidence, Conclusions, Implications). The model got the entire reasoning
chain right and then failed to produce valid structured output on the
final synthesis call. Also retried.

## Final results — all 9 runs settled (2026-08-15T00:48 UTC)

**6 of 9 (67%) completed. 3 of 9 (33%) ended in permanent failure**, each
retried twice (the session's agreed cap) with no recovery. Wall-clock is
created→done (or created→last-retry-attempt for the failures):

| Question | Outcome | Wall-clock | Failure detail |
|---|---|---|---|
| Should our school ban homework? | ✅ Done | 4m 36s | — |
| Should a mid-sized city switch its bus fleet to electric buses? | ✅ Done | 20m 27s | — |
| Should a hospital adopt a four-day work week for nurses? | ✅ Done | 20m 29s | — |
| Should a manufacturing plant switch to a four-day production week? | ✅ Done | 20m 40s | — |
| Should a nonprofit accept cryptocurrency donations? | ✅ Done | 20m 57s | — |
| Should a college make standardized testing optional for admissions? | ✅ Done (1 retry) | 21m 15s | 1× `ai-invalid-output` at `final-composition` — the **last** of 22 steps, after every prior gate passed 9/9 |
| Should a city require solar panels on all new residential construction? | ❌ **Final failure** | 38m+ before giving up | 1× explicit `ai-invalid-output` (assumptions step), then 2× silent stall (see below) |
| Should public libraries eliminate late fees? | ❌ **Final failure** | Stuck at ~1m 42s, never progressed across 3 attempts | Silent stall, no `haltReason` ever surfaced |
| Should a startup outsource its customer support to a call center? | ❌ **Final failure** | 46m+ across 3 attempts | 3× explicit `ai-invalid-output` (`frame-generate` once, `global-assumptions-generate` twice) |

## Two distinct failure modes, not one

1. **Explicit `ai-invalid-output` crashes** (solar's 1st halt, standardized
   testing's 1 halt, call center's 3 halts — 5 events total across 3 of 9
   questions). Always at a structured-generation step (`frame-generate`,
   `global-assumptions-generate`, `final-composition`). This is the failure
   family this doc flagged as the open risk before testing — not the exact
   `ai-empty-output` signature named, but the same shape: the model's
   output didn't parse as valid structured content. Consistent with the
   hidden `reasoning_content` channel this doc called out on V4-Flash's own
   model page.
2. **Silent stalls with no `haltReason`** (solar's later attempts, all 3 of
   library's attempts) — the client UI shows "Could not reach a stage of
   the pipeline," but the API's `status` stays `"running"` with
   `haltReason: null`, and `lastStep`/`updatedAt` don't move at all across
   retries — library's run never got past `perspectives-evidence-confidence`
   in 3 attempts spanning the whole test. **Not one of the signals this doc
   named to watch for** — a new, separate observation worth its own
   investigation if this model (or this failure shape generally) comes up
   again. Could be a genuine server-side hang the retry button can't fix,
   or a client-stream issue; the two are hard to tell apart from the UI
   alone.

## Decision

**33% permanent failure rate under real 9-way concurrent load, split
across two distinct failure modes, one of them exactly the risk this doc
existed to test.** This is not a one-off — it recurred on retry for 2 of
the 3 failing questions. Recommend **not** keeping DeepSeek-V4-Flash-0731
as the default; roll back to `Qwen/Qwen3-235B-A22B-Instruct-2507` via the
`DEEPINFRA_MODEL` env var (no code deploy needed, per `router-config.ts`'s
own comment on the override).

**Samir confirmed both Step 5 actions.** [reliability.md](model-evaluation/reliability.md)
and [providers/deepinfra.md](model-evaluation/providers/deepinfra.md) are
updated with the full result. **The env var change itself is not done** —
the auto-mode permission classifier blocked `vercel env add DEEPINFRA_MODEL
production` the same way it blocked the "Dry run" checkbox earlier in this
session: changing production config needs a human's own action, not a
blanket chat approval. Samir needs to either run the command himself or add
a Bash permission rule if he wants this automatable going forward:

```bash
printf '%s' "Qwen/Qwen3-235B-A22B-Instruct-2507" | npx --yes vercel env add DEEPINFRA_MODEL production
```

(Repo already linked to `house-of-thought-dev/houses-of-thought` via
`vercel link` this session — `.vercel/` is gitignored, machine-local.)
