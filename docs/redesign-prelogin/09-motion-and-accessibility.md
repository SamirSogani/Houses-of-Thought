# Motion & Accessibility Principles

[← Back to index](README.md) · [Creative concept](02-creative-concept.md)

## Motion rules

1. **Physical metaphor only.** Every animation corresponds to something a
   visitor already understands physically — a door, a drawn line, a
   stamp, a foundation settling, weather passing. No abstract particle or
   glow effects.
2. **Never blocking.** Decorative animation runs independently of task
   completion. Forms, buttons, and the demo's own submit action are
   always usable immediately, animation or not.
3. **Always skippable.** Any animation longer than ~1.5s gets a visible
   skip, or simply doesn't gate anything the visitor needs.
4. **Respect `prefers-reduced-motion`.** Every signature animation has a
   static or simple-crossfade fallback that loses zero information — the
   door-opening becomes a cut, the blueprint stroke-draw becomes an
   instant reveal.
5. **Text equivalents.** Anything communicated primarily through motion
   (e.g., the Inspection loop) also gets a plain-text label. Motion
   illustrates; it never is the only carrier of meaning.
6. **Performance budget.** Prefer lightweight SVG/CSS animation over
   video or canvas-heavy effects, especially for the mobile-first
   audience this product is built for.

## Accessibility

- WCAG AA contrast minimum, checked against the warm/architectural
  palette specifically (parchment backgrounds + cyan ink can drift out of
  range if not tuned deliberately).
- Full keyboard navigability, including every step of the `/try` demo
  flow.
- Semantic structure (headings, landmarks, labeled form fields) under
  every animated layer — the illustration is decoration on top of a
  normal, accessible document, not a replacement for one.

## Responsive approach

Mobile-first, given the product's own origin story ("use it anywhere, on
the go"). The isometric house/room scene is the desktop expression of the
[creative concept](02-creative-concept.md); on small screens it collapses
to a vertical, scrollable "walk-through" rather than a shrunk-down wide
scene.
