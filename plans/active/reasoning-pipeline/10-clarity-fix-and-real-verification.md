# 10 — Clarity's over-demand fixed, both prior fixes real-verified (2026-08-02)

Written the day after 09, picking up its "Updated next steps" #1: real-verify
09's global-assumptions-review context fix once drafter capacity recovered.
**Code below is committed** — check `git log` if that ever seems stale.

## 1. A third Frame contradiction, found and fixed before rerunning

Per instruction, checked for unfixed issues before rerunning: both 09 fixes
were already committed. Provider health was clean (Groq's daily quota had
reset past UTC midnight), so ran for real immediately — and hit a **new**
Frame hard-block on the first attempt, distinct from 09's referent issue.

`core_question` stayed simple through 2 attempts, but attempt 2's `clarity`
verdict demanded it inline the decision-maker and enumerate every policy
alternative — directly contradicting `FRAME_BLOCK`'s own design, which
explicitly assigns those to `purpose` and `scope_notes` respectively, and
explicitly forbids padding core_question with exactly this kind of
elaboration. The generator, chasing that feedback, overcorrected into a
compound question ("bans, limits, modifies, or maintains...") that then
failed both `clarity` (too convoluted) and `accuracy` (over-broadened) —
self-inflicted, downstream of a reviewer demand the prompt never licensed.

Fix — `LAYER_STANDARD_CRITERIA['frame-review'].clarity` (`standards.ts`):
added an explicit exemption stating core_question does NOT need to name the
decision-maker or spell out every alternative, matching what `FRAME_BLOCK`
already tells the generator. **Real-verified twice** immediately after:
both subsequent real runs passed Frame within 1-2 attempts, no clarity/
accuracy failures since.

## 2. 09's global-assumptions-review fix: real-verified, working as designed

Reached global-assumptions in both of today's real runs. Both times it
hard-failed hard (6-9/9 standards) — but the verdict notes now **cite
specific claims from p1/p2 by name**: *"Neither p1 nor p2 explicitly claims
homework is primary — p1 acknowledges alternatives like in-class assessments
(counterargument by p2)"*, *"the student perspective (p1) assumes homework
reinforces learning — yet the counterargument (by p2) denies these claims
entirely."* This is direct proof the reviewer can now actually see the
perspective bundles and is cross-checking against their real content —
something structurally impossible before 09's fix (the reviewer had only
`serializeFrame(frame)`). **09's fix is confirmed working correctly.**

## 3. Why global-assumptions still failed: real content quality, not a bug

Both runs' perspective bundles **degraded** (failed to converge in 3
attempts) before reaching global-assumptions — a first; the one prior real
run to reach this far (08) had one clean bundle and one degraded. Reading
the actual perspectives-review verdicts, the complaints are substantive and
correct (e.g. a stance's evidence markedly weaker than its own
counterargument's; missing equity engagement the scope explicitly asked
for) — the panel behaving as the firm, fair grader it's designed to be, not
hitting a structural gap like 09's. `perspectives-review`'s `degrade`
failure mode fired exactly as designed both times, and the pipeline
correctly continued rather than crashing.

Downstream, global-assumptions-generate then invented an assumption
("homework affects all students uniformly") that **directly contradicts**
what both perspectives explicitly discuss (equity, differential impact) —
a real content defect the now-context-aware reviewer correctly caught. This
reads as the same category of accepted variance as 09 §3's Frame
breadth/logic flakiness: real, but not a fixable structural contradiction —
no fix applied, consistent with that precedent.

## 4. Capacity: exhausted again after 2 real runs

Groq's `openai/gpt-oss-20b` hit its daily cap again by the second run today
— two real n=2 runs with regeneration is apparently enough to exhaust the
200k daily TPM budget in a single session. Gemini and Cerebras both then hit
transient rate limits simultaneously, reproducing 09 §4's "all 3 drafter
targets down" transport failure. Stopped rather than spend more quota,
matching 07/09's own precedent.

## Updated next steps

1. Once capacity recovers, keep real-testing toward `final-composition` —
   both known structural bugs (Frame's referent contradiction, clarity's
   over-demand, global-assumptions' missing context) are now fixed and
   verified; what's left to prove is whether perspectives/global-assumptions
   content quality converges reliably enough in practice, or needs its own
   targeted fix once more real evidence accumulates.
2. Phase 2 (05's breakdown) remains blocked behind a real run reaching
   `final-composition` — unchanged from 08/09.
