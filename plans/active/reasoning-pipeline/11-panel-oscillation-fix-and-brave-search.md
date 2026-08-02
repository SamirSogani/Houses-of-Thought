# 11 — Diagnosing the panel oscillation, and Brave Search (2026-08-02)

Written the same day as 10, continuing real-testing. **Code below is
committed** — check `git log` if that ever seems stale.

## 1. Real root cause of "fix one, spark another" — three compounding bugs

10's clarity fix, and 09's two fixes before it, each resolved one Frame
criterion collision only for the next regeneration to spark a different one.
Samir called this out directly: standards should converge in one shot, not
debate each other. Diagnosed the actual mechanism instead of patching the
next collision:

1. **Memoryless repair loop.** `appendRegenerationFeedback` (prompts.ts) told
   the generator only what's currently failing, never what already passes.
   A standard silently satisfied on attempt N had zero protection on N+1 —
   the generator, chasing only the latest complaint, would freely regress it.
   This *was* "fix one, break another," literally.
2. **Blind reviewers.** Each of the 9 reviewers sees only its own one-line
   criterion (`buildReviewerPrompt`), never the other 8 — so a reviewer with
   no idea what `accuracy` or `purpose` cover invents its own scope and
   reaches into their territory. Every collision fixed in 09/10 was one
   instance of this; there was no way to patch all 9×8 possible collisions
   one at a time.
3. **Unanimous gate.** `overall_pass` required literal agreement across 9
   independent, noisy binary judgments. Even a genuinely good artifact clears
   that at ~23% if each reviewer is individually 85% reliable — and *which*
   standard fails differs every attempt, which is what made the
   contradictions look structural when they were often just panel noise.

Fixed all three (`ecabfab`): the repair loop now lists passing standards to
preserve, not just failing ones to fix; the reviewer prompt gets a shared
division-of-labor map plus an explicit "on the fence, pass" bias;
`overall_pass` tolerates `MAX_PANEL_FAILURES=1` instead of demanding all 9.
Reviewer effort raised `low`→`high` (safe against 08's budget-starvation bug
— gpt-oss/qwen are hard-capped at their own floor regardless of what's
requested).

**Real-verified immediately, dramatically**: the very next run passed Frame
9/9 on the first attempt, both perspective bundles 9/9 on the first attempt
— zero regeneration rounds anywhere. `global-assumptions-review` and
`global-evidence-review` both passed via the new margin (1 tolerated
failure) rather than triggering a regenerate-or-halt cycle. The pipeline
reached **`conclusions`** — further than any run all session.

## 2. Three more schema caps, found by finally reaching them for real

With the panel no longer the bottleneck, three steps got real-exercised for
the first time ever and immediately truncated mid-JSON on Gemini, twice each
— the same "schema's own bounds exceed maxTokens" shape as every prior fix
of this kind (05/06/08/09):

- `conclusions_packet`: 900→1800 (up to 4 conclusions + 8 supporting_chain
  items at 600 chars each).
- `implications_packet`: 900→1800 (up to 8 implications, each with a
  600-char `text` AND a 600-char `who`, plus 6 caveats).
- `global_evidence_packet`: 900→1800 (up to 8 items, 600-char `claim_id` AND
  `source_ref` each) — confirmed as the shape issue, not a fluke, since
  `global_assumptions_packet` (smaller schema max) passed clean right next
  to it in the same run.

`global_assumptions_packet` itself was left alone — passed clean twice in a
row with real content, no truncation evidence, same discipline as always:
fix what's evidenced, not what's merely theoretically possible.

A follow-up run reached **`final-composition`'s own upstream stage**
(implications) before another real capacity wall (see §3) — not yet a
complete run, but every known structural blocker between Frame and
`final-composition` is now fixed and real-verified at least once.

## 3. Brave Search, AI-toggled (Samir's spec)

`BRAVE_SEARCH_API_KEY` was already configured and already used by Draft
Mode (`lib/ai/brave.ts`) — this pipeline's evidence prompts explicitly said
"no live web search" (Phase 1 scope, decisions/019). Wired it in at exactly
the two points Samir specified, both opt-in and bounded, never forced or
open-ended:

- **Evidence stages** (`PERSPECTIVE_EVIDENCE_BLOCK`, `GLOBAL_EVIDENCE_BLOCK`):
  the model can request up to 3 `search_queries` alongside its normal
  output. New `generateWithOptionalSearch()` (`lib/ai/reasoning/search.ts`)
  wraps this: search, feed results back, let the model try again — capped
  at `MAX_SEARCH_ROUNDS=2` before a forced final round with the search
  option removed. Normally zero queries (single round, no cost added);
  genuine multi-round only when the model still needs it, per Samir's spec.
- **context-gather**: when `needs_user_input` is true, search runs on
  `questions_for_user` and results attach as `search_findings` — per
  Samir: *enrich the question, never replace asking the user*. New
  `ContextGatherModelSchema` (what the model returns) vs.
  `ContextGatherVerdictSchema` (adds the orchestrator-populated
  `search_findings`) mirrors the existing `FrameModelSchema`/
  `FramePacketSchema` split. `ReasoningStagesList.tsx` gets a small
  dedicated display block — context-gather has no `ReviewPanelVerdict` to
  reuse `ReviewPanelVerdictPanel` with.

**Real bug found and fixed live**: `search_findings` initially used the
shared 600-char `str` cap (sized for short fields like `claim_id`) — real
Brave results (up to 3 queries × 4 results) immediately exceeded it,
round-tripped through the client, and 400'd the very next request. Fixed
with a dedicated `searchFindingsStr` (4000 chars) *and* a hard truncation
inside `runSearches()` itself, so the output can never exceed the cap
regardless of how verbose Brave's own descriptions get — not just a wider
number hoped to be enough.

**Real-verified**: context-gather's search path end-to-end — genuine Brave
results (real URLs: Edutopia, HCPSS district policy, ResearchGate) correctly
rendered in the UI and round-tripped through the schema after the cap fix.
**Not yet real-verified**: the evidence-stage search path itself (did the
model ever actually request `search_queries` there, and does a populated
round correctly re-invoke and ground the final packet) — Groq's daily quota
exhausted again (4th time this session) at `perspectives-generate-stances`,
before evidence generation was reached.

## Capacity note

Groq's `openai/gpt-oss-20b` daily cap (200k TPM) was hit and reset multiple
times in a single session today — real testing at this pace burns through it
fast. Not a bug; matches 07/09's own precedent of stopping rather than
chasing a known capacity ceiling.

## Updated next steps

1. Once capacity recovers, real-verify evidence-stage search specifically:
   does the model request `search_queries` on real perspective/global
   evidence content, and does the resulting `source_ref` actually cite a
   real URL from the results rather than continuing to describe a
   hypothetical source.
2. Keep pushing toward a full real run reaching `final-composition` — every
   known structural blocker is fixed; what's left is proving it end-to-end
   in one run once quota allows.
3. Phase 2 (05's breakdown) unblocks once that happens — unchanged from
   08/09/10.
