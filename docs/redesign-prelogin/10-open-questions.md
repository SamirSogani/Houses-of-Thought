# Open Questions & Flags

[← Back to index](README.md)

Updated after reading `context/`, `decisions/`, and `plans/active/pre-login-ux/`
with permission. Resolved items first, then what's still genuinely open, then
two new flags this reading surfaced.

## Resolved this pass

**1. "House of Thought order" — resolved.** The real, canonical order is
seven layers: **Frame → Perspectives → Evidence → Assumptions → Conclusion →
Implications → Review** (`app/framework/page.tsx`). My first pass's 8-room
guess is replaced throughout — see [02](02-creative-concept.md). No longer
a guess; sourced from the product's own code and docs.

**4. `housesofthought.org` — resolved.** Confirmed by you: your own first
attempt at this project, later revamped, and the old domain was never
excluded from search indexing. Not a competitor, not Trapasso's own site.
No action needed beyond making sure the old domain doesn't confuse anyone
else who searches it — worth a redirect or a takedown at some point, your
call, not a pre-login design concern.

## Still open — need your input or a source

**2. Competitor name: Jina AI, not Gina AI.** Unchanged from my first pass —
public sources (search results, `rationale.jina.ai`) say Jina AI GmbH.
Flag if you meant something else.

**3. Shutdown claim still unverified.** Still no public source confirming
Rationale/Jina AI is shutting down this month or at all.
[08](08-page-about-and-switch.md)'s `/switch-from-rationale` plan still
doesn't depend on this being true, but send a source if you have one and
that page's copy can get sharper.

**5. Monetization model — a little more grounded, still TBD.**
`context/vision/product-strategy.md` confirms "free to start, no hard
paywall pre-login," monetization "likely educator/classroom seats" but
explicitly still undecided. Enough to write `/faq`'s pricing section
honestly; not enough to promise specifics.

## New, from this reading

**8. Audience emphasis — the most consequential open item now.** Covered in
full in [01-positioning-and-goals.md](01-positioning-and-goals.md): the
settled strategy is educator-primary with consumers as a supported second
wave, and this session's brief reads as leaning into that second wave now,
given the timely Rationale opening. I've built this redesign on that reading
— consumer pitch leads the hero, education keeps its real homepage band, not
more. If you actually want education to keep leading visually, several
sections' order changes, starting with the homepage hero.

**9. Where this should live.** `docs/redesign-prelogin/` (this folder) covers
close to the same ground as the existing `plans/active/pre-login-ux/`, which
I didn't know existed when I started. Per this repo's own convention
(`docs/repository/file-structure.md`), product/feature-spec content belongs
in `context/` or `plans/`, not `docs/` — I put this in the wrong place
because I wasn't reading repo-structure docs at all during the first pass.
Options, your call: leave both folders as-is (this one as the current
working direction, the old one as superseded-but-preserved history); merge
this content into `plans/active/pre-login-ux/` in place, replacing what's
outdated there; or something else. I haven't moved anything without asking.

## No longer open

**6. Live-demo guardrails** — dropped. This assumed I was designing a new
demo needing new rate-limiting/abuse engineering. `/try` already exists as
the real, free, no-login builder; that's an already-shipped product decision,
not something this redesign introduces or needs to solve.

**7. Room-to-element mapping** — resolved along with #1; see
[02-creative-concept.md](02-creative-concept.md) for the corrected seven-room
mapping, now sourced rather than invented.
