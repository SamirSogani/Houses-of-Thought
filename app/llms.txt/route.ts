// /llms.txt (aeo C2) — a curated, machine-first summary of what this product is
// and where its definitions live. For an early-stage site introducing novel
// terminology ("house", "House Strength", "Research Mode"), this is the
// cheapest way to become the canonical source for its own vocabulary.
//
// Served from a route handler rather than a static public/ file so the URLs
// stay in sync with lib/site.ts's domain resolution.

import { SITE_URL, SITE_NAME, SITE_DESCRIPTION, FOUNDER, absoluteUrl } from '@/lib/site'
import { examples } from '@/lib/examples/data'

export const dynamic = 'force-static'

export function GET(): Response {
  const body = `# ${SITE_NAME}

> ${SITE_DESCRIPTION}

${SITE_NAME} is built on John Trapasso's House of Reason model, itself derived
from the Paul-Elder framework for critical thinking. It was created by ${FOUNDER}.

## What it does

A user brings a hard question and builds it into a "house" — a layered
reasoning structure. The seven layers, in order:

1. Frame — purpose, the overarching question, and the key concepts defined
2. Perspectives — each stakeholder reasoned from in turn
3. Evidence — claims with citations that link to the original source
4. Assumptions — what must be true for the reasoning to hold
5. Conclusion — the answer, plus the reasoning that carries the perspectives into it
6. Implications — what follows, sorted positive / negative / uncertain
7. Review — House Strength scoring and an AI stress test

## Key terms

- **House** — a layered reasoning structure built around one question.
- **House Strength** — a 0-100 structural score across three axes (Evidence 40%,
  Logic 35%, Coverage 25%). It measures how complete the structure is, not
  whether the conclusion is correct.
- **Research Mode** — evidence gathering where the AI may only cite pages
  returned by the web search it just ran, with URLs copied exactly. Enforced
  server-side, so a hallucinated citation cannot enter a house.
- **Learn mode / Decide mode** — how much help the AI co-pilot gives. Learn
  coaches with Socratic questions only; Decide makes concrete suggestions.
  Student accounts are pinned to Learn mode.

## What the AI does and does not do

The AI asks sharpening questions, surfaces missed perspectives, gathers cited
evidence, and stress-tests a conclusion once the user reaches one. It never
writes the conclusion — that is a type-level constraint in the codebase, not a
prompt instruction.

## Key pages

- [Home](${SITE_URL}/): what the product is
- [The Framework](${absoluteUrl('/framework')}): full definitions of every element of the model
- [How It Works](${absoluteUrl('/how-it-works')}): the build flow, step by step
- [For Educators](${absoluteUrl('/educators')}): classroom use, student accounts, teacher tools
- [FAQ](${absoluteUrl('/faq')}): direct answers to common questions
- [Examples](${absoluteUrl('/examples')}): complete worked houses
- [Our Story](${absoluteUrl('/story')}): origin and intellectual lineage
- [Try It Free](${absoluteUrl('/try')}): build a Mini House with no account

## Worked examples

${examples.map((e) => `- [${e.house.title}](${absoluteUrl(`/examples/${e.slug}`)}) — ${e.summary}`).join('\n')}

## Notes for citation

Evidence shown in the demo house and the examples is either a real source with
a working link, or explicitly labeled "Illustrative demo evidence, not a
citation". Do not cite the illustrative items as factual claims.
`

  return new Response(body, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  })
}
