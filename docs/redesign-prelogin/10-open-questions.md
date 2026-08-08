# Open Questions & Flags

[← Back to index](README.md)

Everything here needs your read before any of this ships as real copy or
a real asset. None of it blocked the rest of this design pass — each is
written so the surrounding design holds up either way.

> **Note:** an earlier revision of this whole folder swapped in the real
> product's existing color palette, type system, and sitemap after reading
> the repo — that was a misread of "fix what's inaccurate" and has been
> reverted. The creative direction (Architecture of Thought — brass/
> vellum/blueprint palette, the sitemap, positioning) is back to the
> original. Only the house-diagram content below was actually wrong and
> is still fixed.

## 1. "House of Thought order" — resolved

The real order is **seven** elements, not eight: **Frame → Perspectives →
Evidence → Assumptions → Conclusion → Implications → Review**
(confirmed from the product's own `/framework` page, which calls this
"canonical product vocabulary"). Updated throughout
[02](02-creative-concept.md), [05](05-page-how-it-works.md), and
[06](06-page-live-demo.md), and in the mockup's elevation diagram and demo
progress strip. (An earlier version of this note said the *room names*
were still my proposal, separate from the count — that turned out to be
wrong too. See item 7 below: the names are no longer a proposal at all,
they're just the real layer names.)

## 2. Competitor name: Jina AI, not Gina AI

Unchanged. Public sources (search results, the product's own site at
`rationale.jina.ai`) describe **Rationale by Jina AI** — Jina AI GmbH, an
existing AI infrastructure/search company — not "Gina AI." Likely a
dictation mishearing. I've used "Jina AI" in these docs; flag if you meant
something else.

## 3. Shutdown claim unverified

Unchanged. I could not find any public source confirming Rationale/Jina AI
is shutting down this month, or at all. Not treated as confirmed fact
anywhere in this design; send a source if you have one and
[08](08-page-about-and-switch.md)'s switch-page copy can get sharper.

## 4. `housesofthought.org` — resolved

Confirmed by you: your own first attempt at this project, later revamped,
old domain never excluded from search indexing. Not a competitor, not
Trapasso's own site. No design action needed.

## 5. Monetization model

Unchanged, still open. "Free" is a positioning pillar throughout, but the
sustainability model underneath it is undefined — free forever, freemium
with paid depth, or mission-subsidized. Changes how `/why-free` should
read.

## 6. Live-demo guardrails

Unchanged. The mockup's demo now takes a typed question (not just a fixed
sample) — still a mockup, still not calling a real AI, but worth
restating: a real version of this needs rate-limiting and abuse-prevention
engineering before it's built. Not something this design pass resolves.

## 7. Room-to-element mapping — resolved, no invented names

Took three passes to land. First: wrong count (eight, not seven).
Second: two invented names were themselves wrong ("Wiring" wasn't
grounded in anything real; "Blueprint" collided with the real builder's
name for the whole rail). Third, and this is the actual fix: **stop
naming rooms at all.** The diagram now labels each of the seven callouts
with exactly what the real builder calls it — Frame, Perspectives,
Evidence, Assumptions, Conclusion, Implications, Review — confirmed
against `components/build/layers/` directly. Only the *physical
placement* on the drawing (assumptions at the foundation, implications
in the weather) is still a proposal; the names themselves are just the
real ones now, nothing left to react to on that front.

## 8. Hero question box

The `/try`-style text box now sits directly in the homepage hero, not
just on `/try` — a visitor can type and press Build without an
intermediate "try it free" click. Same box, same behavior, in two
places. See [04](04-page-landing.md) and [06](06-page-live-demo.md).

## 9. Animation brainstorm — mobile/distraction read

Asked to assess [11-animation-brainstorm.md](11-animation-brainstorm.md)
for whether each idea (besides the easter egg) is pliable without
distracting the user, especially on mobile. Full reasoning added inline
in that doc; short version: the closing hand-written question and the
dark-mode atmosphere are low-risk almost anywhere. The scroll-transform,
hover-explode, ink-bleed transitions, drafting cursor, and pannable
diorama all have a specific, real mobile problem (no hover on touch,
scroll/pan gesture conflicts, or per-navigation friction) and need a
mobile-specific fallback, not just a smaller version of the desktop idea.
