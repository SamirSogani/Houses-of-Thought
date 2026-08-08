# Page: Live Demo (`/try`)

[← Back to index](README.md) · [Sitemap](03-sitemap-and-routes.md)

This is the highest-leverage page on the site — the "real interactive
demo" direction you chose over a scripted or marketing-only version.

## Flow

1. **Entry.** Two or three curated sample questions (varied: personal,
   career, civic) for a zero-typing instant taste, or type your own,
   character-limited. Framed as *one free run* rather than a hard
   paywall, to stay honest about "free."
2. **In progress.** The question moves through the seven houses in
   sequence, each room's output streaming in as it's reasoned through.
   The Inspection room appears last, meaningfully — not replayed in full
   for all seven elements, which would turn a strength into tedium.
   Consider an optional "show full inspection" expandable for visitors
   who want the detail.
3. **Result.** Diagrams, interactive pro-con, and the "what might
   follow" (implications) output — shown in full, free, no gate on the
   value itself.
4. **After the result.** *Save this / ask another / sign up free* —
   gating persistence and repeat use, not the first real result. This is
   the line that keeps "free" honest: nobody hits a paywall at the
   moment they're most convinced.

## Implementation note (not a design blocker)

A real pre-login demo calling the live methodology needs abuse and cost
guardrails — rate limiting, per-session/IP limits — before this gets
built. Flagging it here so it isn't lost; it's an engineering decision
for the build phase, not something this design pass resolves.

## Optional growth idea

A shareable, static "completed house" view of any result (see
[sitemap](03-sitemap-and-routes.md)) turns every demo run into a
potential piece of distribution.
