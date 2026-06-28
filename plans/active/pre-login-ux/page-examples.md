# Page — Examples (`/examples`, `/examples/:slug`)

**Goal:** proof + discoverability. Show real, finished houses so visitors *see* the
output's richness, then funnel to `Try it free`. Replaces the obsolete "Guides".

## Gallery (`/examples`)

### 1. Header
- Eyebrow `SHEET / EXAMPLES`. Display L: *"Reasoning you can actually inspect."*
  Sub: browse complete Houses of Thought across decisions, debates, and classroom
  topics.

### 2. Filter
- `Tabs`/chips by domain: **Decisions · Debate · Classroom · Ethics · Policy**.
  Default "All". Client-side filter; URL param `?topic=`.
- **Tradeoff — filters vs. flat list:** filters help the three audiences self-select
  (a teacher wants Classroom, a debater wants Debate); cost is minor complexity.
  Worth it. Keep categories ≤6.

### 3. Grid of `ExampleCard`s
- Each: question title, domain tag, House Strength badge, small house thumbnail,
  short stance line. `≥lg` 3-col, `md` 2-col, `sm` 1-col.
- Seed with curated houses (e.g. "Should AI be used in schools?", "Should salary
  caps exist in pro sports?", a career decision). Need ≥6 to look credible.

### 4. CTA
- `CTASection`: "Start your own house." `Try it free`.

## Detail (`/examples/:slug`)

A **read-only render of a real house** — the strongest proof we have.

### Layout
- Header: question, domain tag, `StrengthMeter` (Evidence/Logic/Coverage + overall).
- **Perspectives:** grid of `PerspectiveCard`s (stakeholder, stance, N questions,
  mini strength) — mirrors the Collab workspace.
- **Foundational evidence:** list with **citations** (source + year) — the
  anti-hallucination trust signal made tangible.
- **Foundational assumptions:** plain list.
- **Conclusion + Reasoning summary.**
- **Implications:** Positive / Negative / Uncertain columns (semantic colors).
- Sticky sidebar `≥lg`: jump-links to each block + `Try it free`.

### Responsive
- Sidebar → top accordion/jumplinks `<lg`.
- Perspective grid 3→2→1; implication columns stack `<md`.

### Tradeoff
- **Real render vs. marketing mockup:** a faithful render builds far more trust and
  doubles as a QA surface for the actual house data model; cost is needing real
  exportable house data. Strongly recommended over fabricated screenshots.

## A11y
- Citations are real links where possible; strength values are text + bar.
- Implication categories labeled in text, not color alone.
