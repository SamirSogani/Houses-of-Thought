import type { Metadata } from 'next'
import MarketingHeader from '@/components/marketing/Header'
import MarketingFooter from '@/components/marketing/Footer'
import MarketingCTASection from '@/components/marketing/CTASection'
import Hero from '@/components/marketing/Hero'
import WhySection from '@/components/marketing/WhySection'
import DiagramTeaser from '@/components/marketing/DiagramTeaser'
import ExamplesTeaser from '@/components/marketing/ExamplesTeaser'
import OriginTeaser from '@/components/marketing/OriginTeaser'

// Title/description come from the root layout's defaults; this only pins the
// canonical so ?utm=/?next= variants don't index as duplicates (seo #3).
export const metadata: Metadata = {
  alternates: { canonical: '/' },
}

export default function Home() {
  return (
    <div className="dusk-page">
      <MarketingHeader />
      <main id="main">
        <Hero />
        <WhySection />
        <DiagramTeaser />
        <ExamplesTeaser />
        <OriginTeaser />
        <MarketingCTASection
          eyebrow="Always free"
          heading="No paid tier. Not now, not later."
          primaryLabel="Create free account"
          primaryHref="/login?mode=signup"
          secondaryLabel="Browse examples"
          secondaryHref="/examples"
          note="Every layer, every verdict, visible to you — free for good."
        />
      </main>
      <MarketingFooter />
    </div>
  )
}
