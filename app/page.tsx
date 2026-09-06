import type { Metadata } from 'next'
import MarketingHeader from '@/components/marketing/Header'
import MarketingFooter from '@/components/marketing/Footer'
import MarketingCTASection from '@/components/marketing/CTASection'
import Hero from '@/components/marketing/Hero'
import WhySection from '@/components/marketing/WhySection'
import SocialProof from '@/components/marketing/SocialProof'
import DemoVideo from '@/components/marketing/DemoVideo'
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
        <SocialProof />

        {/* Demo video — placeholder until a real recording is ready */}
        <section style={{ paddingBlock: 'var(--section-py)', borderTop: '1px solid var(--dusk-rule)' }}>
          <div className="container">
            <div style={{ maxWidth: '52ch' }}>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--amber)' }}>
                See it in action
              </p>
              <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 'clamp(28px, 4vw, 42px)', letterSpacing: '-0.01em', color: 'var(--dusk-ink)', marginTop: 12 }}>
                Build a house in 60 seconds.
              </h2>
            </div>
            <div style={{ marginTop: 28, maxWidth: 800 }}>
              <DemoVideo />
            </div>
          </div>
        </section>

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
          note="Every layer, every verdict, visible to you. Free for good."
        />
      </main>
      <MarketingFooter />
    </div>
  )
}
