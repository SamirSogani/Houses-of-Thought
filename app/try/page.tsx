import type { Metadata } from 'next'
import Header from '@/components/Header'
import SheetStrip from '@/components/SheetStrip'
import Footer from '@/components/sections/Footer'
import TryItFlow from '@/components/try/TryItFlow'

export const metadata: Metadata = {
  title: 'Try It Instantly — Houses of Thought',
  description:
    'Run a free Mini House on any real question. Structured, sourced, and surprisingly clarifying — no account required.',
}

export default function TryPage() {
  return (
    <>
      <Header />
      <SheetStrip sheet="Sheet 00 / Try it" />
      <main>
        <TryItFlow />
      </main>
      <Footer />
    </>
  )
}
