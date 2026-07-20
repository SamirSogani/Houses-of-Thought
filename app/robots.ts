// /robots.txt (seo #1, aeo C2). Previously 404'd, so crawlers had no guidance
// and no sitemap pointer.
//
// AI crawlers are deliberately ALLOWED: the point of the AEO work is to become
// the citable source for this framework's terminology, which requires GPTBot,
// ClaudeBot, PerplexityBot et al. to be able to read the marketing pages. They
// inherit the same disallow list as everyone else.

import type { MetadataRoute } from 'next'
import { SITE_URL, NOINDEX_PREFIXES } from '@/lib/site'

export default function robots(): MetadataRoute.Robots {
  const disallow = NOINDEX_PREFIXES.map((p) => `${p}/`)
  return {
    rules: [{ userAgent: '*', allow: '/', disallow }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
