# SEO & Discoverability Audit — Houses of Thought

**Auditor:** seo-auditor (subagent, model: Fable) · read-only · 2026-07-19

Stack context: Next.js 16 App Router, no `public/` directory at all, one root
`layout.tsx`, marketing pages composed from `components/sections/*`. Verified
pages, metadata exports, middleware, config, and assets across the repo.

> **Correction to the brief:** `'use client'` pages in the App Router are still
> server-rendered to HTML, so `/try` and `/examples` are **not** empty shells for
> crawlers — verified their copy is in the initial payload. The real client-page
> costs here are the metadata lock-out and bundle weight (findings #6 and #2).

---

## CRITICAL

### 1. No indexing plumbing whatsoever — robots.txt, sitemap.xml, favicon all missing
- **Where:** repo-wide. There is no `public/` directory, no `app/robots.ts|txt`, no `app/sitemap.ts|xml`, no `app/icon.*`, no `app/favicon.ico`, no `app/manifest.*`. The only brand asset is `assets/branding/favicon.svg`, which Next.js does not serve from there.
- **Impact:** Crawlers get a 404 on `/robots.txt` and `/sitemap.xml`; there is no crawl guidance, no discovery aid for the example detail pages, and `/favicon.ico` 404s (the middleware matcher at `middleware.ts:48` even carves it out, expecting it to exist). SERP results and browser tabs show a generic icon, which measurably hurts click-through.
- **Fix:** Add `app/robots.ts` (allow marketing routes, disallow `/dashboard`, `/build`, `/classroom`, `/classes`, `/profile`, `/house`, `/welcome`, `/admin`, `/login`, `/join`, `/api`), `app/sitemap.ts` (7 marketing routes + `examples.map(e => /examples/${e.slug})` from `lib/examples/data.ts`), and move `assets/branding/favicon.svg` to `app/icon.svg` plus a fallback `app/favicon.ico`.

### 2. Six of eight indexable routes share one identical title and description
- **Where:** the only metadata exports in the repo are `app/layout.tsx:27` (site default) and `app/try/page.tsx:7`. `/`, `/how-it-works`, `/educators`, `/examples`, `/story`, `/faq`, and every `/examples/[slug]` page all render the same `<title>Houses of Thought — Structured, Defensible Reasoning</title>` and same description.
- **Impact:** Duplicate titles are one of the strongest negative signals for both ranking (pages compete with each other, Google rewrites titles) and click-through (every SERP entry looks identical). The example detail pages — the richest, most keyword-laden content on the site (443 lines of rendered reasoning per house) — are invisible as distinct pages.
- **Fix:** Add `export const metadata` to each server marketing page (`/how-it-works`, `/educators`, `/story`, `/faq` are all server components — 5-line change each), add `generateMetadata` to `app/examples/[slug]/page.tsx` using `example.house.title` + `example.summary`, and set a `title: { default, template: '%s — Houses of Thought' }` in the root layout. Target keywords worth working in: "critical thinking framework", "structured reasoning tool", "critical thinking for students/classrooms", "Paul–Elder" (already name-dropped in `SheetStrip.tsx`).

### 3. No `metadataBase`, no canonical URLs, no Open Graph, no Twitter cards, no og:image
- **Where:** `app/layout.tsx:27-31` is the entire metadata surface. Grep confirms zero `openGraph`, `twitter`, `alternates`, or `metadataBase` anywhere; no `opengraph-image.*` files; the repo contains no raster images at all.
- **Impact:** Any share of any URL to Slack, iMessage, X, LinkedIn, or a teacher Facebook group renders as a bare blue link. For a product spread teacher-to-teacher, social/link-preview presentation is arguably the highest-leverage discoverability channel, and it's at zero. Missing canonicals also risk `?next=`/UTM parameter duplicates being indexed separately. Next.js falls back to `localhost`/deployment URL for relative OG assets without `metadataBase`.
- **Fix:** In root layout: `metadataBase: new URL('https://<production-domain>')` (no domain is recorded anywhere in the repo — decide and pin it), `alternates: { canonical: './' }` pattern per page, an `openGraph` + `twitter: { card: 'summary_large_image' }` block, and one 1200×630 `app/opengraph-image.png` (a rendered "house" diagram would be on-brand). Per-example OG images can come later via `ImageResponse`.

### 4. Site-wide footer and mobile nav link to four 404s — with no custom 404 page
- **Where (confirmed, per prior audits):** `components/sections/Footer.tsx:12` (`/framework`), `:27` (`/terms`), `:28` (`/privacy`), `:29` (`/contact`); `components/Header.tsx:280,282` (`/framework`, `/contact` in the mobile sheet). No `app/not-found.tsx` exists, so all four render the unbranded default Next 404.
- **Impact:** Every page on the site emits four internal links to 404s — wasted crawl budget, diluted internal PageRank, and a soft quality signal against the site. Missing `/privacy` and `/terms` is worse than SEO: the FAQ answer in `components/sections/FaqGroupsSection.tsx` ("Our Privacy and Terms cover the full detail") points at pages that don't exist — a trust problem for exactly the school-procurement audience being courted, and a page-level E-E-A-T signal Google looks for. **(The content exists at `legal/TERMS_OF_SERVICE.md` and `legal/PRIVACY_POLICY.md` — it needs routing + placeholder cleanup, not authoring from scratch.)**
- **Fix:** Short-term: remove or de-link the four hrefs. Real fix: ship `/privacy` and `/terms` as static pages from the existing `legal/` content, decide whether `/framework` and `/contact` become pages or redirects (e.g. `/framework` → `/how-it-works`). Add a branded `app/not-found.tsx` with nav links either way.

---

## HIGH

### 5. Auth/app routes have no noindex and several aren't even auth-gated
- **Where:** zero `robots: { index: false }` exports in the repo. `middleware.ts:5` protects only `/dashboard`, `/build`, `/profile`, `/classroom`, `/join`. That leaves `/login`, `/welcome`, `/house`, `/classes`, and `/admin` publicly reachable and indexable.
- **Impact:** Protected routes 302 to `/login` for crawlers (acceptable), but the unprotected five can enter the index as thin/duplicate pages. `/house` is explicitly a duplicate of the `/try` surface (per its own header comment, `app/house/page.tsx:3-7`), competing with the page you want ranking. Side observation: `app/classes/page.tsx:5` claims "Auth is enforced by middleware," but `/classes` is not in `PROTECTED_PREFIXES` — worth a separate look.
- **Fix:** `robots: { index: false, follow: false }` via a layout-level metadata export for the app cluster (a shared `app/(app)/layout.tsx` route group would do it in one place), plus the robots.txt disallows from finding #1. Decide whether `/house` should 301 to `/try`.

### 6. `/examples` gallery is a client component and cannot carry metadata
- **Where:** `app/examples/page.tsx:1` (`'use client'`).
- **Impact:** One accuracy note first: in the App Router, `'use client'` pages are still server-rendered to HTML, so crawlers do get the gallery content — the "empty shell" failure mode does not apply here, and the FAQ answers, example cards, and try-page copy are all in the initial HTML. The real costs: (a) a client page cannot export `metadata`, so `/examples` is structurally locked out of fixing finding #2; (b) the entire example dataset (`lib/examples/data.ts`) plus strength-scoring logic ships in the client bundle; (c) hover styling is done via `onMouseEnter` JS handlers instead of CSS, inflating the bundle further.
- **Fix:** Split it: keep `app/examples/page.tsx` as a server component holding metadata, the h1/intro, and the card grid; move only the filter-chip state into a small client child. Same pattern applies if `/faq` ever grows — `FaqGroupsSection.tsx` is client only for accordion state.

### 7. `data-reveal` hides content until JavaScript runs
- **Where:** `app/globals.css:175-180` sets `[data-reveal] { opacity: 0; transform: translateY(12px) }` unconditionally; `components/ScrollReveal.tsx` reveals via IntersectionObserver. 16 section components use it — including the h1-bearing intro sections of `/how-it-works`, `/story`, `/faq`, and `/educators` (`HowIntroSection`, `StoryIntroSection`, `FaqIntroSection`, `EducatorHeroSection:24`).
- **Impact:** The content is in the HTML (fine for Googlebot's renderer), but: with JS disabled or failed, four marketing pages render visually blank above the fold; the LCP element starts at opacity 0 and paints only after hydration + observer callback + 480ms transition, degrading LCP; and rendering-based crawlers that screenshot early see empty pages. The home hero itself is safe (no `data-reveal` on `HeroSection`'s h1).
- **Fix:** Invert to progressive enhancement: default `opacity: 1`, and have `ScrollRevealInit` add a `js-reveal` class to `<html>` that opts elements into the hidden-then-reveal behavior. One CSS change, no component edits.

### 8. Middleware calls Supabase auth on every marketing-page request
- **Where:** `middleware.ts:31-33` — `supabase.auth.getUser()` runs before the `isProtected` check; the matcher (`:48`) covers `/`, `/faq`, `/examples`, etc.
- **Impact:** Every marketing page view pays a network round-trip to Supabase before the response starts — a direct TTFB penalty on exactly the routes where Core Web Vitals feed ranking.
- **Fix:** Either narrow the matcher to the protected prefixes, or move the `isProtected` check above the `getUser()` call and return early for public routes.

---

## MEDIUM

### 9. No structured data at all
- **Where:** grep for `ld+json` / `schema.org` returns nothing.
- **Impact / opportunity, in value order:**
  - **FAQPage** on `/faq` — the 15 Q&As already live as clean `{question, answer}` arrays in `components/sections/FaqGroupsSection.tsx:9`; emitting JSON-LD from that same data is nearly free and targets rich-result eligibility.
  - **Organization** (or `EducationalOrganization`) sitewide in `app/layout.tsx` — name, logo, URL; feeds the knowledge panel and brand SERP.
  - **BreadcrumbList** on `/examples/[slug]` (Examples → title).
  - Course/`LearningResource` markup is a stretch today (no course-shaped public content); revisit when curriculum pages exist.
- **Fix:** Inline `<script type="application/ld+json">` in the relevant server components, sourced from the existing data arrays so there's one source of truth.

### 10. No web manifest, theme-color, or apple-touch-icon
- **Where:** nothing in `app/` beyond the three files noted; no `viewport`/`themeColor` export.
- **Impact:** Minor ranking effect, but affects add-to-homescreen for classroom tablets/Chromebooks — a real usage pattern for this audience — and iOS shows a screenshot-derived blob when teachers pin the app.
- **Fix:** `app/manifest.ts`, a 180×180 `app/apple-icon.png`, `themeColor: '#F7F6F2'` (parchment) via the viewport export.

### 11. Default 404 handling for the whole app-route surface
- Covered partly in #4: with no `app/not-found.tsx`, any mistyped URL, expired `/join/[code]`, or removed example slug (the `[slug]` page correctly calls `notFound()` at `app/examples/[slug]/page.tsx:67`) lands on the raw framework 404 with no navigation back — lost crawl equity and lost users. One file fixes all cases.

### 12. Root title/description quality (once uniqueness is fixed)
- `app/layout.tsx:28` — "Houses of Thought — Structured, Defensible Reasoning" (53 chars, fine) and a ~157-char description (right at the truncation edge). Neither contains the phrases the target audience actually searches ("critical thinking", "classroom", "students", "teachers"). "Structured, defensible reasoning" is brand language, not query language. The `/educators` page especially should carry education-intent keywords in its (currently nonexistent) metadata.

---

## LOW / POSITIVE FINDINGS (no action or minor)

- **`lang="en"`** present (`app/layout.tsx:40`). Good.
- **Fonts:** `next/font/google` with `display: 'swap'` and CSS variables (`app/layout.tsx:6-25`) — self-hosted, non-blocking, no CLS from FOIT. Good.
- **One h1 per page, correct hierarchy:** verified on all seven marketing routes (hero/intro h1 → section h2 → card h3). `/examples`' h1 uses visual class `h2` — semantically fine.
- **Images:** there are zero `<img>`/`next/image` elements on marketing pages (all visuals are inline SVG). No alt-text debt, no image-payload issue — but also nothing for image search or OG (see #3). Decorative SVGs correctly carry `aria-hidden` in the spots checked.
- **Static rendering:** all server marketing pages are static-eligible (no dynamic APIs), and `/examples/[slug]` uses `generateStaticParams` (`app/examples/[slug]/page.tsx:26`). Good.
- **Internal linking:** healthy mesh — header nav (4 links), footer (7 valid + 4 dead), and every page ends in a `CTASection` cross-linking `/try` and `/how-it-works` with descriptive anchor text. No "click here" anti-patterns found.
- **Descriptive anchors:** CTA labels ("Try it free", "How it works", "For Educators") are fine.
- **Minor bundle note:** `Header.tsx` and `Footer.tsx` are client components largely for hover/scroll effects; converting hover handlers to CSS would let `Footer` be a server component. Marginal.

---

## Prioritized action list

**Quick wins (each < 1 hour, do first):**
1. Decide/pin the production domain; add `metadataBase` + `title.template` to `app/layout.tsx`.
2. Add `app/robots.ts` and `app/sitemap.ts`.
3. Move `assets/branding/favicon.svg` → `app/icon.svg`; add `app/favicon.ico`.
4. Add `metadata` exports to `/how-it-works`, `/educators`, `/story`, `/faq` and `generateMetadata` to `/examples/[slug]`.
5. Remove or retarget the four dead footer/nav links (`Footer.tsx:12,27-29`, `Header.tsx:280,282`); add `app/not-found.tsx`.
6. Create one `app/opengraph-image.png` + `openGraph`/`twitter` metadata in the root layout.
7. Flip the `data-reveal` CSS to progressive enhancement (`globals.css:175`).
8. Early-return in `middleware.ts` for non-protected paths.
9. Emit FAQPage + Organization JSON-LD from existing data.

**Structural (plan as small projects):**
10. Ship real `/privacy` and `/terms` pages (also unblocks school trust); resolve `/framework` and `/contact`.
11. Refactor `app/examples/page.tsx` into server shell + client filter so it can carry metadata and shed bundle weight.
12. Add noindex (route-group layout) to `/login`, `/welcome`, `/house`, `/classes`, `/admin`; decide `/house` → `/try` redirect. (Separately: `/classes` appears to be missing from the middleware auth allowlist despite its comment — worth its own review.)
13. Web manifest + apple icon + theme color.
14. Keyword pass on all titles/descriptions toward educator search language once uniqueness lands.
