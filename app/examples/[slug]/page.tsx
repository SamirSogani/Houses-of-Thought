// Read-only render of a completed house (/examples/[slug]) — the strongest proof
// on the pre-login site. Server component over static fixtures (lib/examples/data.ts).
// Reuses the Build strength model so the meter matches the real workspace.

import Link from 'next/link'
import { notFound } from 'next/navigation'
import Header from '@/components/Header'
import SheetStrip from '@/components/SheetStrip'
import Footer from '@/components/sections/Footer'
import CTASection from '@/components/sections/CTASection'
import { examples, getExample } from '@/lib/examples/data'
import type { Evidence, Implication, Perspective } from '@/lib/build/types'
import {
  computeStrength,
  strengthColor,
  overallLabel,
  overallSummary,
  axisLabel,
  color as barColor,
} from '@/lib/build/strength'

export function generateStaticParams() {
  return examples.map((e) => ({ slug: e.slug }))
}

const jumpLinks = [
  { id: 'perspectives', label: 'Perspectives' },
  { id: 'evidence', label: 'Evidence' },
  { id: 'assumptions', label: 'Assumptions' },
  { id: 'conclusion', label: 'Conclusion' },
  { id: 'implications', label: 'Implications' },
]

export default async function ExampleDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const example = getExample(slug)
  if (!example) notFound()

  const h = example.house
  const s = computeStrength(h)

  return (
    <>
      <Header />
      <SheetStrip sheet="Sheet 07 / Examples" />
      <main>
        <section style={{ background: 'var(--parchment)', paddingBlock: 'clamp(28px, 4vw, 48px)' }}>
          <div className="container">
            <Link
              href="/examples"
              className="mono"
              style={{ fontSize: 12, color: 'var(--ink-subtle)', display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              ← All examples
            </Link>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 40, alignItems: 'flex-start', marginTop: 20 }}>
              {/* Sticky jump-link sidebar (wraps to top on narrow) */}
              <aside style={{ flex: '1 1 190px', maxWidth: 220, position: 'sticky', top: 84 }}>
                <p className="mono" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-subtle)' }}>
                  On this page
                </p>
                <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 12 }}>
                  {jumpLinks.map((l) => (
                    <a
                      key={l.id}
                      href={`#${l.id}`}
                      style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--ink-mid)', padding: '4px 0' }}
                    >
                      {l.label}
                    </a>
                  ))}
                </nav>
                <Link
                  href="/try"
                  className="btn-primary"
                  style={{ marginTop: 22, display: 'inline-flex', width: '100%', justifyContent: 'center' }}
                >
                  Try it free
                </Link>
              </aside>

              {/* Content */}
              <article style={{ flex: '999 1 540px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 'clamp(28px, 4vw, 44px)' }}>
                {/* Header + strength */}
                <div>
                  <span
                    className="mono"
                    style={{ fontSize: 11, color: 'var(--ink-subtle)', border: '1px solid var(--rule)', borderRadius: 5, padding: '3px 9px' }}
                  >
                    {example.domain}
                  </span>
                  <h1
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontWeight: 500,
                      fontSize: 'clamp(28px, 4vw, 44px)',
                      letterSpacing: '-0.015em',
                      color: 'var(--ink)',
                      lineHeight: 1.15,
                      marginTop: 14,
                    }}
                  >
                    {h.title}
                  </h1>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 17, color: 'var(--ink-mid)', marginTop: 12, lineHeight: 1.5, maxWidth: '58ch' }}>
                    {example.stance}
                  </p>
                  <StrengthMeter s={s} />
                </div>

                <Block id="perspectives" title="Perspectives" caption={`${h.perspectives.length} stakeholder views`}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
                    {h.perspectives.map((p) => (
                      <PerspectiveCard key={p.id} p={p} />
                    ))}
                  </div>
                </Block>

                <Block id="evidence" title="Foundational evidence" caption="Every claim carries a citation">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {h.evidence.map((e) => (
                      <EvidenceItem key={e.id} e={e} />
                    ))}
                  </div>
                </Block>

                <Block id="assumptions" title="Foundational assumptions" caption="What the reasoning depends on">
                  <ul style={{ display: 'flex', flexDirection: 'column', gap: 10, listStyle: 'none' }}>
                    {h.assumptions.map((a) => (
                      <li key={a.id} style={{ display: 'flex', gap: 10, fontFamily: 'var(--font-body)', fontSize: 15, color: 'var(--ink-mid)', lineHeight: 1.5 }}>
                        <span aria-hidden="true" style={{ color: 'var(--amber-hover)' }}>◆</span>
                        {a.text}
                      </li>
                    ))}
                  </ul>
                </Block>

                <Block id="conclusion" title="Conclusion" caption="Where the house lands">
                  <p style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 'clamp(19px, 2.4vw, 24px)', color: 'var(--ink)', lineHeight: 1.35 }}>
                    {example.conclusion}
                  </p>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 15, color: 'var(--ink-mid)', marginTop: 16, lineHeight: 1.6, maxWidth: '64ch' }}>
                    {example.reasoning}
                  </p>
                </Block>

                <Block id="implications" title="Implications" caption="Traced across positive, negative, and uncertain">
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                    <ImplicationColumn label="Positive" items={h.pos} tone="var(--green-strong)" />
                    <ImplicationColumn label="Negative" items={h.neg} tone="var(--warning)" />
                    <ImplicationColumn label="Uncertain" items={h.unc} tone="var(--amber-hover)" />
                  </div>
                </Block>
              </article>
            </div>
          </div>
        </section>

        <CTASection
          eyebrow="Start"
          heading="Build a house like this one."
          primaryLabel="Try it free"
          primaryHref="/try"
          secondaryLabel="Browse more examples"
          secondaryHref="/examples"
          note="No sign-up needed to try it. Your work saves locally until you create an account."
        />
      </main>
      <Footer />
    </>
  )
}

function Block({ id, title, caption, children }: { id: string; title: string; caption: string; children: React.ReactNode }) {
  return (
    <section id={id} style={{ scrollMarginTop: 84 }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 'clamp(21px, 2.6vw, 27px)', letterSpacing: '-0.01em', color: 'var(--ink)' }}>
        {title}
      </h2>
      <p className="mono" style={{ fontSize: 11, color: 'var(--ink-subtle)', marginTop: 6, marginBottom: 18 }}>
        {caption}
      </p>
      {children}
    </section>
  )
}

function StrengthMeter({ s }: { s: ReturnType<typeof computeStrength> }) {
  const axes = [
    { label: 'Evidence', value: s.evidence },
    { label: 'Logic', value: s.logic },
    { label: 'Coverage', value: s.coverage },
  ]
  return (
    <div style={{ border: '1px solid var(--rule)', borderRadius: 'var(--radius-card)', background: 'var(--white)', padding: 'clamp(18px, 2.5vw, 26px)', marginTop: 24, display: 'flex', flexWrap: 'wrap', gap: 28, alignItems: 'center' }}>
      <div style={{ flex: '0 0 auto' }}>
        <span className="mono" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-subtle)' }}>
          House Strength
        </span>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 6 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 52, lineHeight: 1, color: 'var(--ink)' }}>
            {s.overall}
          </span>
          <span className="mono" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: strengthColor(s.overall) }}>
            {overallLabel(s.overall)}
          </span>
        </div>
      </div>
      <div style={{ flex: '1 1 260px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {axes.map((a) => (
          <div key={a.label}>
            <div className="mono" style={{ fontSize: 11, color: 'var(--ink-subtle)', display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span>
                {a.label} · <span style={{ color: strengthColor(a.value) }}>{axisLabel(a.value)}</span>
              </span>
              <span style={{ color: strengthColor(a.value) }}>{a.value}</span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: 'var(--rule)', overflow: 'hidden' }}>
              <div style={{ width: `${a.value}%`, height: '100%', borderRadius: 3, background: strengthColor(a.value) }} />
            </div>
          </div>
        ))}
      </div>
      <p style={{ flex: '1 1 100%', fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--ink-mid)', lineHeight: 1.5, margin: 0 }}>
        {overallSummary(s.overall)}
      </p>
    </div>
  )
}

function PerspectiveCard({ p }: { p: Perspective }) {
  return (
    <div style={{ border: '1px solid var(--rule)', borderRadius: 10, background: 'var(--white)', padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <span style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 15, color: 'var(--ink)' }}>{p.name}</span>
        <span className="mono" style={{ fontSize: 10, color: 'var(--ink-subtle)' }}>{p.questions} questions</span>
      </div>
      <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--ink-mid)', marginTop: 8, lineHeight: 1.5 }}>{p.summary}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
        <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'var(--rule)', overflow: 'hidden' }}>
          <div style={{ width: `${p.strength}%`, height: '100%', borderRadius: 2, background: barColor(p.strength) }} />
        </div>
        <span className="mono" style={{ fontSize: 10, color: barColor(p.strength) }}>{p.strength}</span>
      </div>
    </div>
  )
}

function EvidenceItem({ e }: { e: Evidence }) {
  return (
    <div style={{ border: '1px solid var(--rule)', borderRadius: 10, background: 'var(--white)', padding: 16 }}>
      <p style={{ fontFamily: 'var(--font-body)', fontSize: 15, color: 'var(--ink)', lineHeight: 1.5 }}>{e.text}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
        <span className="mono" style={{ fontSize: 11, color: 'var(--ink-subtle)' }}>{e.source}</span>
        {e.byAI && (
          <span className="mono" style={{ fontSize: 9, color: 'var(--amber-hover)', border: '1px solid var(--amber)', borderRadius: 4, padding: '1px 6px' }}>
            AI-sourced
          </span>
        )}
      </div>
    </div>
  )
}

function ImplicationColumn({ label, items, tone }: { label: string; items: Implication[]; tone: string }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: '50%', background: tone }} />
        <span className="mono" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink)' }}>{label}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.length === 0 && (
          <p className="mono" style={{ fontSize: 11, color: 'var(--ink-subtle)' }}>None recorded.</p>
        )}
        {items.map((i) => (
          <div key={i.id} style={{ borderLeft: `2px solid ${tone}`, paddingLeft: 12 }}>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--ink-mid)', lineHeight: 1.5 }}>{i.text}</p>
            <span className="mono" style={{ fontSize: 10, color: 'var(--ink-subtle)' }}>{i.horizon} · {i.who}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
