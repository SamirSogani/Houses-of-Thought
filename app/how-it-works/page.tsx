import Header from '@/components/Header'
import SheetStrip from '@/components/SheetStrip'
import ScrollRevealInit from '@/components/ScrollReveal'
import HowIntroSection from '@/components/sections/HowIntroSection'
import HowBuildFlowSection from '@/components/sections/HowBuildFlowSection'
import HowAiRoleSection from '@/components/sections/HowAiRoleSection'
import HowCollaborationSection from '@/components/sections/HowCollaborationSection'
import HowOutcomeSection from '@/components/sections/HowOutcomeSection'
import CTASection from '@/components/sections/CTASection'
import Footer from '@/components/sections/Footer'

export default function HowItWorksPage() {
  return (
    <>
      <ScrollRevealInit />
      <Header />
      <SheetStrip sheet="Sheet 02 / How it works" />
      <main>
        <HowIntroSection />
        <HowBuildFlowSection />
        <HowAiRoleSection />
        <HowCollaborationSection />
        <HowOutcomeSection />
        <CTASection
          eyebrow="Start"
          heading="Pick a question you can't crack."
          primaryLabel="Try it free"
          primaryHref="/try"
          secondaryLabel="Read the framework"
          secondaryHref="/framework"
          note="No sign-up needed to try it. Your work saves locally until you create an account."
        />
      </main>
      <Footer />
    </>
  )
}
