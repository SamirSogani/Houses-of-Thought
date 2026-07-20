import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/site'
import Header from '@/components/Header'
import SheetStrip from '@/components/SheetStrip'
import ScrollRevealInit from '@/components/ScrollReveal'
import StoryIntroSection from '@/components/sections/StoryIntroSection'
import StoryChaptersSection from '@/components/sections/StoryChaptersSection'
import CTASection from '@/components/sections/CTASection'
import Footer from '@/components/sections/Footer'

export const metadata: Metadata = pageMetadata({
  title: 'Our Story',
  description:
    'Why Houses of Thought exists: a student watching smart people make messy decisions, and a teacher — John Trapasso — whose House of Reason model, derived from Paul–Elder, gave the missing structure.',
  path: '/story',
  ogTitle: 'The story behind Houses of Thought',
  type: 'article',
})

export default function StoryPage() {
  return (
    <>
      <ScrollRevealInit />
      <Header />
      <SheetStrip sheet="Sheet 07 / Our story" />
      <main id="main">
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
