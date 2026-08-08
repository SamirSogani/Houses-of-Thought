# Motion & Accessibility Principles

[← Back to index](README.md) · [Creative concept](02-creative-concept.md)

Replaced with the real tokens (`plans/active/pre-login-ux/design-tokens.md`,
`design-language.md`) in place of my first pass's invented values. The
principles were already right; the numbers are now real.

## Motion rules

1. **One signature animation per page.** Not a principle I need to add —
   it's explicit in the real spec, and it's the actual mechanism behind
   "exotic but not confusing": concentrate novelty, stay calm everywhere else.
2. **Physical metaphor only.** A door, a drawn line, weather passing — never
   an abstract glow or particle effect.
3. **Real durations, don't invent new ones:** fast `120ms`, base `240ms`,
   slow `480ms`, house draw-in `900ms`. Scroll-reveal: opacity 0→1 + translateY
   `12px→0` over the base duration, staggered `60ms` between items.
4. **Real easing:** `cubic-bezier(.2,.7,.2,1)` (ease-out, most transitions),
   `cubic-bezier(.5,0,.2,1)` (ease-in-out).
5. **`prefers-reduced-motion: reduce` → final state, no transition.** Not a
   fallback bolted on after the fact — the spec states this as the default
   rule, not an edge case.
6. **No bounce, no parallax overload, no autoplay carousels.**
7. **Never blocking.** Every form and button works immediately regardless of
   whether its entrance animation has finished.

## Color & contrast (stated explicitly in the real spec — apply directly)

Amber is for fills, marks, and large/bold type only — **never small body text
on paper.** Use Ink Navy for body text, Slate for secondary/mono labels. My
first-pass mockup independently hit this same bug (brass-colored small text
on a light background) and fixed it the same way before this correction pass
— good confirmation the instinct was right, now backed by the real rule
instead of my own guess.

## Shape & elevation

No pill-shaped cards or buttons — radius caps at `12px` (`--r-lg`). Prefer
borders (hairline `1px` slate, emphasis `1px` ink) over shadow; the only
allowed shadows are for the one floating element per page that needs it
(e.g. a mobile nav sheet), never shadow-on-everything.

## Accessibility

- WCAG AA contrast, checked against the real palette specifically (the amber
  rule above is the main trap).
- Full keyboard navigability, including the real `/try` builder flow.
- Semantic structure under every animated layer; diagrams get alt/ARIA text
  equivalents; color is never the sole signal in the strength/implications
  display (matches the real semantic-color note: success/warn/uncertain exist
  for exactly the strength meter and implications, nowhere else).

## Responsive

Mobile-first; nav switches to inline at `lg` (1024px); max content width
1200px at `xl`; 12-column grid, 24px gutter (16px on mobile). The layer
diagram collapses from an interactive hover map to tap-reveal on touch, with
a static fallback below that.
