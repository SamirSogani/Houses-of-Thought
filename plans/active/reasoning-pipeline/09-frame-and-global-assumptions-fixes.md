# 09 — Frame's referent contradiction, global-assumptions' missing context (2026-08-01)

Written the same day as 08, continuing its "Updated next steps." **Code below
is committed** — check `git log` if that ever seems stale. This doc
supersedes 08 for current status.

## 1. Frame: clarity-vs-accuracy contradiction over "our school" — fixed

Real-verifying past global assumptions (08's step 1) first hit a **new**
Frame hard-block: `core_question` stayed `"Should our school ban homework?"`
verbatim across all 3 real attempts (the generator never revised it), while
`clarity`'s verdict flip-flopped pass/pass/fail on that same text — variance
across the reviewer's 4-provider failover chain landing on different
underlying models each attempt. This is exactly the scenario 06's Frame
convergence story flagged as deferred: *"worth doing later if frame
regularly needs 2-3 rounds in practice — not blocking anything today."* Now
it blocked.

Fix 1 — `FRAME_BLOCK` (`prompts.ts`): told the model explicitly that a vague
possessive/first-person referent ("our school") IS the kind of genuine
ambiguity worth rewording (e.g. → "a K-12 school"), independent of keeping
the loaded "ban" verb verbatim. Also dropped "our school's administration"
from `purpose`'s own example text, which was quietly modeling the exact
phrasing the fix now discourages.

Real-verified immediately: the very next attempt landed on `"Should a K-12
school ban homework?"` — the identical phrasing 06's own lucky convergence
had found — and **clarity passed cleanly for the first time this run**.

Fix 1 alone surfaced fix 2: **accuracy** then blocked the *same* referent
fix, calling it "silently broadening the scope" / "omits the original
phrasing." Textbook clarity-vs-accuracy contradiction — accuracy's
definition had no carve-out for the exact rewording clarity now requires,
unlike `logic`'s criterion, which already exempts keeping loaded/binary
wording verbatim. Fix 2 — `LAYER_STANDARD_CRITERIA['frame-review'].accuracy`
(`standards.ts`): added the matching carve-out, mirroring `logic`'s existing
pattern.

**Both fixes real-verified together, twice, in separate real runs**: run 2
passed Frame 9/9 on the very first attempt (`"Should the school ban
homework?"`); run 3 passed 9/9 again in 2 attempts. `accuracy` and `clarity`
have not failed once since — solid across 4 independent real attempts.

## 2. global-assumptions-review: reviewer never saw the perspectives — fixed

Reaching global-assumptions for the first time (08's own new-territory
milestone) with the halt-bug fixed, it hard-failed for real: 6/9 standards
failing, **the same complaint every one of 3 attempts** for 4 of them
(`clarity`, `precision`, `breadth`, `logic`) — not noise, a structural gap.

Root cause, found by reading `orchestrator-global.ts`: `runGlobalAssumptionsGenerate`
gets `questionContext(frame, bundles)` — frame AND the vetted perspective
bundles. `runGlobalAssumptionsReview` got only `serializeFrame(frame)` — the
reviewer never saw the perspectives at all. Yet its own criteria explicitly
reference them: accuracy asks whether assumptions are "genuinely implicit in
the perspectives," breadth asks whether they "cut across perspectives...
rather than duplicating one perspective's own already-listed assumptions."
Unanswerable questions for a reviewer that's never shown the perspectives —
`breadth` and `logic` (which grades `cross_perspective_notes`' cited
reasoning) failed 3/3 for exactly this reason.

Fix: threaded `bundles` through `runGlobalAssumptionsReview` (`orchestrator-
global.ts`) and its route.ts call site so the reviewer gets the same
`questionContext(frame, bundles)` the generator already had. Left
`global-evidence-review` alone — same call shape, but its own criteria
(breadth: "spread of angles"; relevance: "not just one stance's argument")
are judgeable from the evidence packet + frame alone, and there's no real
failure evidence there yet — no speculative fix without evidence, same
discipline 05/06/07 used for schema caps.

Also tightened `GLOBAL_ASSUMPTIONS_BLOCK` (secondary, addresses `clarity`/
`precision`, which context alone wouldn't fix): each assumption must be ONE
atomic, testable claim, not several conditions bundled into one sentence;
`cross_perspective_notes` must name which specific perspectives/claims
revealed the pattern, not just assert one exists.

**Verification status: typecheck clean, full dry run passes 17/17 steps
cleanly (confirms the state machine and route.ts signature change didn't
break anything). NOT yet real-verified** — see §4, capacity ran out before a
fresh run could re-reach global-assumptions with this fix in place.

## 3. Frame's breadth/logic: real variance, not a new bug — left alone

A second real run (after both frame fixes) halted again, this time on
`breadth`/`logic` — but the specific complaint changed every attempt
(missing parental perspectives → missing historical precedents/cultural
shifts), even as `scope_notes` genuinely grew more thorough each round. This
reads as reviewer-panel variance against `FRAME_BLOCK`'s own explicit
~1200-character budget ("thorough, not exhaustive"), not a fixable
contradiction like §1's. No fix applied — consistent with 06's own
precedent of accepting some regeneration variance as expected panel
behavior, not chasing it without a clear structural cause.

## 4. Capacity exhausted — stopped rather than burn more quota

By the third real run this session, all 3 drafter targets hit real limits
simultaneously: Groq `openai/gpt-oss-20b` hit its **daily** TPM cap (not
per-minute — resets at UTC midnight, unaffected by the stagger), Gemini
stayed rate-limited most of the session, and Cerebras — the sole remaining
target — started 429ing too under the full n=2 perspectives load once alone.
The pipeline correctly surfaced the manual Retry/New-question UI (transport
retries exhausted on all 3, exactly 07's precedent). Same call as 07's:
stopped rather than spend more quota re-learning a known capacity ceiling.

## Updated next steps

1. **Real-verify §2's fix** once drafter capacity recovers (Groq resets at
   UTC midnight) — confirm `global-assumptions-review` actually converges
   now that the reviewer can see the perspectives, and that `breadth`/`logic`
   no longer fail for the missing-context reason. Check `/admin` first.
2. If §2's fix alone isn't enough (context was necessary but might not be
   sufficient — `clarity`/`precision`'s "compound sentence" complaint has a
   real prompt-side fix now, but hasn't been real-tested against it yet),
   revisit with fresh real evidence, same as this doc did.
3. Once a run reaches `final-composition` for real, Phase 2 proper (05's
   breakdown) is unblocked — unchanged from 08.
