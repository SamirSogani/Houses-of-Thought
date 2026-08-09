// /how-it-works — the sole methodology explainer (redesign brief: reconcile
// with the old /framework, which described a different feature — the
// post-login House Builder's own layer model — and is now a permanent
// redirect here, see next.config.ts). This page explains the automated
// reasoning pipeline instead: ground truth is lib/ai/reasoning/steps.ts and
// standards.ts, read but never edited (hard constraint).

import type { Metadata } from 'next'
import Link from 'next/link'
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

const FAILURE_MODE: Record<string, { label: string; body: string }> = {
  'hard-block': { label: 'Hard-blocks', body: 'Loops until it passes — the run cannot continue on a failed version of this layer.' },
  degrade: { label: 'Drops the failing stance', body: 'The other independent perspectives already provide redundancy, so only the one that failed is dropped.' },
  none: { label: 'No panel', body: 'A single judgment call, made once.' },
}

// At-a-glance data for the non-interactive summary table below the diagram —
// the same seven layers, readable without clicking through each node.
const LAYER_SUMMARY: { id: string; failureMode: keyof typeof FAILURE_MODE }[] = [
  { id: 'frame', failureMode: 'hard-block' },
  { id: 'breadth-scoping', failureMode: 'none' },
  { id: 'perspectives', failureMode: 'degrade' },
  { id: 'global-assumptions', failureMode: 'hard-block' },
  { id: 'global-evidence', failureMode: 'hard-block' },
  { id: 'conclusions', failureMode: 'hard-block' },
  { id: 'implications', failureMode: 'hard-block' },
]

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

        {/* At a glance — the same seven layers, readable without clicking
            through each node (completeness for scanners and a11y alike). */}
        <section style={{ paddingBlock: '0 var(--section-py)' }}>
          <div className="container">
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--dusk-ink-subtle)', marginBottom: 16 }}>
              At a glance
            </p>
            <div className="table-scroll">
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
                <thead>
                  <tr>
                    <th style={howThStyle}>Layer</th>
                    <th style={howThStyle}>Review panel</th>
                    <th style={howThStyle}>If it fails a standard</th>
                  </tr>
                </thead>
                <tbody>
                  {LAYER_SUMMARY.map((row, i) => {
                    const layer = CONSTELLATION_LAYERS.find((l) => l.id === row.id)!
                    const mode = FAILURE_MODE[row.failureMode]
                    return (
                      <tr key={row.id}>
                        <td style={{ ...howTdStyle, color: 'var(--dusk-ink)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {i + 1}. {layer.name}
                        </td>
                        <td style={howTdStyle}>{layer.hasPanel ? 'Nine independent standards' : 'None'}</td>
                        <td style={howTdStyle}>
                          <strong style={{ color: 'var(--dusk-ink)', fontWeight: 600 }}>{mode.label}.</strong> {mode.body}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Meet the nine standards — generic, layer-agnostic definitions
            (lib/ai/reasoning/standards.ts's own documentation gloss), so the
            standards are legible on their own before the per-layer nuance in
            the interactive diagram above. */}
        <section style={{ paddingBlock: '0 var(--section-py)', borderTop: '1px solid var(--dusk-rule)' }}>
          <div className="container">
            <div style={{ maxWidth: '62ch' }}>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--dusk-ink-subtle)' }}>
                The review panel
              </p>
              <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 'clamp(24px, 3vw, 32px)', color: 'var(--dusk-ink)', marginTop: 10 }}>
                Meet the nine standards.
              </h2>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 16, lineHeight: 1.6, color: 'var(--dusk-ink-mid)', marginTop: 12 }}>
                Paul and Elder&rsquo;s Universal Intellectual Standards, in general. Six of
                the seven layers get graded against all nine — what each one means at
                that specific layer is in the diagram above.
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14, marginTop: 28 }}>
              {CONSTELLATION_STANDARDS.map((s) => (
                <div key={s.id} className="dusk-card" style={{ padding: '16px 18px' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--standard-cool)' }}>
                    {s.name}
                  </span>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.5, color: 'var(--dusk-ink-mid)', marginTop: 6 }}>
                    {s.definition}
                  </p>
                </div>
              ))}
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

        {/* Credit — the deepest methodology content on the site should say
            plainly where the method comes from (redesign brief). */}
        <section style={{ paddingBlock: '0 var(--section-py)', borderTop: '1px solid var(--dusk-rule)' }}>
          <div className="container">
            <div className="dusk-card" style={{ padding: 'clamp(24px, 4vw, 40px)', display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ maxWidth: '52ch' }}>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--amber)' }}>
                  Where this comes from
                </p>
                <p style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 500, fontSize: 'clamp(19px, 2.2vw, 24px)', lineHeight: 1.35, color: 'var(--dusk-ink)', marginTop: 10 }}>
                  This isn&rsquo;t a house style invented for an app. It&rsquo;s a real
                  classroom model, taught by a real teacher, built into software
                  because it worked on paper first.
                </p>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 15, lineHeight: 1.6, color: 'var(--dusk-ink-mid)', marginTop: 14 }}>
                  The seven layers are John Trapasso&rsquo;s classroom framework; the nine
                  standards each layer is checked against are Richard Paul and Linda
                  Elder&rsquo;s Universal Intellectual Standards for critical thinking.
                  Houses of Thought is one particular implementation of both — not the
                  other way around.
                </p>
              </div>
              <Link href="/story" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 15, color: 'var(--amber)', whiteSpace: 'nowrap' }}>
                Read the full story →
              </Link>
            </div>
          </div>
        </section>

        <MarketingCTASection
          eyebrow="See it for yourself"
          heading="Pick a question you can't crack."
          primaryLabel="Try it instantly"
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

const howThStyle: React.CSSProperties = {
  textAlign: 'left',
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--dusk-ink-subtle)',
  padding: '10px 16px',
  borderBottom: '1px solid var(--dusk-rule)',
}

const howTdStyle: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontSize: 14.5,
  lineHeight: 1.5,
  color: 'var(--dusk-ink-mid)',
  padding: '14px 16px',
  borderBottom: '1px solid var(--dusk-rule-soft)',
  verticalAlign: 'top',
}
