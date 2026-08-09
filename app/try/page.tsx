import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/site'
import MarketingHeader from '@/components/marketing/Header'
import MarketingFooter from '@/components/marketing/Footer'
import TryFlow from '@/components/marketing/TryFlow'

export const metadata: Metadata = pageMetadata({
  title: 'Try It Free — no account needed',
  description:
    'See what a Houses of Thought reasoning run does with your question — no account required.',
  path: '/try',
  ogTitle: 'Try Houses of Thought free — no account needed',
})

export default function TryPage() {
  return (
    <div className="dusk-page">
      <MarketingHeader />
      <main id="main">
        <TryFlow />
      </main>
      <MarketingFooter />
    </div>
  )
}
