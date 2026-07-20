import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/site'
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

export const metadata: Metadata = pageMetadata({
  title: 'How It Works: the 7-layer reasoning framework',
  description:
    'How Houses of Thought works, step by step: frame the question, build perspectives, ground it in cited evidence, surface assumptions, and reach a conclusion you can defend.',
  path: '/how-it-works',
})

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
          note="No sign-up needed to try it. Create a free account when you want to build and save full houses."
        />
      </main>
      <Footer />
    </>
  )
}
