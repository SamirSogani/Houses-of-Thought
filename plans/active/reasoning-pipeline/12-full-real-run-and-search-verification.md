# 12 — Full real run reaches final-composition; evidence-stage search verified (2026-08-02)

Written the same day as 11, after capacity recovered. **Code below is
committed** — check `git log` if that ever seems stale. This session made no
code changes; it's pure real-verification plus two addenda for fixes that
landed after 11 was written but were only ever described in commit messages.

## 1. Two addenda to 11 (already committed, not yet documented)

**`generateWithOptionalSearch` crash on a mock missing `search_queries`**
(`cd51c7e`). `search.ts`'s destructure of `search_queries` off a completeJSON
result assumed the field always exists (real calls guarantee it via the
merged schema) — a test double that didn't include it crashed instead of
degrading. Only surfaced by actually running `vitest run`; typecheck and the
dry-run browser check both passed clean, since neither exercises that code
path. Worth remembering as its own lesson: this pipeline's fastest checks
(typecheck, dry run) verify plumbing, not runtime behavior against real or
mocked payload shapes — `vitest run` is the one that catches this class of
bug.

**Daily-exhaustion state now persists across dev-server restarts**
(`5c291d3`). The gap flagged at the end of the session before 11 turned out
to be two separate things: a misdiagnosis (the in-process skip-if-exhausted
logic was already correct and already tested) plus one real gap (the
exhaustion map was purely per-server-instance, so a dev-server restart
forgot it and re-discovered exhaustion the expensive way — one real
fast-failing upstream call). Fixed by persisting to a new `ai_daily_exhaustion`
Supabase table (`0028_ai_daily_exhaustion.sql`, deny-all RLS, service-role
only), hydrated once into the in-memory map at process start in the
background — reads stay fully synchronous, writes are fire-and-forget on the
rare real exhaustion event. Degrades to the old per-instance-only behavior if
Supabase is unreachable or unconfigured. Full design rationale in the
comment block at the top of `lib/ai/router-state.ts`.

## 2. Provider health check, before spending quota

`/admin` showed Groq's penalty box as `Normal` and no daily-exhausted
providers — capacity had recovered since 11's session (same UTC day, so this
correctly reflects the persistence fix working, not a stale reading masking
real exhaustion).

## 3. First full real run reaches final-composition

Ran the pipeline for real (n=2, not dry run) on: *"Should our K-12 school
district switch to a 4-day school week, based on the research evidence from
districts that have already done so?"* — chosen deliberately for
checkable, named-study content, to maximize the chance the evidence stages
would actually request search.

**Result: every one of the 17 steps completed, ending at a real final
answer.** More notably, **all six review-panel gates passed 9/9 clean on the
first attempt** — zero regenerations anywhere in the run (frame, both
perspective bundles, global assumptions, global evidence, conclusions,
implications). This is the first time a single real run has gone start to
finish; 11's own best run that day stopped at implications on a capacity
wall. It's real evidence that the panel-oscillation fix (`ecabfab`) and the
three schema-cap raises hold up together, not just individually.

## 4. Evidence-stage search path — real-verified

11 left this as the one open item: does the model ever actually request
`search_queries` on real evidence content, and does a populated round ground
the final packet in a real URL instead of continuing to describe a
hypothetical source?

**Both, confirmed live.** The run's Brave query counter
(`getBraveCounter()`, `/api/admin/ai-status`) went from 0 to 3 during the
run. Isolating which step spent them (by pulling the full run state out of
the page's React fiber, since the network log truncates large bodies):

- **Perspective p1** ("superintendent and governing board") and
  **global-evidence-generate** both judged their claims didn't need a live
  search and left `search_queries` empty — `source_ref` values are
  descriptive placeholders ("district transportation cost reports",
  "peer‑reviewed studies on test scores in 4‑day week districts"), exactly
  the documented normal case.
- **Perspective p2** ("Parents and families") requested search and got it:
  all 6 of its evidence items carry real URLs — `nih.gov/pmc`, `nwea.org`,
  `businessinsider.com`, `degree.lamar.edu`, `linq.com`,
  `oej.scholasticahq.com` — not descriptions of what a search would need to
  find.

Spot-checked the PMC one (`pmc.ncbi.nlm.nih.gov/articles/PMC9642983/`) with
an independent fetch: it's a real study on Oregon 9th-graders and four-day
weeks, and its actual finding (a several-point drop in on-time graduation
likelihood, larger in non-rural districts) matches the model's own
`claim_id`/`caveats` text for that item almost exactly. Not a hallucinated
URL, and not a mismatched citation either.

This resolves 11's last open item — the search integration works
end-to-end, from the model's own judgment call about when to search, through
real Brave results, to a grounded, checkable final packet.

## 5. Updated next steps

Phase 1.5 is done. Per [05](05-phase1-status-and-next-phases.md)'s
breakdown, **Phase 2 is now unblocked**:

1. Persist packets/verdicts (new table, or decide against once log volume
   from more real runs shows whether it's actually needed).
2. Dynamic budget enforcement — shrink `n` / tighten retries under live
   capacity pressure.
3. A/B the review panel (panels on vs. auto-pass) — decision 019
   verification stage 3, confirms the 9-reviewer cost is earning better
   answers than it would without them.

Worth one or two more real runs at n=2/n=3 on different question shapes
before calling Phase 1.5 fully closed — this session's clean run is strong
evidence, not yet a large sample.
