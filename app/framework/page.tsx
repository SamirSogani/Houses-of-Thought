// /framework — the definitional hub for the method (pre-login-ux
// pages-content.md). The exhaustive companion to /how-it-works: every element
// of the full Trapasso / Paul–Elder model, one concise block each, mapped onto
// the builder's seven layers so marketing, the Mini House, and the workspace
// all resolve to one vocabulary. This page is also the canonical citation
// target for the framework's terms (aeo H1), hence the DefinedTermSet JSON-LD.

import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/site'
import Link from 'next/link'
import Header from '@/components/Header'
import SheetStrip from '@/components/SheetStrip'
import Footer from '@/components/sections/Footer'
import CTASection from '@/components/sections/CTASection'

export const metadata: Metadata = {
  ...pageMetadata({
    title: 'The Framework',
    description:
      'Every element of the Houses of Thought framework: concepts, purpose, the overarching question, perspectives, evidence, assumptions, inference, conclusions, and implications — based on John Trapasso\u2019s House of Reason, derived from the Paul\u2013Elder model for critical thinking.',
    path: '/framework',
    ogTitle: 'The Houses of Thought Framework',
  }),
  // `absolute`: the brand name is already in this title.
  title: { absolute: 'The Houses of Thought Framework: the full model, layer by layer' },
}

// One entry per element of the full model. `layer` is the builder layer the
// element lives in (the 7-layer names are canonical product vocabulary).
const elements: { id: string; name: string; layer: string; body: string; detail?: string }[] = [
  {
    id: 'concepts',
    name: 'Concepts',
    layer: 'Layer 1 · Frame',
    body: 'The load-bearing terms the whole question turns on, each pinned to a working definition before any arguing starts. Two people can argue for an hour about "fairness" while meaning different things; defining concepts first makes later disagreement useful instead of circular.',
  },
  {
    id: 'purpose',
    name: 'Purpose',
    layer: 'Layer 1 · Frame',
    body: 'Why this question is worth reasoning about, and for whom. The purpose sets the standard the final conclusion has to meet — a decision you must defend to a school board needs different rigor than a private judgment call.',
  },
  {
    id: 'overarching-question',
    name: 'Overarching Question',
    layer: 'Layer 1 · Frame',
    body: 'The single question the house exists to answer, stated precisely enough that you would recognize an answer if you saw one. Vague questions produce vague houses; sharpening the question is often half the work.',
  },
  {
    id: 'sub-questions',
    name: 'Sub-Questions',
    layer: 'Layer 2 · Perspectives',
    body: 'The smaller questions the overarching question decomposes into, usually raised by a specific perspective. Each sub-question is small enough to be answered with evidence, and the answers accumulate into the larger case.',
  },
  {
    id: 'points-of-view',
    name: 'Points of View (Perspectives)',
    layer: 'Layer 2 · Perspectives',
    body: 'The stakeholders the question touches, each reasoned from in turn: what this group values, fears, and would say if they were in the room. Reasoning that survives only inside one perspective is not a conclusion, it is a preference.',
    detail:
      'Your own Personal Foundational Point of View belongs here too — the commitments and priors you bring to the question. Naming it is what lets you check whether the conclusion merely flatters it.',
  },
  {
    id: 'information',
    name: 'Information & Facts (Evidence)',
    layer: 'Layer 3 · Evidence',
    body: 'Claims with sources attached. In the builder, every evidence card carries its citation, and Research Mode can only cite sources it actually retrieved — the AI cannot attach a link it did not just find. Unsourced claims are allowed, but they are visibly unsourced and score accordingly.',
  },
  {
    id: 'assumptions',
    name: 'Assumptions',
    layer: 'Layer 4 · Assumptions',
    body: 'What has to be true for the reasoning to hold, stated out loud. Most bad conclusions fail here, in premises nobody wrote down. The model also asks after unknown unknowns: the assumption you have not noticed you are making, which is why the co-pilot probes this layer hardest.',
  },
  {
    id: 'inference',
    name: 'Logical Inference',
    layer: 'Layer 5 · Conclusion',
    body: 'The path from evidence and assumptions to a claim — the "therefore". An inference is inspectable: someone who accepts your evidence and assumptions should be able to follow the step. If they cannot, the gap is the work remaining.',
  },
  {
    id: 'sub-conclusions',
    name: 'Sub-Conclusions',
    layer: 'Layer 5 · Conclusion',
    body: 'The intermediate answers to sub-questions, settled before the final conclusion is attempted. They keep the last step small: a strong house arrives at its conclusion, it does not leap there.',
  },
  {
    id: 'overarching-conclusion',
    name: 'Overarching Conclusion',
    layer: 'Layer 5 · Conclusion',
    body: 'The answer to the overarching question, plus the reasoning summary that carries the perspectives into it. In Houses of Thought the conclusion is always yours: the AI can question it and stress-test it, but it never writes it.',
  },
  {
    id: 'implications',
    name: 'Implications vs. Consequences',
    layer: 'Layer 6 · Implications',
    body: 'What follows if the conclusion holds. Implications are what the conclusion logically commits you to; consequences are what happens in the world when you act on it. The builder sorts them into positive, negative, and uncertain, each tagged with who bears it and on what horizon.',
  },
  {
    id: 'iteration',
    name: 'Iterative Thinking',
    layer: 'Layer 7 · Review',
    body: 'A house is not finished when the conclusion is written; it is finished when it has been attacked and revised. The Review layer scores House Strength, lists what would raise it, and the Stress Test argues against you. Rebuilding a layer after review is the method working, not the method failing.',
  },
]

const scoring: { id: string; name: string; body: string }[] = [
  {
    id: 'house-strength',
    name: 'House Strength',
    body: 'A structural score from 0 to 100 across three axes — Evidence (how much of the house is backed by sourced facts), Logic (whether assumptions are surfaced and implications traced), and Coverage (the range of perspectives accounted for). It measures how complete the structure is, not whether the conclusion is correct: a well-built house for a conclusion you reject still scores well, and that is by design.',
  },
  {
    id: 'research-mode',
    name: 'Research Mode',
    body: 'The evidence-gathering mode. The AI runs a real web search and may only cite pages returned by that search, with URLs copied exactly — enforced server-side, so a hallucinated citation cannot enter the house. Every source chip links to the original.',
  },
  {
    id: 'learn-decide',
    name: 'Learn & Decide modes',
    body: 'How much help the co-pilot gives. In Decide mode it makes concrete suggestions you can accept into the house. In Learn mode it coaches with Socratic questions and never hands over content — student accounts are pinned to Learn mode.',
  },
]

const tocItems = [
  { href: '#what-it-is', label: 'What the framework is' },
  ...elements.map((e) => ({ href: `#${e.id}`, label: e.name })),
  ...scoring.map((s) => ({ href: `#${s.id}`, label: s.name })),
]

// DefinedTermSet JSON-LD: makes the glossary machine-legible so answer engines
// can resolve "House Strength", "Research Mode", etc. to this page (aeo H2).
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'DefinedTermSet',
  name: 'Houses of Thought framework glossary',
  description:
    'Definitions of the elements of the Houses of Thought reasoning framework, based on John Trapasso’s House of Reason and the Paul–Elder model for critical thinking.',
  hasDefinedTerm: [...elements, ...scoring].map((t) => ({
    '@type': 'DefinedTerm',
    name: t.name,
    description: t.body,
  })),
}

const blockTitle: React.CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontWeight: 500,
  fontSize: 24,
  letterSpacing: '-0.01em',
  color: 'var(--ink)',
}

const blockBody: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontSize: 16,
  lineHeight: 1.65,
  color: 'var(--ink-mid)',
  marginTop: 10,
}

export default function FrameworkPage() {
  return (
    <>
      <Header />
      <SheetStrip sheet="Sheet 05 / Framework" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main id="main">
        <section style={{ background: 'var(--parchment)', paddingBlock: 'clamp(40px, 6vw, 80px)' }}>
          <div className="container">
            <p className="eyebrow">The Framework</p>
            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 500,
                fontSize: 'clamp(32px, 5vw, 52px)',
                letterSpacing: '-0.015em',
                lineHeight: 1.12,
                color: 'var(--ink)',
                marginTop: 16,
                maxWidth: '24ch',
              }}
            >
              The full model, element by element.
            </h1>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 17, lineHeight: 1.6, color: 'var(--ink-mid)', marginTop: 16, maxWidth: '62ch' }}>
              This is the exhaustive companion to{' '}
              <Link href="/how-it-works" className="text-link">How it works</Link>. Based on John
              Trapasso&rsquo;s House of Reason, derived from the Paul&ndash;Elder framework for
              critical thinking; built into software by Samir Sogani.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 48, alignItems: 'flex-start', marginTop: 48 }}>
              {/* Sticky ToC ≥lg; static above the article on narrow screens
                  (same responsive pattern as the example detail aside). */}
              <aside className="mk-example-aside" style={{ flex: '1 1 200px', maxWidth: 240, position: 'sticky', top: 84 }}>
                <p className="mono" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.11em', color: 'var(--ink-subtle)' }}>
                  On this page
                </p>
                <nav style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 12 }}>
                  {tocItems.map((t) => (
                    <a key={t.href} href={t.href} style={{ fontFamily: 'var(--font-body)', fontSize: 13.5, color: 'var(--ink-mid)', padding: '3px 0' }}>
                      {t.label}
                    </a>
                  ))}
                </nav>
              </aside>

              <article style={{ flex: '999 1 520px', minWidth: 0, maxWidth: '68ch' }}>
                <section id="what-it-is">
                  <h2 style={blockTitle}>What the framework is</h2>
                  <p style={blockBody}>
                    Houses of Thought is a method for building structured, defensible reasoning. You
                    work a hard question into a <strong style={{ color: 'var(--ink)' }}>house</strong>:
                    a layered structure where concepts and the question form the foundation,
                    perspectives, evidence, and assumptions form the walls, and the conclusion with
                    its implications forms the roof. Each layer rests on the ones below it, so a weak
                    layer is visible instead of buried.
                  </p>
                  <p style={blockBody}>
                    The builder walks these elements as seven layers:{' '}
                    <strong style={{ color: 'var(--ink)' }}>
                      Frame, Perspectives, Evidence, Assumptions, Conclusion, Implications, Review
                    </strong>
                    . Every element below names the layer it lives in.
                  </p>
                </section>

                {elements.map((e) => (
                  <section key={e.id} id={e.id} style={{ marginTop: 40 }}>
                    <p className="mono" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.11em', color: 'var(--amber-text)' }}>
                      {e.layer}
                    </p>
                    <h2 style={{ ...blockTitle, marginTop: 8 }}>{e.name}</h2>
                    <p style={blockBody}>{e.body}</p>
                    {e.detail && <p style={blockBody}>{e.detail}</p>}
                  </section>
                ))}

                <hr style={{ border: 'none', borderTop: '1px solid var(--rule)', margin: '48px 0' }} />

                <h2 style={blockTitle}>Scoring and the AI&rsquo;s role</h2>
                {scoring.map((s) => (
                  <section key={s.id} id={s.id} style={{ marginTop: 32 }}>
                    <h3 style={{ ...blockTitle, fontSize: 19 }}>{s.name}</h3>
                    <p style={blockBody}>{s.body}</p>
                  </section>
                ))}
              </article>
            </div>
          </div>
        </section>

        <CTASection
          eyebrow="See it in practice"
          heading="Read a finished house, then build one."
          primaryLabel="Try it free"
          primaryHref="/try"
          secondaryLabel="Browse examples"
          secondaryHref="/examples"
          note="No sign-up needed to try it."
        />
      </main>
      <Footer />
    </>
  )
}
