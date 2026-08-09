// /how-it-works — the sole methodology explainer (redesign brief: reconcile
// with the old /framework, which described a different feature — the
// post-login House Builder's own layer model — and is now a permanent
// redirect here, see next.config.ts). This page explains the automated
// reasoning pipeline instead: ground truth is lib/ai/reasoning/steps.ts and
// standards.ts, read but never edited (hard constraint).

import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/site'
import MarketingHeader from '@/components/marketing/Header'
import MarketingFooter from '@/components/marketing/Footer'
import MarketingCTASection from '@/components/marketing/CTASection'
import Constellation from '@/components/marketing/Constellation'
import { CONSTELLATION_LAYERS, CONSTELLATION_STANDARDS } from '@/lib/marketing/constellation'

export const metadata: Metadata = pageMetadata({
  title: 'How It Works: the seven-layer reasoning model',
  description:
    'How a Houses of Thought run works, layer by layer: Frame, Breadth Scoping, Perspectives, Global Assumptions, Global Evidence, Conclusions, and Implications — six of them checked by a nine-standard independent review panel.',
  path: '/how-it-works',
})

// DefinedTermSet JSON-LD (aeo H1) — carries forward the citation surface the
// old /framework page provided, now describing the model this page actually
// explains.
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'DefinedTermSet',
  name: 'Houses of Thought reasoning model',
  description:
    'The seven-layer reasoning model behind Houses of Thought, based on John Trapasso’s classroom model, derived from the Paul–Elder framework for critical thinking.',
  hasDefinedTerm: CONSTELLATION_LAYERS.map((l) => ({
    '@type': 'DefinedTerm',
    name: l.name,
    description: l.job,
  })),
}

export default function HowItWorksPage() {
  return (
    <div className="dusk-page">
      <MarketingHeader />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main id="main">
        <section style={{ paddingBlock: 'clamp(56px, 9vw, 100px)' }}>
          <div className="container">
            <div style={{ maxWidth: '62ch' }}>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--amber)' }}>
                How it works
              </p>
              <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 'clamp(34px, 5.4vw, 58px)', lineHeight: 1.08, letterSpacing: '-0.015em', color: 'var(--dusk-ink)', marginTop: 16 }}>
                Seven layers. One at a time. Nothing skipped.
              </h1>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 17, lineHeight: 1.6, color: 'var(--dusk-ink-mid)', marginTop: 18 }}>
                A Houses of Thought run walks the same seven layers every time, based on
                John Trapasso&rsquo;s classroom model, derived from the Paul&ndash;Elder
                framework for critical thinking. Six of the seven are checked by a panel
                of nine independent reviewers — one per standard, each blind to the
                others — before the run is allowed to move on. Select a layer below to
                see exactly what it does and what its panel checks for.
              </p>
            </div>

            <div style={{ marginTop: 48 }}>
              <Constellation variant="interactive" />
            </div>
          </div>
        </section>

        <section style={{ paddingBlock: 'var(--section-py)', borderTop: '1px solid var(--dusk-rule)' }}>
          <div className="container" style={{ maxWidth: '68ch' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 'clamp(24px, 3vw, 32px)', color: 'var(--dusk-ink)' }}>
              Why a panel, and why nine standards?
            </h2>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 16, lineHeight: 1.65, color: 'var(--dusk-ink-mid)', marginTop: 14 }}>
              The nine standards — {CONSTELLATION_STANDARDS.map((s) => s.name).join(', ')} — are
              Paul and Elder&rsquo;s Universal Intellectual Standards, the same nine a
              critical-thinking classroom would apply by hand. Each one is graded by its
              own independent reviewer, seeing only its own question, so a strong score
              on one standard can never paper over a weak one on another. What each
              standard actually means changes by layer — &ldquo;depth&rdquo; at Frame asks how many
              considerations the framing accounts for; at Perspectives it asks whether a
              stance engages its strongest form — because a layer can only fairly be
              graded against what it is actually trying to do.
            </p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 16, lineHeight: 1.65, color: 'var(--dusk-ink-mid)', marginTop: 14 }}>
              A layer that fails a standard doesn&rsquo;t quietly pass anyway — it loops and
              redoes the work. Frame, Global Assumptions, Global Evidence, Conclusions,
              and Implications hold the whole run until they pass, since nothing else
              backs them up. Perspectives instead drops just the one stance that failed,
              since the other independent perspectives already provide redundancy.
              Breadth Scoping is the one layer with no panel at all — a single judgment
              call about how many perspectives the question deserves, made once.
            </p>
          </div>
        </section>

        <MarketingCTASection
          eyebrow="See it for yourself"
          heading="Pick a question you can't crack."
          primaryLabel="Try it free"
          primaryHref="/try"
          secondaryLabel="Browse examples"
          secondaryHref="/examples"
          note="No sign-up needed to try it."
        />
      </main>
      <MarketingFooter />
    </div>
  )
}
