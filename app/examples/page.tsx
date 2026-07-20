// Examples gallery (/examples). Pre-login proof surface: a filterable grid of
// completed houses, each linking into the read-only detail render. Data is
// static (lib/examples/data.ts); strength is computed from the house content so
// the badges match what the detail page shows.
//
// Server component: the filter state lives in <ExampleGrid> (a client child) so
// this page can export metadata, which a 'use client' page cannot (seo #6).

import type { Metadata } from 'next'
import Header from '@/components/Header'
import SheetStrip from '@/components/SheetStrip'
import Footer from '@/components/sections/Footer'
import CTASection from '@/components/sections/CTASection'
import { ExampleGrid } from '@/components/examples/ExampleGrid'
import { pageMetadata } from '@/lib/site'

export const metadata: Metadata = pageMetadata({
  title: 'Examples: finished houses you can inspect',
  description:
    'Complete worked examples of structured reasoning — classroom debates, career decisions, ethics and policy questions. Open any to read the perspectives, cited evidence, assumptions, and House Strength.',
  path: '/examples',
  ogTitle: 'Worked examples of structured reasoning',
})

export default function ExamplesPage() {
  return (
    <>
      <Header />
      <SheetStrip sheet="Sheet 07 / Examples" />
      <main id="main">
        <section style={{ background: 'var(--parchment)', paddingBlock: 'clamp(40px, 6vw, 72px)' }}>
          <div className="container">
            {/* Header */}
            <p className="eyebrow">Section 07 — Examples</p>
            <h1 className="h2" style={{ marginTop: 16, maxWidth: '18ch' }}>
              Reasoning you can actually inspect.
            </h1>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 17,
                color: 'var(--ink-mid)',
                marginTop: 14,
                maxWidth: '60ch',
              }}
            >
              Browse finished Houses of Thought across decisions, debates, and classroom
              topics. Open any of them to read the perspectives, check the cited evidence,
              and see how the conclusion holds up.
            </p>

            <ExampleGrid />
          </div>
        </section>

        <CTASection
          eyebrow="Start"
          heading="Start your own house."
          primaryLabel="Try it free"
          primaryHref="/try"
          secondaryLabel="How it works"
          secondaryHref="/how-it-works"
          note="No sign-up needed to try it. Create a free account when you want to build and save full houses."
        />
      </main>
      <Footer />
    </>
  )
}
