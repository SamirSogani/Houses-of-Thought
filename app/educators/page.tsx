import Header from '@/components/Header'
import SheetStrip from '@/components/SheetStrip'
import ScrollRevealInit from '@/components/ScrollReveal'
import EducatorHeroSection from '@/components/sections/EducatorHeroSection'
import EducatorProblemSection from '@/components/sections/EducatorProblemSection'
import EducatorClassroomSection from '@/components/sections/EducatorClassroomSection'
import EducatorDifferenceSection from '@/components/sections/EducatorDifferenceSection'
import EducatorCollabSection from '@/components/sections/EducatorCollabSection'
import EducatorTrustSection from '@/components/sections/EducatorTrustSection'
import CTASection from '@/components/sections/CTASection'
import Footer from '@/components/sections/Footer'

export default function EducatorsPage() {
  return (
    <>
      <ScrollRevealInit />
      <Header />
      <SheetStrip sheet="Sheet 03 / For educators" />
      <main>
        <EducatorHeroSection />
        <EducatorProblemSection />
        <EducatorClassroomSection />
        <EducatorDifferenceSection />
        <EducatorCollabSection />
        <EducatorTrustSection />
        <CTASection
          eyebrow="Get started"
          heading="Bring reasoning into your classroom."
          primaryLabel="Create a classroom"
          primaryHref="/signup?role=educator"
          secondaryLabel="Talk to us"
          secondaryHref="/contact"
          note="Free to start. Set up a class and invite your students in minutes."
        />
      </main>
      <Footer />
    </>
  )
}
