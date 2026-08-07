import type { Metadata } from 'next'
import Header from '@/components/Header'
import ScrollRevealInit from '@/components/ScrollReveal'
import HeroSection from '@/components/sections/HeroSection'
import ProblemSection from '@/components/sections/ProblemSection'
import InteractiveHouseSection from '@/components/sections/InteractiveHouseSection'
import HowItWorksSection from '@/components/sections/HowItWorksSection'
import DifferentiatorSection from '@/components/sections/DifferentiatorSection'
import RationaleComparisonSection from '@/components/sections/RationaleComparisonSection'
import EducatorsSection from '@/components/sections/EducatorsSection'
import ExampleTeaserSection from '@/components/sections/ExampleTeaserSection'
import OriginQuoteSection from '@/components/sections/OriginQuoteSection'
import FinalCtaSection from '@/components/sections/FinalCtaSection'
import Footer from '@/components/sections/Footer'

// Title/description come from the root layout's defaults; this only pins the
// canonical so ?utm=/?next= variants don't index as duplicates (seo #3).
export const metadata: Metadata = {
  alternates: { canonical: '/' },
}

export default function Home() {
  return (
    <>
      <ScrollRevealInit />
      <Header />
      <main id="main">
        <HeroSection />
        <ProblemSection />
        <InteractiveHouseSection />
        <HowItWorksSection />
        <DifferentiatorSection />
        <RationaleComparisonSection />
        <EducatorsSection />
        <ExampleTeaserSection />
        <OriginQuoteSection />
        <FinalCtaSection />
      </main>
      <Footer />
    </>
  )
}
