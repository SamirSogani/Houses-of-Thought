# Brainstorm: Bold Animation & Design Ideas

[← Back to index](README.md)

**Not built. Not in the mockup. A menu to react to.** Everything else in
this folder is a real proposal for the redesign; this doc is the opposite —
deliberately wilder than anything that should ship without your say-so.

**Mobile/distraction read added below**, per your question — honest
verdicts, not a sales pitch for my own ideas. Short version: 5 and 6 and 7
are close to free; the rest need real thought or a mobile-specific
fallback, not just a smaller version of the desktop idea.

## The big swings

1. **Blueprint-to-built scroll.** The whole homepage background is one
   continuous illustration that transforms as you scroll — flat cyan
   line-drawing at the top, fully "constructed" and textured by the
   bottom.
   **Mobile: risky.** Scroll-linked full-page transforms are prone to
   jank on mobile's momentum/inertial scrolling, and a page-sized
   illustration is a real asset/perf cost on a phone connection. Doable
   on desktop with real engineering care; would need a much simpler
   mobile substitute (probably just the hero house draw-in, nothing
   scroll-linked).

2. **Exploded house on hover.** The seven-layer diagram, on hover, blows
   apart into floating isometric pieces, then reassembles.
   **Mobile: doesn't translate.** There's no hover state on a touch
   screen — this is desktop-only as written. A tap-to-expand version
   would work mechanically, but loses most of the spectacle, and the
   explode effect itself is GPU-heavy for low-end phones either way.

3. **A live storm test.** Implications gets more than a static
   illustration — wind, rain, a lightning flash, the structure flexing.
   **Mobile: doable if simplified.** The full cinematic version (real
   weather + visible structural flex) is heavy — battery and perf cost,
   and it delays getting to the actual content. A short, small version
   (a few raindrops, one settle motion, under a second) is fine; the
   elaborate version described isn't, on a phone.

4. **Ink-bleed page transitions.** Every page change looks like ink
   bleeding across parchment to reveal what's underneath.
   **Mobile: risky on repeat use.** A transition animation on *every*
   navigation is exactly the kind of thing that reads as slow by the
   tenth visit — worse on mobile, where people are more impatient about
   perceived load time. Better as one rare, special transition than a
   global default.

## Character & voice

5. **The Inspector makes cameos.** A small hand-drawn figure walks
   across the page at a few key moments only.
   **Mobile: plausible.** Brief, rare, small asset, never blocks
   interaction. One of the safer ideas here as long as it stays
   occasional.

6. **The closing question writes itself.** The reflective question that
   ends a Mini House is drawn as a pen stroke, not typeset.
   **Mobile: plausible — probably the best candidate on this list.**
   Happens once, at a moment the user is already stationary and reading
   (not scrolling or navigating), it's a small lightweight SVG stroke,
   and it reinforces the actual content instead of decorating around it.

## Texture & atmosphere

7. **Dark mode = the drafting table at 2am.** A warm pool of light
   around the content instead of a generic inverted palette.
   **Mobile: plausible, close to free.** This is mostly a static
   lighting/color treatment, not an ongoing animation — negligible
   performance cost, and it doesn't compete for attention the way motion
   does.

8. **A drafting cursor.** Inside diagrams, the cursor becomes a small
   compass/pencil that leaves a brief hand-drawn trail.
   **Mobile: doesn't apply.** No mouse cursor on a touch device, so this
   simply wouldn't render at all — not distracting, just absent. Neither
   a pro nor a con on mobile.

9. **Sound, opt-in only, two sounds total.** A stamp-thud on Inspection
   pass, a pencil-scratch under the hero draw-in.
   **Mobile: low risk, low value.** Off by default, so it can't distract
   anyone who didn't ask for it — but mobile browsing skews toward
   quiet/public contexts, so expect close to zero opt-in there regardless
   of execution quality.

## A stretch idea for `/examples`

10. **An explorable neighborhood, not a card grid.** Published example
    houses scattered across a small pannable blueprint "town."
    **Mobile: risky without a fallback.** Pan/zoom inside an embedded
    canvas is a well-known way to trap a mobile scroll — the "I can't
    scroll past this thing" problem. Needs either a fixed-height,
    clearly-bounded pan area, or a plain grid fallback on small screens
    — not the same interaction just shrunk down.

## A hidden one, if you want it

11. **A stress-test easter egg.** Type "why" anywhere on the site and the
    whole page gives a single honest shake, then settles, with a small
    toast: *"Still standing."* Zero cost to the real UX since it's
    hidden; pure delight for whoever finds it. (Not covered by the
    mobile question above, per your note.)

---

Tell me which of these (if any) earn a real design pass — happy to spec
any of these properly, with the actual "not confusing" guardrails
applied, once you've picked.
