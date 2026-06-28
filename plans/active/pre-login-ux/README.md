# Pre-Login UX Specification

Complete UX spec for the **logged-out** Houses of Thought website. Detailed enough
to implement without further clarification. No application code is defined here —
this is the design contract the build follows.

## North star

> Houses of Thought helps you **build the reasoning, not just the answer.**
> Where a chatbot hands you a verdict, we help you build — and defend — the
> thinking behind it.

Primary audience: **educators (teacher-led), students as end-users.** Secondary:
individual decision-makers, debate students. The public front door is a **free,
no-login builder**; the conversion event is "save your work → create an account."

## How this spec is organized

| Doc | Covers |
|---|---|
| [design-language.md](design-language.md) | Visual identity, rationale, anti-"vibecoded" rules |
| [design-tokens.md](design-tokens.md) | Concrete color/type/spacing/motion/breakpoint tokens |
| [components.md](components.md) | Shared component library, hierarchy, states, responsive |
| [navigation-and-flows.md](navigation-and-flows.md) | Header/footer, mobile nav, routing, user flows, CTAs |
| [page-home.md](page-home.md) | Homepage, section by section |
| [page-how-it-works.md](page-how-it-works.md) | How It Works |
| [page-for-educators.md](page-for-educators.md) | Classrooms / educator landing |
| [page-examples.md](page-examples.md) | Examples gallery + detail |
| [page-try-and-auth.md](page-try-and-auth.md) | No-login builder front door + sign-up/login |
| [pages-content.md](pages-content.md) | Framework, FAQ, Our Story, Contact, Legal |

## Global UX principles

1. **Show, don't tell.** Lead with an interactive/visual house, not paragraphs.
2. **Progressive disclosure.** The homepage teases; depth lives on dedicated pages.
3. **One promise, one primary CTA per screen.** Avoid feature overload.
4. **Earn trust visibly.** Cited evidence, real examples, framework lineage.
5. **Low-friction front door.** "Try it free" needs no account; saving does.
6. **Professional, not "vibecoded."** See the anti-pattern list in design-language.

## Key design bets (with tradeoffs)

| Bet | Pro | Con / Risk | Mitigation |
|---|---|---|---|
| **"Architectural blueprint × editorial" identity** (extends existing "Intellectual Blueprint" cues) | Distinctive, ownable, signals rigor; opposite of generic SaaS | Can read cold/intimidating, esp. for students | Warm paper tones, human copy, friendly examples |
| **Serif display + sans body + mono labels** | Editorial gravitas, memorable, on-brand | Needs careful pairing or looks dated | Specified typefaces + fallbacks in tokens |
| **Single confident accent (amber)** | Calm, premium, not vibecoded | Less "energetic" than multi-color | Use accent only for primary action + key marks |
| **Interactive house demo as hero** | Strongest possible hook; proves the product | Build cost, perf, a11y | Static SVG fallback; reduced-motion path |
| **No-login try-it as front door** | Removes signup friction; teachers can evaluate | Local-only work can be lost | Persistent "save → account" prompt |
| **Dedicated For Educators page + nav** | Serves the primary wedge with focus | Adds nav weight | Keep top nav to 4 items |

## Out of scope / assumptions

- **Logged-in app** (dashboard, Collab builder internals, profile, classroom
  management) is out of scope here; we only design the public shell + the
  no-login *try* surface and the auth handoff.
- Free to start; no hard paywall pre-login. "Pricing" folded into FAQ for now.
- Stack assumed React/Next-style + Supabase auth. Final component code TBD.
- Canonical brand name: **Houses of Thought** (retire "House of Reason" except as
  a one-line historical note).
- Strategy rationale lives in this spec's decisions; if a standalone
  `context/vision/product-strategy.md` is later created, link it here.
