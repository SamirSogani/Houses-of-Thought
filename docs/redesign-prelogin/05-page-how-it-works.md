# Pages: How It Works & Framework

[← Back to index](README.md) · [Creative concept](02-creative-concept.md)

Two real, distinct pages, per `plans/active/pre-login-ux/pages-content.md` —
don't collapse them into my originally-invented single `/method` page.

## `/how-it-works` — the approachable version

**Job:** convert, not educate exhaustively. Three steps, already well-specced:

1. **Ask a question worth reasoning about.** A decision, a topic, an essay.
2. **Explore perspectives and evidence.** AI guides with questions and cites
   real sources (Research Mode) — it won't write your conclusion.
3. **Reach a conclusion you can defend.** A House Strength score across
   Evidence / Logic / Coverage; stress-test it before reality does.

Ends with a CTA into `/try`. Keep this page short — its whole job is to move
people to the real thing, not to be the exhaustive reference.

## `/framework` — the exhaustive version (already written, genuinely good)

`app/framework/page.tsx` already has complete, well-written copy for all
seven layers plus House Strength, Research Mode, and Learn/Decide — sticky
table-of-contents, `DefinedTermSet` JSON-LD for AEO, attributed to Trapasso
and Paul-Elder, credited to Samir Sogani. **This doesn't need new content,
just the visual system applied consistently** (sheet mark, type system,
hairline rules, one small inline diagram highlight per layer as the spec
already calls for).

One line worth keeping verbatim, already on the page and better than anything
I'd draft new: *"In Houses of Thought the conclusion is always yours: the AI
can question it and stress-test it, but it never writes it."*

## Design notes for both

- Long-form reading column ≤68ch, sticky ToC ≥`lg`, top accordion below it.
- Mono eyebrow per section names the layer ("Layer 4 · Assumptions") — reuse
  this pattern, don't invent a parallel labeling scheme.
- If `/framework` copy ever exceeds ~200 lines, split per the constitution —
  not a concern yet.
