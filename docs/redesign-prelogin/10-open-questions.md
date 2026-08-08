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
progress strip. The room *names* (Blueprint, Windows, Materials Yard,
Foundation, Wiring, Weather, Inspection) are still my proposal, not
confirmed Trapasso pedagogy — just the count and grouping were the actual
error.

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

## 7. Room-to-element mapping — checked against the real builder

The Site Plan / Windows / Materials Yard / Foundation / Ridge Beam /
Weather / Inspection mapping in [02](02-creative-concept.md) is still my
proposal for the visual system, but two names in it were wrong, not just
proposed-and-pending: "Wiring" wasn't grounded in anything real, and
"Blueprint" is already the real name for the whole rail/house in the
actual builder (`components/build/BlueprintRail.tsx`), not one room —
reusing it for a single room would've collided with real product
vocabulary the moment this ships next to the real app. Fixed with your
permission to check `components/build/layers/` and `BlueprintRail.tsx`
directly. The remaining five room names have no such collision and are
still just my proposal, open to your reaction.

## 8. Hero question box

The `/try`-style text box now sits directly in the homepage hero, not
just on `/try` — a visitor can type and press Build without an
intermediate "try it free" click. Same box, same behavior, in two
places. See [04](04-page-landing.md) and [06](06-page-live-demo.md).
