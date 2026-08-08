# Creative Concept: Architecture of Thought

[← Back to index](README.md)

> This direction turned out to already exist, almost exactly, as
> `plans/active/pre-login-ux/design-language.md`'s **"Architectural Blueprint ×
> Editorial"** system — down to sheet marks and a single amber accent. This doc
> now defers to that one as the source of truth and just applies it correctly
> to the real 7-layer house instead of the 8 rooms I'd guessed at blind.

## The idea in one line

The product is *literally* about building houses of reasoning, and the
existing brand already leans into that ("INTELLECTUAL BLUEPRINT · EST. 2026",
`SheetStrip`'s sheet marks). Reasoning gets rendered as architecture —
blueprints, framing, foundations, windows, weather — instead of the
glowing-orb/purple-gradient look most AI tools default to.

## The real seven rooms (corrected)

The product's canonical vocabulary is **seven layers**, not eight or twelve:
**Frame → Perspectives → Evidence → Assumptions → Conclusion → Implications →
Review** (`app/framework/page.tsx`). The 12-layer breakdown in
`context/framework/trapasso-model.md` is the finer-grained concept map that
folds into these seven; the nine standards (Clarity, Accuracy, Precision,
Relevance, Depth, Breadth, Logic, Significance, Fairness) are the AI's
internal review-panel mechanism inside **Review**, not a separate room.

| Layer | Contains | Room | Why |
|---|---|---|---|
| Frame | Concepts, Purpose, Overarching Question | The Blueprint | What's being built, and why, defined before anything argues |
| Perspectives | Sub-Questions, Points of View (+ Personal Foundational POV) | The Windows | Same house, a different view from each |
| Evidence | Information & Facts | The Materials Yard | Sourced, cited material before it's built in |
| Assumptions | Assumptions (incl. Unknown Unknowns) | The Foundation | Load-bearing, usually invisible |
| Conclusion | Logical Inference, Sub-Conclusions, Overarching Conclusion | The Wiring | The connections that make "therefore" hold |
| Implications | Implications vs. Consequences | The Weather | What happens when this meets the real world |
| Review | Iterative Thinking, House Strength, Stress Test | The Inspection | Scored, attacked, sent back until it holds |

Review sits last because it *is* last in the real sequence — and because that's
where House Strength (Evidence / Logic / Coverage, 0–100 each) and the Stress
Test actually live, not as a bolted-on loop outside the house.

## What must not be implied (the one real mechanical fix)

The AI never authors the finished result — it never even hands out a verdict.
`decisions/007`'s posture dial (`Mirror → Coach → Sparring partner →
Co-analyst → Author`) puts **Author permanently off-limits as real output**; a
prior feature that let the AI draft the whole house was removed specifically
for contradicting this. The real Mini House (`components/try/MiniHouseResult.tsx`)
proves it: three perspectives explored through sub-questions, cited evidence,
a synthesis — and it ends on a **reflective question**, never a lean or a
verdict. My first pass at the live-demo mockup got this wrong (a pro/con list
ending in "leans toward: take it, 63/37" — exactly the pattern the team
already killed once). Fixed in [06](06-page-live-demo.md) and the mockup.

## Visual system (now the real tokens)

**Color** — Ink Navy (`#14213A`) for primary text/dark grounds, warm Paper
(`#F7F6F2`, not stark white) for page background, one accent **Amber**
(`#F2B021`) for primary actions and marks only, Graphite/Slate (`#5A6B85`) for
secondary text and mono labels, Blueprint Blue (`#3E5C8A`) as a sparing
secondary/diagram accent. Semantic success/warn/uncertain colors are reserved
for the strength meter and implications, not general decoration.
**Contrast rule, stated explicitly in the real spec:** amber is for fills,
marks, and large/bold type only — never small body text on paper. Use ink or
slate for that.

**Type** — three roles, not two: **Display serif** ("Fraunces", "Newsreader")
for headlines — editorial, not architectural-slab (my first pass used a slab
serif; wrong register). **Body sans** ("Inter Tight", "Geist") — deliberately
quiet, so serif + mono carry the personality. **Mono** ("Geist Mono", "IBM
Plex Mono") for eyebrows, sheet marks, short uppercase labels only, never body
copy.

**Sheet marks** — reuse the real `SheetStrip` convention verbatim: `Project ·
Houses of Thought / Method · Trapasso / Paul–Elder / Rev. A` on the left,
`Sheet NN / Page name` on the right. Don't invent a parallel version.

**Motion** — the hero house draws itself foundation-up, 900ms, one signature
animation per page; everything else is a short eased fade + 12px translate,
staggered 60ms. No bounce, no parallax, no autoplay carousels. Full rules in
[09](09-motion-and-accessibility.md).

**Layout** — 12-column grid, ~1200px max width, hairline rules over shadow,
asymmetric section rhythm (alternate text/visual sides, alternate light/dark
bands) so it never reads as stacked identical slabs. No pill-shaped cards or
buttons (radius caps at 12px).

## Explicitly not this

Glassmorphism. Glowing particle fields. Purple-blue gradients. Stock photos.
A chatbot bubble as the hero image. Five competing accent colors. Emoji as
iconography. Uniform `rounded-2xl` cards with soft shadows everywhere. All
already banned by the real design-language doc, for the same reason I'd have
banned them blind: it's the wallpaper of the category.
