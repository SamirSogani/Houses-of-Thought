# 30 — Console: subagent loops

Companion to [29](29-console-multi-chat.md). Samir asked what loops the
console could run once it holds several chats. Confirmed 2026-08-22:
**bounded loops, user-triggered, allowed to re-run real pipeline layers.**

## The constraint every loop design has to respect

Vercel Hobby caps a function at 60s, and the console route already sits at
`maxDuration = 60` with a 55s router guard and a 45s attempt timeout
(`router-lanes.ts`). Nothing that loops can loop *inside one request*. The
pipeline already solved this: **the client drives the loop, one step per
request** (`useReasoningPipelineRunner`'s effect). Every loop below follows
that shape — no queue, no worker, no second orchestration engine. Doc
[22](22-vercel-hobby-duration-and-stagger-fix.md) reached this conclusion the
expensive way; there is no reason to rediscover it.

## Loop A — bounded revise (in-chat, no pipeline)

For "that answer is thin", "try again but shorter", "you missed the point."

- One iteration = one POST with `mode: 'revise'`, carrying the target
  assistant turn id and the person's instruction.
- The server does **critic → revise**: a `critic`-role call scoring the prior
  answer against a small subset of the pipeline's own nine standards
  (clarity, relevance, depth — reusing the existing `AiRole: 'critic'` rather
  than inventing a role or a parallel critique vocabulary), then a
  `console`-role call rewriting with that critique in hand.
- **Hard cap of 3 iterations**, after which the button disables and says so.
- Each iteration writes a real assistant row; earlier ones collapse under a
  "2 earlier attempts" disclosure rather than vanishing, and the critique text
  is stored on the row and shown on expand. A loop whose inside the person
  cannot see is a loop they cannot check — the same reason the pipeline shows
  `ReasoningStagesList` instead of a spinner.

Worst case: 6 model calls behind one button.

## Loop B — stage rerun, made chat-aware

Doc [28](28-post-pipeline-console.md) already built this and it works;
multiplying chats is what breaks it. Three additions, no new engine:

1. **Single-flight per house.** Derive the lock from
   `reasoning_runs.status = 'running'` for that `house_id` — no new table.
   The runner is client-driven, so someone who closes the tab mid-run leaves
   the row `running` forever; treat a row whose `updated_at` is older than
   5 minutes as stale and let a new rerun claim it. That window is a guess and
   should be checked against a real halted run before shipping.
2. **A marker in every chat.** When a rerun finishes, insert one
   `role: 'system'` row into every active chat of the house — "Perspectives
   onward were regenerated; answers above may refer to the previous version."
   This is why 0041 widens the `role` CHECK (doc 29).
3. **Say what it costs.** The confirm card already lists the cascade; it
   should also say *this changes the house for every chat*, which only became
   true once there were several.

The cost itself is unchanged from doc 28 — a cascade from `concepts` is close
to a full pipeline run, the most expensive thing a person can trigger in this
product. It stays behind two clicks and a preview, as it is today.

## Loop C — sandbox rerun with a diff (phase 3, not now)

The real "branch off" story: a chat reruns a stage into a **copy** of the run
state, writes nothing to the house, and shows a side-by-side of what would
change. Accept promotes it; discard drops it. This is where doc 29's rejected
option 2 returns as something buildable — the branch owns a *candidate* house,
not the house.

What it needs that does not exist yet: a `reasoning_runs` row explicitly
marked a candidate rather than the house's current run (today
`getReasoningRunByHouseId` just takes the most recent by `updated_at`, so a
candidate would silently become "the" run), a layer-level diff view, and a
promote path that applies a *chosen* run rather than the newest one. Real
work — worth doing after multi-chat has actually been used.

## Loop D — autonomous background agents (rejected for now)

Agents that keep working for minutes and post back on their own need a job
queue and a way to notify a page that is not driving the loop. Neither exists
here, and the 60s ceiling means the queue would have to be external. The
honest version of this is a scheduled job, not a chat affordance; revisit only
if something else in the product needs a queue first.

## Cost and rate limiting — a real gap

`enforceAiLimit(req)` increments the day's counter **once per request**
(`lib/ai/limits.ts`), however many model calls that request makes. That was
fine when every AI route was a single `completeJSON`. Loop A makes two per
request, and the cap would count it as one.

Before any loop ships, `enforceAiLimit` needs to charge by units rather than
by request — an optional `units` argument defaulting to 1, passed as 2 by the
revise route. Otherwise someone on `USER_DAILY_CAP = 250` can spend closer to
500 calls a day through the console alone, and the cap stops meaning what the
admin monitor reports it means.

Multi-chat compounds this from the other side: a fork starts with its parent's
transcript already in the prompt, so a chat branched three deep costs
noticeably more per turn than a fresh one. Doc 29's depth cap of 5 and the
unchanged 30-turn window are what hold that down.

## Suggested phasing

| phase | contents | status |
|---|---|---|
| 1 | Migration 0041, chats API, sidebar, fork + seed, soft delete/restore, doc 29's two bug fixes, the `ConsolePage` split | **Implemented**, `feat/console-multi-chat` |
| 2 | Loop B's three additions, the `enforceAiLimit` units change, then Loop A | **Implemented**, `feat/console-loops` (migration 0042 not yet applied) |
| 3 | Loop C — sandbox rerun and diff: branching the house, not just the chat | Not started |

Phase 1 is shippable alone and is what the ask actually was. Phase 2 is what
makes several chats *safe* rather than merely possible — without it, two
branches quietly overwrite each other's reruns.

## Open questions

- Does a fork inherit the parent's *pending* proposed actions, or start clean?
  Planned as: inherited but rendered from `aiActionApplicable`, so anything
  already in the house shows as applied rather than as a live offer.
- Is the 5-minute stale-lock window right? Needs one real halted run to check.
- Should a `system` rerun marker land in soft-deleted chats too, so a restored
  chat still explains its own staleness? Cheap to do; probably yes.
