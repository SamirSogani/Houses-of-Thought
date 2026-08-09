import type { NextConfig } from 'next'

// Baseline security headers (security audit H3). Applied to every response via
// headers() below. CSP is deliberately conservative but functional for this
// app: it uses no inline event handlers, but it does render a few inline
// <style>/<script> (Next bootstrap, styled-jsx, one JSON-LD block), so
// 'unsafe-inline' is required for style-src and script-src until a nonce-based
// CSP is wired through the App Router. connect-src allows Supabase (env-derived)
// plus Vercel analytics. Tighten to nonces before claiming report-free CSP.
const supabaseHost = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
      : ''
  } catch {
    return ''
  }
})()

// React's dev server uses eval() for debugging features; production never does.
// Allow it only in development so the strict production CSP stays eval-free.
const scriptSrc =
  process.env.NODE_ENV === 'production'
    ? "script-src 'self' 'unsafe-inline'"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval'"

const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  scriptSrc,
  `connect-src 'self' ${supabaseHost} https://*.supabase.co https://*.vercel-insights.com https://*.vercel-scripts.com`.trim(),
  "upgrade-insecure-requests",
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
]

const nextConfig: NextConfig = {
  // Pin the workspace root to this project. A stray package-lock.json in the
  // home directory otherwise makes Next infer the wrong root directory.
  turbopack: { root: process.cwd() },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
  async redirects() {
    return [
      // /framework described the House Builder's own layer model (Frame,
      // Perspectives, Evidence, Assumptions, Conclusion, Implications,
      // Review) — a different, real feature from the automated reasoning
      // pipeline this redesign's How It Works page now explains in full
      // (lib/ai/reasoning/steps.ts's Frame → Breadth Scoping → Perspectives →
      // Global Assumptions → Global Evidence → Conclusions → Implications).
      // Keeping both live under separate nav items would present visitors
      // with two different "the 7 layers" claims. Permanent redirect so any
      // existing links/citations still land on the current explainer.
      { source: '/framework', destination: '/how-it-works', permanent: true },
    ]
  },
}

export default nextConfig
