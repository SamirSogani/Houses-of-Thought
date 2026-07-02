import Header from '@/components/Header'
import SheetStrip from '@/components/SheetStrip'
import ScrollRevealInit from '@/components/ScrollReveal'
import StoryIntroSection from '@/components/sections/StoryIntroSection'
import StoryChaptersSection from '@/components/sections/StoryChaptersSection'
import CTASection from '@/components/sections/CTASection'
import Footer from '@/components/sections/Footer'

export default function StoryPage() {
  return (
    <>
      <ScrollRevealInit />
      <Header />
      <SheetStrip sheet="Sheet 07 / Our story" />
      <main>
        <StoryIntroSection />
        <StoryChaptersSection />
        <CTASection
          eyebrow="Your turn"
          heading="Build your first house."
          primaryLabel="Try it instantly"
          primaryHref="/try"
          secondaryLabel="Read the framework"
          secondaryHref="/framework"
          note="Try it on a real decision you've been putting off."
        />
      </main>
      <Footer />
    </>
  )
}
