# Decision 006 — Groq model: GPT-OSS over Qwen3

**Date:** 2026-07-07
**Status:** Implemented — co-pilot wired to `openai/gpt-oss-120b` on Groq via
`lib/ai/` + `POST /api/ai/suggest` (plans/active/ai Phase 1). Research Mode
(Evidence layer, Brave-cited) is still pending — Phase 4.

## Context

The project committed to Groq as the AI provider. The Llama model we had been
targeting was deprecated, so the co-pilot and Evidence "Research Mode" need a
new model before they can be wired. The two live candidates on Groq are
**Qwen3-32B** and the **GPT-OSS** family (`openai/gpt-oss-20b`,
`openai/gpt-oss-120b`).

Both AI touchpoints are currently placeholder no-ops pending this choice —
`CopilotPanel` "Add" ([components/build/rail/CopilotPanel.tsx](../components/build/rail/CopilotPanel.tsx))
and the Evidence "Research Mode" button
([components/build/layers/EvidenceLayer.tsx](../components/build/layers/EvidenceLayer.tsx)).
See also decision 005 §4.

## What the model has to do

The co-pilot is a **contextual suggestion engine**, not a chatbot. For the
active layer only (Concepts → Perspectives → Evidence → Assumptions →
Conclusion → Implications → Strength), it proposes short moves that map onto a
state mutation — add a concept, add a missing perspective, sharpen the question
(see [lib/build/suggestions.ts](../lib/build/suggestions.ts)). That makes the
real constraints:

- **Structured / tool-calling output** — each suggestion must map to a state
  change, so JSON/function-call adherence matters more than prose fluency.
- **Reasoning quality** — suggestions model critical-thinking moves
  (Paul–Elder), so pedagogy beats knowledge recall.
- **Content safety** — this is a student-facing classroom product (see the
  privacy copy in `EducatorTrustSection` / `FaqGroupsSection`).
- **Latency + cost at classroom scale** — it lives in an interactive rail;
  speed is the reason Groq was chosen, and many students run it at once.

## Decision

Use **GPT-OSS**.

### 1. Model
- **Choice:** Default to `openai/gpt-oss-120b` for suggestion quality; fall back
  to `openai/gpt-oss-20b` if classroom-scale cost/latency demand it. The task is
  narrow enough that 20b is expected to hold up.

### 2. Reasoning
- Use the `reasoning_effort` knob to match the mode: `low` for the routine
  per-layer suggestion bank; `high` for deeper analysis (e.g. House Strength
  review at step 7).

### Why GPT-OSS over Qwen3
- **Native tool-calling reliability** — trained for the reasoning + tool-call
  loop, which is exactly the suggestion→state-mutation shape we need.
- **Built-in safety alignment** — a genuine differentiator for a
  student-facing product; fewer classroom surprises.
- **Adjustable reasoning effort** — cleanly splits cheap/fast suggestions from
  occasional deeper analysis.
- **Qwen3-32B's edge is multilingual/coding breadth**, neither of which this
  English-language reasoning-scaffold leans on — so it gives up the safety and
  effort-knob advantages for nothing we use.

## Notes / follow-ups

- Verify current model availability and exact IDs in the Groq console before
  wiring — Groq rotates its hosted lineup.
- Co-pilot wiring done: the inert "Add" is now a live Groq call
  (`POST /api/ai/suggest`) whose findings map to `APPLY_AI_ACTION`. The Evidence
  "Research Mode" affordance is still inert pending Phase 4 (Brave-cited).
- Revisit 20b vs 120b once there's real classroom load and cost data.
