# 06 — Phase 1.5 bounded retries: built, and real-verified (2026-07-31)

Written the day after 05, once real testing kept reproducing the exact
failure 05 flagged. **Everything below is uncommitted** — check
`git status`/`git diff` first.

## What shipped

Both halves of decision 019's bounded-retry design (2 retries / 3 attempts),
resolving 05's "open question" in favor of building now (Samir's call,
2026-07-31): the `degraded` semantics 05 worried about are updated in
`lib/ai/reasoning/contracts.ts` to match.

### 1. Transport-level: automatic wait-then-retry on `ai-rate-limited`

`ReasoningPipelinePage.tsx` retries a step automatically (5s, then 15s
backoff) before surfacing a manual "Retry." Scoped ONLY to the upstream
`ai-rate-limited` code — our own daily-cap code (`rate-limited`,
`lib/ai/findings.ts`) never clears mid-run, and every other `AiError`
already gets its own same-instant self-correction retry inside
`completeJSON` (lib/ai/router.ts). Deliberately client-side, not inside
`router.ts` itself — that file is shared with every other AI surface in the
app; decision 019 scopes this pipeline as separate.

### 2. Verdict-driven: regenerate on a failed panel verdict

- **Hard-block layers** (frame, global-assumptions, global-evidence,
  conclusions, implications): `app/api/admin/reasoning/route.ts` no longer
  halts on the first failed verdict. A new `attempt` field in the request
  body (client-tracked, reset on any forward step, incremented only on a
  `retry: true` response) lets each `*-review` case decide retry vs. halt.
  `retryStep()` loops `nextStep` BACKWARD to the paired `*-generate` step
  instead of forward — the client just follows whatever `nextStep` a
  response carries, no special case needed, but DOES need the explicit
  `retry` flag since a loop-back and normal forward progression can land on
  the same step id (e.g. context-gather-pre's normal nextStep is also
  `frame-generate`).
- **Perspectives (degrade-per-bundle)**: `orchestrator-perspectives.ts` tracks
  a `perspectiveAttempts: number[]` parallel array. Only a bundle whose prior
  verdict failed AND hasn't exhausted retries regenerates — a settled bundle
  (passed, or already degraded) is returned/reviewed unchanged
  (`needsRegeneration()` is the single shared predicate both generate and
  review use, so they can't disagree about which bundles are still live).
  `perspectives-review` only marks `degraded: true` once a bundle's attempt
  count actually hits `MAX_REGENERATION_ATTEMPTS`.
- **Feedback**: `appendRegenerationFeedback()` (prompts.ts) appends the prior
  artifact (pretty-printed JSON) plus the specific failing standards' notes
  to the regenerating call's prompt — "targeted repair, not independent
  judgment," per 03-orchestration-and-failure-handling.md.
- **Why split across client-driven steps, not one server-side loop**:
  steps.ts's whole 17-step design exists because chaining generate+review in
  one request risks the route's 30s budget. A synchronous
  regenerate-then-re-review loop inside one review handler would reintroduce
  exactly that risk. So retries loop back through the SAME client-driven
  step machine, one attempt per request pair, same as the happy path.

### Test coverage

No route-handler-testing precedent existed in this repo, so route.ts's
simple `attempt < MAX ? retry : halt` branches (identical pattern × 5 call
sites) are only typecheck/lint-verified. The one genuinely complex,
previously-untested piece — perspectives' per-bundle carry-forward /
regenerate / degrade decision — has real unit coverage instead:
`lib/ai/reasoning/orchestrator-perspectives.test.ts` (7 cases, mocks
`completeJSON` and `runReviewPanel`), covering: fresh generation, "settled
bundle is never re-asked-for or re-reviewed" (checked via object identity),
the repair prompt actually carrying prior-artifact + failing-notes text, and
degrade firing only once `MAX_REGENERATION_ATTEMPTS` is truly exhausted.

## Real-verified live (2026-07-31) — the Frame prompt convergence story

A real n=2 run with "Should our school ban homework?" finally answered 05's
open question about `FRAME_BLOCK` fix #3, and the answer is more nuanced than
pass/fail:

**Fix #3 does NOT pass cleanly on its own.** The first real attempt failed
5/9 (clarity, precision, relevance, logic, significance) — the panel called
`core_question` "begging the question" for staying verbatim-and-binary
("Should our school ban homework?"), even with the spectrum-of-options note
pushed into `scope_notes` per fix #3's design.

**But the new regeneration loop converged it to a clean pass in 2 more
rounds**, and the actual failing/passing progression is the useful part:

| Attempt | `core_question` | Failing |
|---|---|---|
| 1 | "Should our school ban homework?" (verbatim) | clarity, precision, relevance, logic, significance (5) |
| 2 | "Should our school ban homework?" (verbatim, revised scope_notes/purpose) | clarity, logic, significance (3) |
| 3 | "Should a K-12 school ban homework?" | clarity only, briefly (see below) |
| final | "Should a K-12 school ban homework?" | **0 — 9/9 pass** |

The winning change was narrower than it looked: replacing the ambiguous
pronoun **"our"** with **"a K-12 school"** — not abandoning the binary "ban"
verb, and not the more drastic reword ("Should the school implement a policy
to ban homework?") an intermediate attempt tried and which the panel
rejected on clarity ("could imply a new policy rather than evaluating an
existing one"). Once the referent ambiguity was fixed, the SAME "ban"
wording that earlier attempts flagged as question-begging was accepted by
`logic` as neutral. **Refined understanding for future prompt tuning:** the
panel's clarity/logic complaints were more about "our" being a vague
referent than about binary/loaded phrasing per se — fix #3's core design
choice (keep loaded wording, push spectrum into scope_notes) was sound; it
just needed one more fix layered on: resolve ambiguous pronouns/referents in
`core_question`, independent of whether the verb stays binary.

**Not yet done, deliberately**: `FRAME_BLOCK` itself was not re-edited based
on this — the regeneration loop already reaches a clean pass automatically,
so a prompt edit is optimization (fewer regeneration rounds), not a
correctness fix. Worth doing later if frame regularly needs 2-3 rounds in
practice; not blocking anything today.

## Two more real bugs found and fixed live

Same pattern as 05's bugs #1/#2 — a schema cap too tight for what the prompt
actually asks for, surfaced only once real regeneration prompts (longer,
carrying prior-artifact + feedback) exercised the tighter cases:

3. `FramePacketSchema.scope_notes` shared the generic 600-char `str` cap, but
   `FRAME_BLOCK` asks for practical/social/economic/procedural angles plus a
   spectrum-of-options note plus an out-of-scope note — routinely over 600
   chars. Fixed: dedicated `scopeNotesStr` schema, cap raised to 1400
   (`lib/ai/reasoning/contracts.ts`), prompt given an explicit length target
   ("~1200 characters," `FRAME_BLOCK`).
4. `runFrameGenerate`'s `maxTokens: 1200` truncated mid-JSON on a
   regeneration round (log: `"response was not valid JSON"` on BOTH the raw
   attempt and completeJSON's own retry) — up to 6 definitions plus the
   now-1400-char scope_notes can outgrow 1200 output tokens, especially when
   also addressing repair feedback. Fixed: raised to 2000
   (`lib/ai/reasoning/orchestrator-setup.ts`).

## Real-verified live: past Frame for the first time

Once frame-review passed, the SAME run continued for the first time ever
into real (non-dry-run) territory beyond Frame: `context-gather-post` →
`breadth-scoping` → `perspectives-generate-stances` all succeeded with real
model output. `perspectives-generate-details` (4 parallel `drafter`-role
completeJSON calls × n=2 bundles = 8 concurrent calls) then exhausted the
2-target drafter lane — 3 consecutive `ai-rate-limited` responses, the new
transport-retry correctly firing all 3 backoff attempts before falling back
to a manual "Retry," exactly as designed. This is an app-wide capacity
constraint (the drafter lane genuinely can't sustain 8 concurrent calls
today), not a code bug — stopped there rather than burning more quota
chasing it; a fresh session with better provider headroom (or a smaller
per-bundle concurrency) is the natural next real-verification step.

## Updated next steps

Phase 1.5 items 1-3 (05) are DONE per above. Remaining, in order:

1. **First real test of perspectives-review onward** (05's item 5) — now
   partially reachable; resume from `perspectives-generate-details` once
   provider headroom allows, or consider lowering concurrency there
   (currently 4×n parallel drafter calls at once).
2. **Audit remaining packet schemas' max-lengths** (05's item 4) —
   `ConclusionsPacketSchema`, `ImplicationsPacketSchema`,
   `GlobalAssumptionsPacketSchema`, `GlobalEvidencePacketSchema`,
   `PerspectiveBundleSchema` — same fix pattern as scope_notes/notes above,
   but for fields not yet real-exercised, so not yet confirmed necessary.
3. Consider whether `perspectives-generate-details`'s 4×n concurrent
   drafter calls need throttling (stagger, like the review panel's existing
   `REVIEWER_STAGGER_MS`) given today's live evidence that it alone can
   saturate the 2-target lane.
