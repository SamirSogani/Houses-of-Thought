# Pre-Login Redesign — Design Spec

Design-only proposal for a full redesign of Houses of Thought's pre-login
experience. No code has been written against the real app; nothing
post-login or under `/educators` is touched anywhere in this proposal.

**Status: revised.** The first pass was built from the product brief alone,
deliberately without reading the repo. This pass reads `context/`,
`decisions/`, and the existing `plans/active/pre-login-ux/` spec (with
explicit permission) and corrects everything that turned out to be wrong —
the house order most of all. Where the two genuinely conflict rather than
just needing a fact fixed, this version wins per instruction, but the one
real strategic tension (audience emphasis) is flagged, not silently decided.

**Read [10-open-questions.md](10-open-questions.md) first.** Two items are
now resolved (house order, the `housesofthought.org` mystery), two are still
open (Jina AI naming, the shutdown claim), and two are new — most
importantly, **which audience the homepage should visually lead with.**

**Interactive mockup:** [Houses of Thought — Pre-Login Redesign Concept](https://claude.ai/code/artifact/c12b1d39-a47d-4e41-817a-80111ffb6075)
— now using the real 7-layer house, the real color/type tokens, and the real
Mini House result shape instead of my first pass's invented versions. Same
link as before; content has been substantially revised in place. Source:
`mockup.html` in this folder.

## Contents

1. [Positioning & goals](01-positioning-and-goals.md) — why, for whom
   (**the audience flag lives here**), what "done" looks like.
2. [Creative concept: Architecture of Thought](02-creative-concept.md) — now
   reconciled with the real `design-language.md` / `design-tokens.md`.
3. [Sitemap & routes](03-sitemap-and-routes.md) — the real route list.
4. [Page: Home](04-page-landing.md)
5. [Pages: How it works & Framework](05-page-how-it-works.md)
6. [The live demo is `/try`](06-page-live-demo.md) — already real
7. [Pages: Auth & legal](07-page-auth-and-legal.md)
8. [Pages: Our Story & switch-from-Rationale](08-page-about-and-switch.md)
9. [Motion & accessibility principles](09-motion-and-accessibility.md) —
   real tokens
10. [Open questions & flags](10-open-questions.md)

## Two things only you can resolve

- **Audience emphasis** — lead the homepage with the consumer pitch (this
  session's brief) or keep education visually first (the settled strategy)?
  Full context in doc 01 and doc 10, item 8.
- **Where this should live** — this folder overlaps heavily with the
  pre-existing `plans/active/pre-login-ux/`, which the repo's own convention
  says is the right location (`docs/` is repo-docs only, not product specs).
  Doc 10, item 9.
