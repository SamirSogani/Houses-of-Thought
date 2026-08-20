// Mechanism 2 ("Share") of plans/active/persistence/invite-share-panels.md: a
// real user's house, read-only, reachable with no account — the token IS the
// credential. Sibling to /examples, not inside it: /examples stays curated
// marketing content (lib/examples/data.ts); this route renders real houses via
// the service-role Route Handler (app/api/shared/[token]/route.ts). Public —
// proxy.ts does not gate /shared, and it's excluded from the sitemap/robots
// index (lib/site.ts NOINDEX_PREFIXES) since a link-gated house shouldn't be
// crawlable.

import { notFound } from 'next/navigation'
import Header from '@/components/Header'
import SheetStrip from '@/components/SheetStrip'
import Footer from '@/components/sections/Footer'
import CTASection from '@/components/sections/CTASection'
import { ReadOnlyHouse, monoLabel, splitConclusion } from '@/components/house-detail/ReadOnlyHouse'
import { absoluteUrl } from '@/lib/site'
import type { State } from '@/lib/build/types'

const jumpLinks = [
  { id: 'frame', label: 'Frame' },
  { id: 'perspectives', label: 'Perspectives' },
  { id: 'evidence', label: 'Evidence' },
  { id: 'assumptions', label: 'Assumptions' },
  { id: 'conclusion', label: 'Conclusion' },
  { id: 'implications', label: 'Implications' },
  { id: 'strength', label: 'House strength' },
]

async function fetchSharedHouse(token: string): Promise<State | null> {
  const res = await fetch(absoluteUrl(`/api/shared/${token}`), { cache: 'no-store' })
  if (!res.ok) return null
  const body = (await res.json()) as { house: State }
  return body.house
}

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const house = await fetchSharedHouse(token)
  if (!house) return {}
  return {
    title: house.title || 'Shared house',
    // Never indexed (see module comment) — no canonical/openGraph needed here.
  }
}

export default async function SharedHousePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const house = await fetchSharedHouse(token)
  if (!house) notFound()

  return (
    <>
      <Header />
      <SheetStrip sheet="Sheet 11 / Shared" />
      <main id="main">
        <section style={{ background: 'var(--parchment)', paddingBlock: 'clamp(28px, 4vw, 48px)' }}>
          <div className="container">
            {/* Title band */}
            <div>
              <span className="mono" style={{ fontSize: 11, color: 'var(--ink-subtle)', border: '1px solid var(--rule)', borderRadius: 5, padding: '3px 9px' }}>
                Shared house · read-only
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
                {house.title || house.question || 'Untitled house'}
              </h1>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 17, color: 'var(--ink-mid)', marginTop: 12, lineHeight: 1.5, maxWidth: '60ch' }}>
                Someone shared this house with you via a link. You&apos;re seeing it exactly as they
                built it — nothing here can be edited from this page.
              </p>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 40, alignItems: 'flex-start', marginTop: 32 }}>
              <aside className="mk-example-aside" style={{ flex: '1 1 190px', maxWidth: 220, position: 'sticky', top: 84 }}>
                <p style={monoLabel}>On this house</p>
                <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 12 }}>
                  {jumpLinks.map((l) => (
                    <a key={l.id} href={`#${l.id}`} style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--ink-mid)', padding: '4px 0' }}>
                      {l.label}
                    </a>
                  ))}
                </nav>
              </aside>

              <ReadOnlyHouse
                house={house}
                purpose={house.purpose}
                conclusion={splitConclusion(house.conclusion)}
                reasoning={house.reasoning}
              />
            </div>
          </div>
        </section>

        <CTASection
          eyebrow="Start"
          heading="Build a house of your own."
          primaryLabel="Try it free"
          primaryHref="/try"
          secondaryLabel="See more examples"
          secondaryHref="/examples"
          note="No sign-up needed to try it. Create a free account when you want to build and save full houses."
        />
      </main>
      <Footer />
    </>
  )
}
