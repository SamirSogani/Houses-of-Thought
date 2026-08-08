# Positioning & Goals

[← Back to index](README.md)

> Corrected after reading `context/`, `decisions/`, and `plans/active/pre-login-ux/`
> (with permission, this session). Where this contradicts that earlier material,
> this version wins, per instruction — but audience emphasis (below) is flagged,
> not silently overridden.

## The real north star (already written, reused verbatim)

> Houses of Thought helps you build the reasoning, not just the answer. Where a
> chatbot hands you a verdict, we help you build — and defend — the thinking
> behind it.

## Why this redesign, now

Houses of Thought is pushing harder on being a free, standalone alternative to
paid AI decision-making tools — timed to Rationale (by Jina AI, not "Gina")
reportedly winding down. See [10-open-questions.md](10-open-questions.md) for
what's still unverified there.

## Audience — the thing that most needs your steer

The settled strategy (`decisions/001`, `decisions/007`) is explicit and was
decided twice, deliberately:

- **Primary: educators (teacher-led), students as end-users.** Distribution is
  viral (teacher → class → colleagues), low CAC, and the Trapasso/Paul-Elder
  lineage is exactly the credibility educators look for.
- **Secondary, "supported, not the headline": individual decision-makers.**

But `decisions/007` also states the resolving principle plainly: *"the 7-layer
house is a general-purpose reasoning framework, not a school feature... only
the surrounding packaging is classroom-specific,"* and, in so many words,
**classrooms are the wedge, not the ceiling — "anyone making a hard decision"
is the actual market.**

Your brief this session — beat a shutting-down *consumer* decision tool — reads
as accelerating into that already-planned second wave, not contradicting the
first one. That's the assumption this redesign runs on: **education keeps its
real homepage presence (the existing spec gives it a full band, not just a nav
link), but the consumer pitch now leads the hero and the top of the funnel,**
rather than trailing behind an education-first pitch as the original spec had
it.

**Say if that's not the read.** If education should still visually lead —
homepage hero framed at teachers first, consumer positioning secondary — that's
a different hero, different opening section order, and worth knowing before
more of this gets built out.

## Positioning pillars

1. **Real methodology, not a prompt trick.** Paul-Elder's published framework,
   structured by a working teacher's classroom model (John Trapasso's House of
   Reason) — not "a chatbot wrapped in a nicer UI."
2. **AI that guides, not decides.** The product's actual, protected
   differentiator (a prior feature — an AI that auto-wrote the whole house —
   was deliberately removed for contradicting this). The AI questions,
   sources evidence, and stress-tests. It never authors your conclusion.
3. **Free to start, no pre-login paywall.** The front door is a real no-login
   builder (`/try`), not a locked demo. Monetization is likely educator/
   classroom seats later — still TBD, and not a pre-login concern.
4. **Rigor without the homework.** The intellectual foundation is academic;
   the experience should still feel built for a phone in your pocket at 11pm.

## What "done" looks like

- A first-time visitor understands "this is reasoning, not a chatbot answer"
  within one screen.
- A visitor can run a real Mini House on their own question, no account, and
  see it hold up — sourced evidence, real perspectives, no fabricated verdict.
- Educators still find their dedicated path fast; nothing about their existing
  page or funnel gets worse.
- Nobody describes the motion/graphics as confusing — "memorable" and "clear"
  stay non-negotiable together.

## Explicit non-goals

- Not touching anything post-login.
- Not touching `/educators` or its content.
- Not changing the reasoning methodology, the AI's posture, or `/try`'s actual
  behavior — presentation and marketing surface only.
- Not shipping code yet — this pass is design only.
