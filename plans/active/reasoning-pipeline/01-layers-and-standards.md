# 01 — Layer contracts and the review panel

Read [README.md](README.md) first for the architecture diagram and the
fan-out rationale. This doc details what each layer actually does and what
the nine-standard review panel checks for at each gate.

## Layers 0–2: setup (no review panel)

- **Context-gather (pre-frame):** decides whether the pipeline has enough to
  start, or needs a clarifying question back to the user first. Callable
  again at any later layer boundary. Emits `ContextGatherVerdict`.
- **Frame:** turns the raw query into `core_question`, working `definitions`,
  `purpose`, and `scope_notes`. The one setup layer that *is* reviewed (below)
  — a badly framed question corrupts everything downstream.
- **Context-gather (post-frame):** a second checkpoint once the question is
  pinned down, before committing to a breadth.
- **Breadth-scoping:** decides `n` (how many perspectives), with a rationale
  and candidate viewpoint labels. A routing decision, not reasoning content —
  no panel, by design (keeps the reviewer count at `9n + 45`).

## Layer 3: Perspectives (the fan-out)

Each of the `n` perspective bundles runs as an independent session containing
the stance plus four sub-elements:

1. **Stance** — the perspective's core position and key claims.
2. **Sub-questions** — what this stance needs answered to hold up.
3. **Assumptions** (this stance only) — what it takes for granted.
4. **Counterargument** — the strongest case against, written by a session
   with no ownership of the stance (blind fresh agent, or cross-assigned:
   the agent arguing perspective *j* writes perspective *i*'s counterargument).
5. **Evidence** (this stance only) — what supports it. Its own 3-phase
   sequence (2026-08-13, Samir's evidence redesign — see
   [24-evidence-redesign-and-failure-tracking.md](24-evidence-redesign-and-failure-tracking.md)),
   run *after* 1–3 settle rather than alongside them:
   - **Strategy** — decide, per perspective, whether to search (which query
     terms), ask the user a clarifying question, both, or neither. Nothing
     else — no evidence content yet.
   - **Populate** — for units that requested search, actually run it
     (`runSearches`, Brave) and write the real evidence items (claim +
     source + caveats) from real results and any user answer. Never invents
     a citation because it never works from anything but real, already-
     fetched data.
   - **Confidence** — a separate call scores each populated item's
     confidence (low/medium/high). Kept apart from populate so one model
     call is never simultaneously fetching *and* self-grading its own find.

2–4 run in parallel (each only needs the stance, not each other); evidence's
own 3 phases are sequential and run afterward, since populate needs
strategy's decision and confidence needs populate's items. The whole bundle —
stance + sub-questions + assumptions + evidence + counterargument — is then
reviewed **together, once**, by the nine-standard panel. Reviewing the bundle
rather than each sub-element separately is what keeps the panel count at 9
per perspective instead of 45 (9 × 5 sub-elements): the difference between 27
and 135 reviewers at `n = 3`. It also lets reviewers judge things only
visible in combination — e.g. whether the evidence actually engages the
stated assumptions.

## Layers 4–7: global layers (each reviewed)

- **Global assumptions:** question-level, informed by all vetted perspectives
  but confined to none — catches assumptions no single stance flagged.
- **Global evidence:** question-level sourcing and relevance, same scope rule
  — same strategy/populate/confidence 3-phase split as Perspectives' own
  evidence, just one question-level unit instead of `n` per-perspective ones.
- **Conclusions:** must actually follow from assumptions + evidence, not
  overreach.
- **Implications:** consequences explored, proportionate to what's at stake.

## Layer 8: Final composition (no review panel)

Packages `FramePacket.core_question` + the vetted `ImplicationsPacket` into
the actual response, with a caveats section for anything marked `degraded`
along the way. Packaging, not new reasoning — consistent with no synthesis
panel.

## The nine standards — fully adapted per layer, not one generic definition

Every panel checks all nine standards at every gate, but **what each standard
means is redefined per layer, in code** — not a generic definition with a
supplementary hint. Found live during Phase 1 verification (2026-07-30):
grading Frame's "depth" against a generic "engages real complexities"
definition unfairly penalizes framing, whose job is to pose the question
clearly, not argue it. Frame's actual depth criterion asks how many of the
question's real considerations the framing accounts for, and whether the
question itself is crisp or vague/generic — a different question entirely
from Perspectives' depth criterion (does the stance engage its strongest,
most substantive form) or Conclusions' (does the reasoning chain engage the
real tradeoffs, not assert "evidence supports X").

The authoritative source is
[`lib/ai/reasoning/standards.ts`](../../../lib/ai/reasoning/standards.ts)'s
`LAYER_STANDARD_CRITERIA` — a `Record<ReviewGateStep, Record<StandardId, string>>`
covering all 6 reviewed gates × all 9 standards (54 entries), type-checked
exhaustive so a missing combination is a compile error, not a silent gap.
This doc doesn't duplicate that table — read the code for the specific
criterion at any gate.

`overall_pass` on a panel verdict defaults to **all nine must pass** — see
[03-orchestration-and-failure-handling.md](03-orchestration-and-failure-handling.md)
for the tunable threshold and retry behavior.
