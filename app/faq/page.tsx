import Header from '@/components/Header'
import SheetStrip from '@/components/SheetStrip'
import ScrollRevealInit from '@/components/ScrollReveal'
import FaqIntroSection from '@/components/sections/FaqIntroSection'
import FaqGroupsSection from '@/components/sections/FaqGroupsSection'
import CTASection from '@/components/sections/CTASection'
import Footer from '@/components/sections/Footer'

export default function FaqPage() {
  return (
    <>
      <ScrollRevealInit />
      <Header />
      <SheetStrip sheet="Sheet 08 / FAQ" />
      <main>
        <FaqIntroSection />
        <FaqGroupsSection />
        <CTASection
          eyebrow="Still curious?"
          heading="The fastest answer is to build one."
          primaryLabel="Try it free"
          primaryHref="/try"
          secondaryLabel="How it works"
          secondaryHref="/how-it-works"
          note="No sign-up needed to try it. Your work saves locally until you create an account."
        />
      </main>
      <Footer />
    </>
  )
}
