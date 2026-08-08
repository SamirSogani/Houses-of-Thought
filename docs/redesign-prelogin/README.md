# Pre-Login Redesign — Design Spec

Design-only proposal for a full redesign of Houses of Thought's pre-login
experience: everything an unauthenticated visitor sees. No code has been
written against the real app; nothing post-login or under
`/for-educators` is touched anywhere in this proposal.

**Read [10-open-questions.md](10-open-questions.md) first.** It flags a
competitor-name correction and an unverified claim, and notes what was
fixed vs. reverted this round.

**Interactive mockup:** [Houses of Thought — Pre-Login Redesign Concept](https://claude.ai/code/artifact/c12b1d39-a47d-4e41-817a-80111ffb6075)
— a clickable companion to these docs showing the visual direction, the
house/inspection diagrams, and a live-typed run of the demo. Sample
content only; not wired to the real product. Source: `mockup.html` in
this folder.

**New:** [11 — a brainstorm of bold animation/design ideas](11-animation-brainstorm.md),
explicitly not built into anything yet.

## Contents

1. [Positioning & goals](01-positioning-and-goals.md) — why, for whom,
   what "done" looks like.
2. [Creative concept: Architecture of Thought](02-creative-concept.md) —
   the visual/brand direction.
3. [Sitemap & routes](03-sitemap-and-routes.md) — the full route list.
4. [Page: Home](04-page-landing.md)
5. [Page: Method](05-page-how-it-works.md)
6. [Page: Live demo](06-page-live-demo.md)
7. [Pages: Auth & legal](07-page-auth-and-legal.md)
8. [Pages: About & switch-from-Rationale](08-page-about-and-switch.md)
9. [Motion & accessibility principles](09-motion-and-accessibility.md)
10. [Open questions & flags](10-open-questions.md)
11. [Brainstorm: bold animation/design ideas](11-animation-brainstorm.md) — not executed

## Status

The creative direction (palette, type, sitemap, positioning) is the
original first pass — unchanged. A later revision briefly swapped in the
real product's existing design system after reading the repo; that
over-reached what "fix what's inaccurate" meant and has been reverted.
The one thing that actually was wrong — the house diagram's element count
and order — is fixed throughout and in the mockup. The mockup's demo now
takes a typed question instead of only a fixed sample. See doc 10 for the
full account.
