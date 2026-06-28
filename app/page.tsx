import Header from '@/components/Header'
import SheetStrip from '@/components/SheetStrip'
import ScrollRevealInit from '@/components/ScrollReveal'
import HeroSection from '@/components/sections/HeroSection'
import ProblemSection from '@/components/sections/ProblemSection'
import InteractiveHouseSection from '@/components/sections/InteractiveHouseSection'
import HowItWorksSection from '@/components/sections/HowItWorksSection'
import DifferentiatorSection from '@/components/sections/DifferentiatorSection'
import EducatorsSection from '@/components/sections/EducatorsSection'
import ExampleTeaserSection from '@/components/sections/ExampleTeaserSection'
import OriginQuoteSection from '@/components/sections/OriginQuoteSection'
import FinalCtaSection from '@/components/sections/FinalCtaSection'
import Footer from '@/components/sections/Footer'

export default function Home() {
  return (
    <>
      <ScrollRevealInit />
      <Header />
      <SheetStrip />
      <main>
        <HeroSection />
        <ProblemSection />
        <InteractiveHouseSection />
        <HowItWorksSection />
        <DifferentiatorSection />
        <EducatorsSection />
        <ExampleTeaserSection />
        <OriginQuoteSection />
        <FinalCtaSection />
      </main>
      <Footer />
    </>
  )
}
