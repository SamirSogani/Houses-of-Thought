# Page — How It Works (`/how-it-works`)

**Goal:** give a curious-but-unconvinced visitor a digestible mental model of the
build process and the AI's role, then push to `Try it free`. This is the
*approachable* explainer; the exhaustive method lives at `/framework`.

**Primary CTA:** Try it free. **Secondary:** Read the framework · See examples.

## Sections

### 1. Intro header
- Eyebrow `SHEET 02 / HOW IT WORKS`, serif Display L: *"How a House gets built."*
- Sub: one sentence — reasoning flows from a question down to sub-questions, and up
  from evidence to a conclusion you can defend.

### 2. The build flow (anchored walkthrough)
- **Layout:** sticky `HouseDiagram` (interactive) on one side `≥lg`; scrolling
  explanation on the other. As the reader scrolls each step, the matching house
  layer **highlights** (scroll-linked).
- **Steps (5, not 12 — progressive disclosure):**
  1. **Frame it** — purpose, concepts, the overarching question.
  2. **Break it down** — sub-questions from multiple points of view.
  3. **Ground it** — evidence/facts (Research Mode cites real sources).
  4. **Examine it** — assumptions, logical inference, sub-conclusions.
  5. **Conclude & test it** — overarching conclusion, House Strength, Stress Test,
     implications.
- **Tradeoff — 5 grouped steps vs. all 12 layers:** the full model can overwhelm a
  first-timer; grouping keeps it learnable while the diagram hints at the full
  depth. The 12-layer detail is one click away at `/framework`.
- **Mobile:** diagram pinned small at top OR inline per step; steps stack; layer
  highlight becomes a per-step static diagram (no scroll-linking on touch).

### 3. The AI's role — guides, not decides
- **Layout:** two `FeatureRow`s: **What the AI does** (asks sharpening questions,
  surfaces perspectives, finds + cites evidence, stress-tests) vs. **What it
  doesn't** (write your conclusion for you; in classroom/student mode the assistant
  steps back entirely).
- Reinforces Collab = co-reasoning with AI; differentiates from chatbots.

### 4. What you end up with
- Mini `StrengthMeter` + a one-line "publish/export to share or hand in." Sets up
  Examples and the classroom value.

### 5. CTA
- Dark `CTASection`: `Try it free` + `Read the framework`.

## Responsive
- Scroll-linked highlight only `≥lg`; degrade to discrete diagrams on touch.
- Reading column ≤68ch; diagram never horizontal-scrolls.

## A11y
- Scroll-linked highlighting is decorative; each step is fully understandable
  without it (text + its own static diagram state).
