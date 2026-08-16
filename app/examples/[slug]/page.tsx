// Read-only render of a finished house (/examples/[slug]). Mirrors the post-login
// Build workspace layer by layer (see components/build/layers/*), minus the edit
// controls. Server component over static fixtures (lib/examples/data.ts). The
// AI-in-schools house renders verbatim from the stored Build content.

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import Header from '@/components/Header'
import SheetStrip from '@/components/SheetStrip'
import Footer from '@/components/sections/Footer'
import CTASection from '@/components/sections/CTASection'
import { examples, getExample } from '@/lib/examples/data'
import { absoluteUrl } from '@/lib/site'
import { ReadOnlyHouse, monoLabel } from '@/components/house-detail/ReadOnlyHouse'

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
    <>
      <Header />
      <SheetStrip sheet="Sheet 07 / Examples" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <main id="main">
        <section style={{ background: 'var(--parchment)', paddingBlock: 'clamp(28px, 4vw, 48px)' }}>
          <div className="container">
            <Link
              href="/examples"
              className="mono"
              style={{ fontSize: 12, color: 'var(--ink-subtle)', display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              ← All examples
            </Link>

            {/* Title band */}
            <div style={{ marginTop: 18 }}>
              <span className="mono" style={{ fontSize: 11, color: 'var(--ink-subtle)', border: '1px solid var(--rule)', borderRadius: 5, padding: '3px 9px' }}>
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
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 17, color: 'var(--ink-mid)', marginTop: 12, lineHeight: 1.5, maxWidth: '60ch' }}>
                {example.summary}
              </p>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 40, alignItems: 'flex-start', marginTop: 32 }}>
              {/* Sticky jump-link sidebar (wraps above the content on narrow,
                  where .mk-example-aside makes it static so it can't slide
                  over the article) */}
              <aside className="mk-example-aside" style={{ flex: '1 1 190px', maxWidth: 220, position: 'sticky', top: 84 }}>
                <p style={monoLabel}>On this house</p>
                <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 12 }}>
                  {jumpLinks.map((l) => (
                    <a key={l.id} href={`#${l.id}`} style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--ink-mid)', padding: '4px 0' }}>
                      {l.label}
                    </a>
                  ))}
                </nav>
                <Link href="/try" className="btn-primary" style={{ marginTop: 22, display: 'inline-flex', width: '100%', justifyContent: 'center' }}>
                  Try it free
                </Link>
              </aside>

              {/* House */}
              <ReadOnlyHouse
                house={h}
                purpose={example.purpose}
                conclusion={example.conclusion}
                reasoning={example.reasoning}
                detail={example.detail}
              />
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
          note="No sign-up needed to try it. Create a free account when you want to build and save full houses."
        />
      </main>
      <Footer />
    </>
  )
}
