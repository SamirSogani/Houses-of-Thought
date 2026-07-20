import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/site'
import Header from '@/components/Header'
import SheetStrip from '@/components/SheetStrip'
import Footer from '@/components/sections/Footer'
import TryItFlow from '@/components/try/TryItFlow'

export const metadata: Metadata = pageMetadata({
  title: 'Try It Free — no account needed',
  description:
    'Run a free Mini House on any real question. Structured, sourced, and surprisingly clarifying — no account required.',
  path: '/try',
  ogTitle: 'Try Houses of Thought free — no account needed',
})

export default function TryPage() {
  return (
    <>
      <Header />
      <SheetStrip sheet="Sheet 00 / Try it" />
      <main id="main">
        <TryItFlow />
      </main>
      <Footer />
    </>
  )
}
