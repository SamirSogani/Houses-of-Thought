// Read-only render of a finished house (/examples/[slug]). Mirrors the post-login
// Build workspace layer by layer (see components/build/layers/*), minus the edit
// controls. Server component over static fixtures (lib/examples/data.ts). The
// AI-in-schools house renders verbatim from the stored Build content.

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import MarketingHeader from '@/components/marketing/Header'
import MarketingFooter from '@/components/marketing/Footer'
import MarketingCTASection from '@/components/marketing/CTASection'
import { Avatar } from '@/components/build/Avatar'
import { examples, getExample } from '@/lib/examples/data'
import { layers, axisMeasures, type PerspectiveDetail } from '@/lib/build/content'
import { people } from '@/lib/build/people'
import { safeHttpUrl } from '@/lib/safeUrl'
import { absoluteUrl } from '@/lib/site'
import type { Assumption, Evidence, Implication, Perspective } from '@/lib/build/types'
import {
  computeStrength,
  strengthColor,
  axisLabel,
  overallLabel,
  overallSummary,
  color as barColor,
} from '@/lib/build/strength'

export function generateStaticParams() {
  return examples.map((e) => ({ slug: e.slug }))
}

// Per-example metadata (seo #2, aeo C3). These are the richest pages on the
// site — a full rendered house each — and previously all shared the site-wide
// title, so they were invisible to search as distinct documents.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const example = getExample(slug)
  if (!example) return {}
  const title = example.house.title || 'Example house'
  return {
    title,
    description: `A worked example: ${example.summary} See the perspectives, cited evidence, assumptions, and House Strength behind the conclusion.`,
    alternates: { canonical: `/examples/${slug}` },
    openGraph: {
      type: 'article',
      title,
      description: example.summary,
      url: `/examples/${slug}`,
    },
  }
}

const monoLabel: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: '0.11em',
  color: 'var(--ink-subtle)',
}

const card: React.CSSProperties = {
  background: 'var(--white)',
  border: '1px solid var(--rule)',
  borderRadius: 11,
  padding: '14px 16px',
}

const sourceChip: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 9,
  color: 'var(--blueprint)',
  background: 'rgba(62,92,138,0.09)',
  borderRadius: 4,
  padding: '3px 7px',
}

const jumpLinks = [
  { id: 'frame', label: 'Frame' },
  { id: 'perspectives', label: 'Perspectives' },
  { id: 'evidence', label: 'Evidence' },
  { id: 'assumptions', label: 'Assumptions' },
  { id: 'conclusion', label: 'Conclusion' },
  { id: 'implications', label: 'Implications' },
  { id: 'strength', label: 'House strength' },
]

export default async function ExampleDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const example = getExample(slug)
  if (!example) notFound()

  const h = example.house
  const s = computeStrength(h)
  const implTotal = h.pos.length + h.neg.length + h.unc.length

  // BreadcrumbList JSON-LD (seo #9): Examples → this house.
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Examples', item: absoluteUrl('/examples') },
      { '@type': 'ListItem', position: 2, name: h.title, item: absoluteUrl(`/examples/${slug}`) },
    ],
  }

  return (
    <div className="dusk-page">
      <MarketingHeader />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <main id="main">
        <section style={{ paddingBlock: 'clamp(28px, 4vw, 48px)' }}>
          <div className="container">
            <Link
              href="/examples"
              className="mono"
              style={{ fontSize: 12, color: 'var(--dusk-ink-subtle)', display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              ← All examples
            </Link>

            {/* Title band */}
            <div style={{ marginTop: 18 }}>
              <span className="mono" style={{ fontSize: 11, color: 'var(--dusk-ink-subtle)', border: '1px solid var(--dusk-rule)', borderRadius: 5, padding: '3px 9px' }}>
                {example.domain}
              </span>
              <h1
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 500,
                  fontSize: 'clamp(28px, 4vw, 44px)',
                  letterSpacing: '-0.015em',
                  color: 'var(--dusk-ink)',
                  lineHeight: 1.15,
                  marginTop: 14,
                }}
              >
                {h.title}
              </h1>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 17, color: 'var(--dusk-ink-mid)', marginTop: 12, lineHeight: 1.5, maxWidth: '60ch' }}>
                {example.summary}
              </p>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 40, alignItems: 'flex-start', marginTop: 32 }}>
              {/* Sticky jump-link sidebar (wraps above the content on narrow,
                  where .mk-example-aside makes it static so it can't slide
                  over the article) */}
              <aside className="mk-example-aside" style={{ flex: '1 1 190px', maxWidth: 220, position: 'sticky', top: 84 }}>
                <p style={{ ...monoLabel, color: 'var(--dusk-ink-subtle)' }}>On this house</p>
                <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 12 }}>
                  {jumpLinks.map((l) => (
                    <a key={l.id} href={`#${l.id}`} style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--dusk-ink-mid)', padding: '4px 0' }}>
                      {l.label}
                    </a>
                  ))}
                </nav>
                <Link href="/try" className="btn-primary" style={{ marginTop: 22, display: 'inline-flex', width: '100%', justifyContent: 'center' }}>
                  Try it free
                </Link>
              </aside>

              {/* House */}
              <article style={{ flex: '999 1 540px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 'clamp(30px, 4vw, 48px)' }}>
                {/* Layer 1 — Frame */}
                <LayerSection id="frame" step={1}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div>
                      <div style={monoLabel}>Purpose</div>
                      <div style={{ ...card, marginTop: 8, fontSize: 15, color: 'var(--ink-mid)', lineHeight: 1.55 }}>{example.purpose}</div>
                    </div>
                    <div>
                      <div style={monoLabel}>Overarching question</div>
                      <div style={{ ...card, marginTop: 8, fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 22, color: 'var(--ink)' }}>{h.title}</div>
                    </div>
                    <div>
                      <div style={monoLabel}>Key concepts</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                        {h.concepts.map((c, i) => (
                          <span key={`${c.term}-${i}`} style={{ fontSize: 13, color: 'var(--ink)', background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 20, padding: '7px 14px' }}>
                            {c.term}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </LayerSection>

                {/* Layer 2 — Perspectives */}
                <LayerSection id="perspectives" step={2}>
                  <div style={monoLabel}>{h.perspectives.length} perspectives</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14 }}>
                    {h.perspectives.map((p) => (
                      <PerspectiveBlock key={p.id} p={p} detail={example.detail?.[p.id]} />
                    ))}
                  </div>
                </LayerSection>

                {/* Layer 3 — Evidence */}
                <LayerSection id="evidence" step={3}>
                  <div style={monoLabel}>{h.evidence.length} sourced facts</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
                    {h.evidence.map((e) => (
                      <EvidenceRow key={e.id} e={e} />
                    ))}
                  </div>
                </LayerSection>

                {/* Layer 4 — Assumptions */}
                <LayerSection id="assumptions" step={4}>
                  <div style={monoLabel}>{h.assumptions.length} foundational assumptions</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 14 }}>
                    {h.assumptions.map((a, i) => (
                      <AssumptionRow key={a.id} a={a} index={i} />
                    ))}
                  </div>
                </LayerSection>

                {/* Layer 5 — Conclusion */}
                <LayerSection id="conclusion" step={5}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div>
                      <div style={monoLabel}>Central conclusion</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                        {example.conclusion.map((b, i) => (
                          <div key={i} style={{ ...card, borderRadius: 10, fontSize: 14, color: 'var(--ink)' }}>{b}</div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div style={monoLabel}>Reasoning summary</div>
                      <div style={{ background: 'var(--parchment)', border: '1px solid var(--rule)', borderLeft: '3px solid var(--amber)', borderRadius: 10, padding: '15px 18px', marginTop: 8, fontSize: 15, color: 'var(--ink-mid)', lineHeight: 1.65 }}>
                        {example.reasoning}
                      </div>
                    </div>
                  </div>
                </LayerSection>

                {/* Layer 6 — Implications */}
                <LayerSection id="implications" step={6}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span className="mono" style={{ fontSize: 10, color: 'var(--ink-subtle)', background: 'var(--parchment)', border: '1px solid var(--rule)', borderRadius: 20, padding: '5px 11px' }}>
                      {implTotal} implications mapped
                    </span>
                    <span style={{ fontSize: 14, color: 'var(--ink-subtle)' }}>Sorted by register and tagged with time horizon and who it lands on.</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12, marginTop: 16 }}>
                    <ImplicationColumn label="Positive" items={h.pos} accent="var(--green-strong)" />
                    <ImplicationColumn label="Negative" items={h.neg} accent="var(--warning)" />
                    <ImplicationColumn label="Uncertain" items={h.unc} accent="var(--green-mid)" />
                  </div>
                  {h.watchpoints.length > 0 && (
                    <div style={{ marginTop: 22, background: 'var(--parchment)', border: '1px solid var(--rule)', borderRadius: 12, padding: '18px 20px' }}>
                      <span className="mono" style={{ fontSize: 10, color: 'var(--ink-mid)' }}>Signals to watch · would change the conclusion</span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                        {h.watchpoints.map((w, i) => (
                          <div key={i} style={{ fontSize: 13, color: 'var(--ink-mid)', lineHeight: 1.5 }}>
                            <span style={{ color: 'var(--warning-text)', marginRight: 8 }}>→</span>
                            {w}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </LayerSection>

                {/* Layer 7 — House strength */}
                <LayerSection id="strength" step={7}>
                  <div style={{ background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 14, padding: '22px 24px', display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 56, color: strengthColor(s.overall), lineHeight: 1 }}>{s.overall}</span>
                      <span className="mono" style={{ fontSize: 11, color: 'var(--ink-subtle)' }}>/ 100</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 220 }}>
                      <span className="mono" style={{ fontSize: 10, color: strengthColor(s.overall), border: `1px solid ${strengthColor(s.overall)}`, borderRadius: 5, padding: '3px 9px' }}>
                        {overallLabel(s.overall)}
                      </span>
                      <div style={{ fontSize: 15, color: 'var(--ink-mid)', marginTop: 11, lineHeight: 1.55 }}>{overallSummary(s.overall)}</div>
                    </div>
                  </div>
                  <div style={{ ...monoLabel, margin: '22px 0 12px' }}>The three scores</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <AxisRow name="Evidence" score={s.evidence} measures={axisMeasures.Evidence} driver={`${h.evidence.length} sourced facts`} />
                    <AxisRow name="Logic" score={s.logic} measures={axisMeasures.Logic} driver={`${h.assumptions.length} assumptions, conclusion set, ${implTotal} implications`} />
                    <AxisRow name="Coverage" score={s.coverage} measures={axisMeasures.Coverage} driver={`${h.perspectives.length} perspectives`} />
                  </div>
                  <div style={{ marginTop: 14, background: 'var(--parchment)', border: '1px solid var(--rule)', borderRadius: 10, padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                    <span className="mono" style={{ fontSize: 9, color: 'var(--ink-subtle)' }}>How the overall is weighted</span>
                    <span style={{ fontSize: 13, color: 'var(--ink)' }}>
                      Evidence <strong>40%</strong> · Logic <strong>35%</strong> · Coverage <strong>25%</strong>
                    </span>
                  </div>
                </LayerSection>
              </article>
            </div>
          </div>
        </section>

        <MarketingCTASection
          eyebrow="Start"
          heading="Build a house like this one."
          primaryLabel="Try it free"
          primaryHref="/try"
          secondaryLabel="Browse more examples"
          secondaryHref="/examples"
          note="No sign-up needed to try it. Create a free account when you want to build and save full houses."
        />
      </main>
      <MarketingFooter />
    </div>
  )
}

function LayerSection({ id, step, children }: { id: string; step: number; children: React.ReactNode }) {
  const layer = layers[step - 1]
  return (
    <section id={id} style={{ scrollMarginTop: 84 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className="mono" style={{ fontSize: 11, color: 'var(--amber)' }}>Layer {step} / 7</span>
        <span style={{ width: 16, height: 1, background: 'var(--dusk-rule)' }} />
        <span className="mono" style={{ fontSize: 11, color: 'var(--dusk-ink-subtle)' }}>{layer.kicker}</span>
      </div>
      <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 'clamp(22px, 2.8vw, 30px)', letterSpacing: '-0.015em', color: 'var(--dusk-ink)', marginTop: 10 }}>
        {layer.title}
      </h2>
      <p style={{ fontSize: 15, color: 'var(--dusk-ink-mid)', lineHeight: 1.55, marginTop: 8, marginBottom: 18, maxWidth: '60ch' }}>{layer.blurb}</p>
      {children}
    </section>
  )
}

function PerspectiveBlock({ p, detail }: { p: Perspective; detail?: PerspectiveDetail }) {
  const owner = people[p.owner]
  const col = barColor(p.strength)
  return (
    <div style={{ ...card, borderRadius: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 18, color: 'var(--ink)' }}>{p.name}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <Avatar who={p.owner} size={22} />
            <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--ink)' }}>{owner.name}</span>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 52, height: 5, background: 'var(--rule)', borderRadius: 3, overflow: 'hidden' }}>
              <span style={{ display: 'block', height: '100%', width: `${p.strength}%`, background: col }} />
            </span>
            <span className="mono" style={{ fontSize: 10, color: col }}>{p.strength}</span>
          </span>
        </span>
      </div>

      <p style={{ fontSize: 14, color: 'var(--ink-mid)', lineHeight: 1.55, marginTop: 10 }}>{detail?.stance ?? p.summary}</p>

      {detail && detail.questions.length > 0 && (
        <>
          <div style={{ ...monoLabel, margin: '18px 0 10px' }}>Sub-questions · {detail.questions.length}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {detail.questions.map((q, i) => (
              <div key={i} style={{ background: 'var(--parchment)', border: '1px solid var(--rule)', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 15, color: 'var(--ink)' }}>{q.q}</div>
                <div style={{ marginTop: 7, fontSize: 13, color: 'var(--ink-mid)', lineHeight: 1.55 }}>{q.note}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {detail && detail.evidence.length > 0 && (
        <>
          <div style={{ ...monoLabel, margin: '18px 0 10px' }}>Supporting evidence</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {detail.evidence.map((e, i) => {
              const href = e.url ? safeHttpUrl(e.url) : null
              return (
                <div key={i} style={{ background: 'var(--parchment)', border: '1px solid var(--rule)', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: 14, color: 'var(--ink)' }}>{e.text}</div>
                  <div style={{ marginTop: 7 }}>
                    {href ? (
                      <a href={href} target="_blank" rel="noopener noreferrer" style={{ ...sourceChip, textDecoration: 'underline', textUnderlineOffset: 2 }}>
                        {e.source} ↗
                      </a>
                    ) : (
                      <span style={sourceChip}>{e.source}</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {detail && detail.counters.length > 0 && (
        <>
          <div style={{ ...monoLabel, margin: '18px 0 10px', color: 'var(--warning-text)' }}>Counterarguments</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {detail.counters.map((c, i) => (
              <div key={i} style={{ background: 'var(--parchment)', border: '1px solid var(--rule)', borderLeft: '3px solid var(--warning)', borderRadius: 10, padding: '12px 14px', fontSize: 14, color: 'var(--ink-mid)', lineHeight: 1.5 }}>
                {c}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function EvidenceRow({ e }: { e: Evidence }) {
  const href = e.url ? safeHttpUrl(e.url) : null
  return (
    <div style={{ ...card, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <Avatar who={e.owner} size={24} title={people[e.owner].name} />
      <div>
        <div style={{ fontSize: 14, color: 'var(--ink)' }}>{e.text}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 7, flexWrap: 'wrap' }}>
          {href ? (
            <a href={href} target="_blank" rel="noopener noreferrer" style={{ ...sourceChip, textDecoration: 'underline', textUnderlineOffset: 2 }}>
              {e.source} ↗
            </a>
          ) : (
            <span style={sourceChip}>{e.source}</span>
          )}
          {e.byAI && <span className="mono" style={{ fontSize: 9, color: 'var(--amber-text)' }}>via Research Mode</span>}
        </div>
      </div>
    </div>
  )
}

function AssumptionRow({ a, index }: { a: Assumption; index: number }) {
  return (
    <div style={{ ...card, display: 'flex', gap: 12, alignItems: 'center' }}>
      <span className="mono" style={{ width: 22, height: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--rule)', borderRadius: 6, fontSize: 9, color: 'var(--ink-subtle)', flex: '0 0 auto' }}>
        {String(index + 1).padStart(2, '0')}
      </span>
      <span style={{ fontSize: 14, color: 'var(--ink)', flex: 1 }}>{a.text}</span>
      <Avatar who={a.owner} size={22} />
    </div>
  )
}

function ImplicationColumn({ label, items, accent }: { label: string; items: Implication[]; accent: string }) {
  const metaChip: React.CSSProperties = {
    fontFamily: 'var(--font-mono)',
    fontSize: 8,
    textTransform: 'uppercase',
    letterSpacing: '0.11em',
    color: 'var(--ink-subtle)',
    border: '1px solid var(--rule)',
    borderRadius: 4,
    padding: '2px 6px',
  }
  return (
    <div style={{ background: 'var(--white)', border: '1px solid var(--rule)', borderTop: `3px solid ${accent}`, borderRadius: 11, padding: 15 }}>
      <span className="mono" style={{ fontSize: 10, color: accent }}>{label} · {items.length}</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
        {items.length === 0 && <span className="mono" style={{ fontSize: 10, color: 'var(--ink-subtle)' }}>None recorded.</span>}
        {items.map((it) => (
          <div key={it.id} style={{ border: '1px solid var(--rule-soft)', borderRadius: 9, padding: '11px 12px' }}>
            <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.45 }}>{it.text}</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              <span style={metaChip}>{it.horizon}</span>
              <span style={metaChip}>{it.who}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function AxisRow({ name, score, measures, driver }: { name: string; score: number; measures: string; driver: string }) {
  const col = strengthColor(score)
  return (
    <div style={{ background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 12, padding: '16px 18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 18, color: 'var(--ink)' }}>{name}</span>
          <span className="mono" style={{ fontSize: 9, color: col, border: `1px solid ${col}`, borderRadius: 5, padding: '2px 9px' }}>{axisLabel(score)}</span>
        </span>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 24, color: col }}>{score}</span>
      </div>
      <div style={{ height: 7, background: 'var(--rule)', borderRadius: 4, overflow: 'hidden', marginTop: 12 }}>
        <div style={{ height: '100%', width: `${score}%`, background: col }} />
      </div>
      <div style={{ fontSize: 13, color: 'var(--ink-mid)', marginTop: 12, lineHeight: 1.5 }}>{measures}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 9, flexWrap: 'wrap' }}>
        <span className="mono" style={{ fontSize: 9, color: 'var(--ink-subtle)' }}>Driving this score</span>
        <span style={{ fontSize: 12, color: 'var(--ink)' }}>{driver}</span>
      </div>
    </div>
  )
}
