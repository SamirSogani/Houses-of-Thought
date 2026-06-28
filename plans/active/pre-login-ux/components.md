# Component Library

Shared components for the pre-login site. Tokens referenced from
[design-tokens.md](design-tokens.md). Each component lists structure, states,
responsive behavior, and a11y. Pros/cons appear where a choice is non-obvious.

## Hierarchy

```
<SiteShell>
├─ <SheetStrip>            mono metadata bar (top)
├─ <Header> ─ <Logo> <PrimaryNav> <AuthActions> <MobileNavToggle>
├─ <MobileNavSheet>        (lg-)
├─ <main> … page sections …
└─ <Footer> ─ <BlueprintFooter>

Page sections compose primitives:
<Button> <TextLink> <Eyebrow> <SectionHeader>
<Field> (Input/Textarea/Select) <Accordion> <Tabs> <Badge>
<Card> <StepCard> <FeatureRow> <ExampleCard> <CTASection>
<HouseDiagram> <StrengthMeter> <PerspectiveCard> <Quote>
```

## Primitives

### Button
- Variants: `primary` (amber fill, ink text), `secondary` (ink outline on paper),
  `ghost` (text + arrow), `inverse` (paper outline on dark sections).
- Sizes: `md` (default 44px height), `lg` (52px, hero).
- States: default / hover (amber-600 or ink fill) / focus (2px focus ring offset)
  / active (translateY 1px) / disabled (slate-300) / loading (spinner, label kept).
- A11y: real `<button>`/`<a>`; min 44px touch target; never color-only meaning.
- **Tradeoff — one primary style only:** keeps the page calm and the CTA obvious;
  cost is less visual variety, accepted intentionally.

### TextLink / Eyebrow / SectionHeader
- `TextLink`: ink, underline on hover, amber focus ring.
- `Eyebrow`: mono uppercase label (e.g. `SECTION 02 — HOW IT WORKS`).
- `SectionHeader`: Eyebrow + serif heading + optional Body L sub.

### Field (Input / Textarea / Select)
- Paper-0 surface, hairline border, ink text, slate placeholder.
- States: focus (ink border + ring), error (warn border + helper text + `aria-invalid`),
  disabled. Label always visible (no placeholder-as-label).

### Accordion / Tabs / Badge
- `Accordion` (FAQ): button header, chevron, `aria-expanded`, one-or-many open,
  keyboard operable. **Pro** vs. always-open: scannable, less overwhelming;
  **con**: hides content from in-page search → ensure SSR renders answers in DOM.
- `Tabs` (Examples filter, account-type compare): roving tabindex, `role=tablist`.
- `Badge`: mono micro-label (e.g. `IN PROGRESS`, `EVIDENCE 80`); status via
  text+color, never color alone.

## Composite

### Header (see navigation-and-flows.md for behavior)
- `≥lg`: Logo · inline nav (4 items) · `Log in` text + `Try it free` primary.
- `<lg`: Logo · `Try it free` (compact) · hamburger.
- Sticky, condenses on scroll (shrinks padding, adds bottom hairline).

### SheetStrip / BlueprintFooter
- `SheetStrip`: thin mono bar — `PROJECT · HOUSES OF THOUGHT  METHOD · TRAPASSO /
  PAUL–ELDER  REV. A`. Decorative; `aria-hidden`. Hidden `<md`.
- `BlueprintFooter`: `SHEET 99 / FOOTER` mark, logo + one-line descriptor,
  Product / Learn / Legal link columns, copyright. The connective brand device.

### HouseDiagram  ← signature component
- Interactive SVG line-art of a reasoning house; layers bottom→top: Concepts →
  Question → Perspectives (Self/Group/Ideas) → Evidence → Assumptions →
  Conclusion → Implications.
- Modes: `animated` (draws in on view), `static` (reduced-motion / fallback),
  `interactive` (hover/tap a layer → label + one-line definition).
- Props: `data` (layer labels/values), `mode`, `accent`.
- A11y: `role=img` + descriptive `aria-label`; interactive labels also in a
  visually-hidden list; keyboard-focusable layer hotspots.
- **Tradeoff — custom SVG vs. screenshot:** SVG is ownable, themeable, animatable,
  crisp, light; cost is build effort. Chosen — it *is* the brand. Provide a static
  PNG/SVG fallback for email/OG images.

### StrengthMeter / PerspectiveCard
- `StrengthMeter`: Evidence / Logic / Coverage bars + overall "House Strength N".
  Used in Examples + homepage teaser. Semantic colors + numeric labels.
- `PerspectiveCard`: stakeholder name, one-line stance, `N questions`, mini strength.
  Mirrors the real Collab workspace so the marketing matches the product.

### StepCard / FeatureRow / ExampleCard / CTASection / Quote
- `StepCard`: numbered (mono) + serif title + body; used in 3-step explainer.
- `FeatureRow`: alternating text/visual; icon + heading + body + optional link.
- `ExampleCard`: question title, domain tag, strength badge, thumbnail of house.
- `CTASection`: dark band, headline, primary + secondary CTA. Reused on every page.
- `Quote`: editorial pull-quote (origin story, educator testimonial).

## Global responsive rules
- Single column `<lg` for content sections; two-column (text/visual) `≥lg`.
- Tap targets ≥44px; hover-only affordances have tap equivalents.
- Diagrams scale to container; never horizontal-scroll on `sm`.
- Type uses `clamp()` per tokens; no fixed px headings.
