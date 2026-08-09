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
  'Houses of Thought is a critical-thinking tool for students, teachers, and anyone facing a hard question. It turns a question into structured, defensible reasoning — concepts, perspectives, cited evidence, assumptions, and a conclusion you build yourself, with AI that guides instead of deciding.'

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

// Pre-login nav, shared by components/marketing/Header.tsx and Footer.tsx so
// the header and footer (and the mobile sheet) can never drift out of sync
// with each other. This is the VISIBLE sitemap only — /compare and its
// per-competitor pages are deliberately reachable by direct URL alone (see
// their own page files), so they are never listed here.
export const MARKETING_NAV_LINKS = [
  { label: 'How it works', href: '/how-it-works' },
  { label: 'Examples', href: '/examples' },
  { label: 'For Educators', href: '/educators' },
  { label: 'FAQ', href: '/faq' },
] as const

export const MARKETING_FOOTER_GROUPS = [
  {
    heading: 'Product',
    links: [
      { label: 'Try it', href: '/try' },
      { label: 'How it works', href: '/how-it-works' },
      { label: 'Examples', href: '/examples' },
    ],
  },
  {
    heading: 'Learn',
    links: [
      { label: 'For Educators', href: '/educators' },
      { label: 'Our Story', href: '/story' },
      { label: 'FAQ', href: '/faq' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { label: 'Terms', href: '/terms' },
      { label: 'Privacy', href: '/privacy' },
      { label: 'Contact', href: '/contact' },
    ],
  },
] as const

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
