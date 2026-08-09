// /compare/[slug] — per-competitor pages. Deliberately unlinked from every
// visible marketing page (redesign brief); reachable by direct URL or search/
// LLM discovery, and cross-linked with the /compare hub in both directions.

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { pageMetadata } from '@/lib/site'
import { COMPETITORS, getCompetitor } from '@/lib/compare/data'
import { CompareTemplate } from '@/components/marketing/CompareTemplate'

export function generateStaticParams() {
  return Object.keys(COMPETITORS).map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const competitor = getCompetitor(slug)
  if (!competitor) return {}
  return pageMetadata({
    title: `Houses of Thought vs. ${competitor.shortName}`,
    description: competitor.intro,
    path: `/compare/${slug}`,
    ogTitle: competitor.headline,
  })
}

export default async function CompetitorComparePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const competitor = getCompetitor(slug)
  if (!competitor) notFound()
  return <CompareTemplate competitor={competitor} />
}
