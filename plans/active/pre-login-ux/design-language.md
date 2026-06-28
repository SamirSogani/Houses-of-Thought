# Design Language

The visual identity and the reasoning behind it. Concrete values live in
[design-tokens.md](design-tokens.md); this doc is the *why*.

## Thesis: "Architectural Blueprint × Editorial"

The product is literally about **building houses of reasoning**. The existing
material already leans into a drafting/blueprint identity — "INTELLECTUAL
BLUEPRINT · EST. 2026", "SHEET 01 / HOME", "PROJECT · METHOD · REV. A". We
systematize and elevate that rather than invent a new look. It reads as
*considered, rigorous, made by someone who cares* — the antidote to a generic
AI-wrapper aesthetic.

Two forces held in tension:
- **Blueprint** = structure, rigor, precision (mono labels, line art, grid, sheet marks).
- **Editorial** = ideas, humanity, readability (serif headlines, generous prose, warmth).

Blueprint earns credibility; editorial keeps it from feeling cold. Every page
should carry both.

## What "vibecoded" looks like — and our rules against it

Anti-patterns we explicitly avoid:

- Purple/indigo gradient hero, gradient "blobs," glassmorphism.
- Default component-library look (uniform `rounded-2xl` cards + soft shadows everywhere).
- Inter/system font for *everything*; no typographic hierarchy.
- Emoji as iconography; AI-stock imagery; floating 3D blobs.
- Centered-everything layouts with identical section rhythm.
- Five accent colors and three CTA styles competing.

Our counter-rules:

1. **Type does the work**, not effects. Hierarchy from a real type system.
2. **One accent color.** Amber for primary action and key marks only.
3. **Line and grid over shadow and blur.** Borders (hairlines) define structure.
4. **Asymmetry and editorial spacing**, not stacked centered slabs.
5. **Bespoke house line-art**, never stock or emoji.
6. **Consistent drafting metadata** (sheet numbers, rev marks) as connective tissue.

**Tradeoff:** this restraint can feel austere. We add warmth through paper-toned
backgrounds, conversational copy, real student-relevant examples, and one
expressive moment per page (usually the animated house).

## Typography

Three-role system:

- **Display / headlines — refined serif** (e.g. *Fraunces* or *Newsreader*).
  Pro: editorial gravitas, distinctive, "thinking/journal" association.
  Con: wrong serif reads dated or stuffy → choose a contemporary serif with
  optical sizing; keep weights ≤ 2.
- **Body / UI — humanist grotesque sans** (e.g. *Inter Tight* or *Geist*).
  Pro: neutral, legible, modern. Con: ubiquitous → we let serif + mono carry
  personality so the sans can stay quiet.
- **Labels / metadata — monospace** (e.g. *Geist Mono* / *IBM Plex Mono*).
  The blueprint annotations (`SHEET 01`, `REV. A`, section eyebrows). Pro:
  instantly signals "technical/structured." Con: low legibility at length → mono
  is for short uppercase labels only, never body copy.

Pairing rule: serif headline + mono eyebrow + sans body, per section.

## Color

- **Ink Navy** — primary text, dark sections, the house line-art on light.
- **Paper** — warm off-white page background (not pure white).
- **Amber** — single accent: primary buttons, active marks, the "drawn" house highlight.
- **Graphite/Slate** — secondary text, hairlines, mono labels.
- **Blueprint Blue** — sparing secondary accent for diagram/technical contexts.
- Semantic (success/warn/uncertain) reserved for the strength meter + implications.

Pro of a tight palette: calm, premium, unmistakably intentional. Con: less
playful → the amber and the house animation provide the energy.

Dark sections (hero band, final CTA, footer) invert to Ink Navy ground with Paper
text and amber accent — echoing the existing "Stop guessing" dark band.

## Layout & grid

- **12-column grid**, generous outer margins, a max content width (~1200px).
- **Visible structure**: hairline rules, a persistent top "sheet" strip and a
  blueprint footer tie pages together.
- **Asymmetry**: alternate text/visual sides; vary section rhythm so it doesn't
  feel like stacked slabs.
- **Baseline rhythm** via the spacing scale for vertical calm.

Tradeoff: visible grid/annotation can feel busy → keep annotations small, muted,
and consistent so they become texture, not noise.

## Motion

Architectural, precise, restrained:

- The hero house **draws itself** foundation-up (strokes animate in).
- Layers/sections reveal on scroll with short, eased fades + small translate.
- No bounce, no parallax overload, no autoplay carousels.
- **Respect `prefers-reduced-motion`**: render the final state immediately.

Pro: motion *demonstrates* "reasoning builds from the ground up." Con: overdone
animation = vibecoded and slow → strict durations/easings in tokens, one signature
animation per page.

## Imagery, icons, voice, a11y

- **Imagery:** bespoke line-art (house, layers, perspectives). No stock/AI photos.
- **Icons:** single-weight line icons matching the line-art; the small house mark
  is the logo.
- **Voice:** plain, confident, a little wry ("for decisions that deserve more than
  a chat reply"). Short sentences. No hype, no emoji.
- **Accessibility:** WCAG AA contrast (verify amber-on-paper for text — use Ink
  for body, amber for large/bold or backgrounds only); visible focus rings;
  full keyboard nav; semantic landmarks; alt/ARIA for the diagram.
