# Page: Home (`/`)

[← Back to index](README.md) · [Creative concept](02-creative-concept.md)

A real, detailed spec for this page already exists at
`plans/active/pre-login-ux/page-home.md` (10 sections, tradeoffs included).
This doc doesn't repeat it — it confirms what to keep, flags the one section
order question, and adds the execution layer ("exotic but not confusing")
the original spec didn't fully spec out.

## Keep, as designed

The existing 10-section structure is sound and I'd build on it, not replace
it: **Hero → the problem (chatbot vs. house) → the shift (interactive 7-layer
diagram) → how it works (3 steps) → differentiator band (guided/grounded/
stress-tested) → classroom band → real example teaser → origin credibility →
final CTA → footer.** Hero headline stays *"Build the reasoning, not just the
answer"* — it's already exactly right, don't replace it with something
invented.

Two corrections against my first pass: the interactive diagram in section 3
shows the real seven layers (Frame, Perspectives, Evidence, Assumptions,
Conclusion, Implications, Review), not eight invented rooms — and the "real
example teaser" should use the real data shape (perspectives + sub-questions +
a `StrengthMeter`), not a generic pro/con card.

## The one open call: section order

The existing spec sequences the classroom band (section 6) *after* how-it-
works and the differentiator band — i.e., education gets a real, dedicated
band, but consumer-facing proof leads. That already matches the
consumer-leads-hero direction flagged in
[01-positioning-and-goals.md](01-positioning-and-goals.md). Nothing to change
here unless the audience-emphasis answer comes back the other way — if
education should lead instead, the classroom band likely needs to move up
toward the hero, not just stay as band 6.

## Where "exotic but not confusing" earns its keep

The real design-language doc asks for restraint — one signature animation per
page, hairlines over shadow, a tight palette. That's not in tension with
"exotic": it means concentrating novelty into a few high-craft moments instead
of scattering effects. On this page, that's the hero house draw-in (already
specified, 900ms, foundation→roof) and the interactive layer diagram in
section 3. Everything else should be calm by comparison — the restraint is
what makes those two moments actually land as memorable instead of one more
thing among many.

## Responsive & performance notes (already specified, worth restating)

Lazy-load below-fold diagrams; inline-critical the hero; house SVG as paths,
not raster; mobile collapses the two-column hero to headline → diagram
(capped height) → CTAs.
