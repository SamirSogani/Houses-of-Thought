// /sitemap.xml (seo #1, aeo C2). Lists every indexable marketing route plus the
// example detail pages, which are the richest and most citable content on the
// site and previously had no discovery path other than the gallery grid.

import type { MetadataRoute } from 'next'
import { absoluteUrl } from '@/lib/site'
import { examples } from '@/lib/examples/data'
import { COMPETITORS } from '@/lib/compare/data'

// Static routes with a rough priority ordering: the conversion surfaces and the
// definitional hub rank above the narrative pages. /framework is deliberately
// absent — it's a permanent redirect to /how-it-works (next.config.ts), which
// carries the definitional-hub role now. /compare and its per-competitor pages
// ARE listed (redesign brief: "needs ... an entry in sitemap.xml") even though
// no visible page links to them — sitemap discovery is the point.
const routes: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] }[] = [
  { path: '/', priority: 1, changeFrequency: 'weekly' },
  { path: '/try', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/how-it-works', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/educators', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/examples', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/faq', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/compare', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/story', priority: 0.6, changeFrequency: 'yearly' },
  { path: '/contact', priority: 0.5, changeFrequency: 'yearly' },
  { path: '/terms', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/privacy', priority: 0.3, changeFrequency: 'yearly' },
]

export default function sitemap(): MetadataRoute.Sitemap {
  // The content is static fixtures, so there is no per-page edit time to report;
  // one build-time stamp is honest and still gives crawlers a freshness signal.
  const lastModified = new Date()
  return [
    ...routes.map((r) => ({
      url: absoluteUrl(r.path),
      lastModified,
      changeFrequency: r.changeFrequency,
      priority: r.priority,
    })),
    ...examples.map((e) => ({
      url: absoluteUrl(`/examples/${e.slug}`),
      lastModified,
      changeFrequency: 'yearly' as const,
      priority: 0.7,
    })),
    ...Object.keys(COMPETITORS).map((slug) => ({
      url: absoluteUrl(`/compare/${slug}`),
      lastModified,
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    })),
  ]
}
