// /terms — renders legal/TERMS_OF_SERVICE.md (single source of truth; the page
// never duplicates its content). Quiet legal template per
// plans/active/pre-login-ux/pages-content.md.

import fs from 'node:fs'
import path from 'node:path'
import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/site'
import Header from '@/components/Header'
import SheetStrip from '@/components/SheetStrip'
import Footer from '@/components/sections/Footer'
import { LegalArticle, DraftNotice } from '@/components/legal/LegalArticle'

export const metadata: Metadata = pageMetadata({
  title: 'Terms of Service',
  description:
    'The terms that govern using Houses of Thought, including accounts, classroom use, AI features and their limits, and acceptable use.',
  path: '/terms',
})

export default function TermsPage() {
  const markdown = fs.readFileSync(path.join(process.cwd(), 'legal', 'TERMS_OF_SERVICE.md'), 'utf8')
  return (
    <>
      <Header />
      <SheetStrip sheet="Sheet 98 / Terms" />
      <main>
        <section style={{ background: 'var(--parchment)', paddingBlock: 'clamp(36px, 5vw, 64px)' }}>
          <div className="container">
            <DraftNotice />
            <LegalArticle markdown={markdown} />
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
