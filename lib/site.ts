// Canonical site identity, in one place. Everything that needs an absolute URL
// (metadataBase, canonicals, Open Graph, sitemap, robots, JSON-LD) reads from
// here so the production domain is configured once.
//
// Resolution order:
//   1. NEXT_PUBLIC_SITE_URL — set this once a custom domain is live.
//   2. VERCEL_PROJECT_PRODUCTION_URL — Vercel injects the project's production
//      domain automatically, so deploys are correct with no configuration.
//   3. localhost — dev.
// Deliberately NOT hardcoded: a canonical pointing at a domain we don't own is
// worse than no canonical at all (seo #3).

function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL
  if (explicit) return explicit.replace(/\/$/, '')
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL
  if (vercel) return `https://${vercel}`
  return 'http://localhost:3000'
}

export const SITE_URL = resolveSiteUrl()

export const SITE_NAME = 'Houses of Thought'

// The one-sentence definition, repeated verbatim across metadata, JSON-LD, and
// llms.txt so answer engines see a single consistent entity description
// (aeo M2).
export const SITE_DESCRIPTION =
  'Houses of Thought is a free critical-thinking tool for students, teachers, and anyone facing a hard question. It turns a question into structured, defensible reasoning — concepts, perspectives, cited evidence, assumptions, and a conclusion you build yourself, with AI that guides instead of deciding.'

export const FOUNDER = 'Samir Sogani'

// Absolute URL for a site-relative path.
export function absoluteUrl(path = '/'): string {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`
}

// Build a page's Metadata with canonical + Open Graph + Twitter all derived
// from one title/description. Without this, a page that sets only `title`
// inherits the ROOT layout's openGraph verbatim, so every link preview on the
// site renders the same headline (seo #3) — Next merges metadata per top-level
// key, it does not backfill og:title from title when a parent defined openGraph.
export function pageMetadata({
  title,
  description,
  path,
  ogTitle,
  type = 'website',
}: {
  title: string
  description: string
  path: string
  // Defaults to `title`; pass explicitly when the tab title and the share
  // headline should differ.
  ogTitle?: string
  type?: 'website' | 'article'
}) {
  const shareTitle = ogTitle ?? title
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type, title: shareTitle, description, url: path, siteName: SITE_NAME },
    twitter: { card: 'summary_large_image' as const, title: shareTitle, description },
  }
}

// Routes that must never be indexed: the authenticated app, auth surfaces, and
// anything that would compete with a marketing page as a thin duplicate.
export const NOINDEX_PREFIXES = [
  '/dashboard',
  '/build',
  '/classroom',
  '/classes',
  '/profile',
  '/admin',
  '/login',
  '/welcome',
  '/house',
  '/join',
  '/forgot-password',
  '/reset-password',
  '/api',
]
