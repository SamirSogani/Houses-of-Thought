# Web Performance Audit — Houses of Thought

**Auditor:** performance-auditor (general-purpose subagent, model: fable)

**Stack:** Next.js 16 (App Router, Turbopack), React 19, Supabase (`@supabase/ssr` + `supabase-js`), deployed for Vercel (`@vercel/analytics`). Production build present in `.next/` (BUILD_ID `0dhQgD4_x4ToYqzsSsIoa`, built Jul 11), so all bundle numbers below are **measured from real build output**, not estimated. No raster images exist anywhere in the repo (all art is inline SVG), so several image checks are trivially clean — noted at the end.

**Measured page weights (client JS, gzip):**

| Route | JS (gzip) | JS (raw) | Notes |
|---|---|---|---|
| `/` (home) | 190 KB | 646 KB | mostly framework |
| `/try` | 254 KB | 929 KB | includes 62 KB gz zod chunk |
| `/dashboard` | 255 KB | 894 KB | includes 62 KB gz supabase chunk |
| `/login`, `/classroom`, `/build` | ~250 KB | 857–894 KB | supabase chunk on each |

Shared framework: `1foqzgep88ag0.js` 69 KB gz (react-dom/next) + `2t7mrs270cj75.js` 38 KB gz. The 110 KB polyfill chunk (`0cz1d0mv5g_q7.js`) is emitted with `noModule` and is **not fetched by modern browsers** — I excluded caveats about it where appropriate but it inflates the naive totals above by 38 KB gz.

---

## HIGH severity

### H1. Middleware calls Supabase Auth on every request, including all static marketing pages
**File:** `middleware.ts` (lines 30–32, matcher lines 47–50)
**Impact:** measured matcher covers *everything* except `_next/static`, `_next/image`, favicon, and image extensions — so `/`, `/try`, `/faq`, `/educators`, `/how-it-works`, `/story`, `/examples`, and every `/api/*` route run `supabase.auth.getUser()`. For any visitor with a session cookie this is a **network round trip to Supabase Auth (~100–300 ms) added to TTFB on every navigation and every API call**, in front of pages that are otherwise fully prerendered static HTML (all marketing routes have `.html` in `.next/server/app`). For anonymous visitors the call short-circuits locally, so this mainly punishes your logged-in users — the ones navigating most.
**Fix:** (a) Restrict `config.matcher` to the five protected prefixes (`/dashboard`, `/build`, `/profile`, `/classroom`, `/join`) plus any API routes that need auth; (b) on those routes, prefer `supabase.auth.getClaims()` (local JWT verification in current `@supabase/ssr`) over the network-bound `getUser()`.

### H2. Authed pages are fully client-rendered with serial request waterfalls
**Files:** `app/dashboard/page.tsx` (lines 39–60), `app/classroom/page.tsx` (lines 44–74), `app/build/[id]/page.tsx` (lines 40–49), plus `/classes`, `/profile`, `/welcome`, `/join/[code]` — all `'use client'` pages fetching in `useEffect`.
**Impact:** the dashboard sequence is: middleware `getUser()` (network) → HTML → download/parse ~255 KB gz JS → hydrate → **client `getUser()` again (network) → `profiles` query → `houses` query**, strictly serial. That is 3 extra serial round trips *after* hydration, each ~100–300 ms to Supabase — realistically **1.5–2.5 s of blank/skeleton state** before meaningful content. `classroom` is worse (getUser → profiles → classes → class_members = 4 serial). LCP on these pages is effectively gated on the last query. The comment in dashboard even notes middleware already authenticated the user, yet `getUser()` is re-fetched client-side.
**Fix:** Convert these pages to Server Components that fetch via `lib/supabase/server.ts` (auth, profile, and houses can be issued with `Promise.all` server-side, one region-local hop each), streaming HTML with data already present. Short of that, at minimum parallelize the client queries with `Promise.all` (as `build/[id]` partially does) and drop the redundant `getUser()`.

### H3. Zod v4 (277 KB raw / 62 KB gzip) shipped to the `/try` client bundle for six constants
**Files:** `components/try/TryItFlow.tsx` (lines 13–21) importing runtime values from `lib/ai/mini-house.ts`
**Impact:** measured — chunk `0a475u_q5i_dd.js` (277 KB raw, 62 KB gz, 485 zod-string occurrences) loads on `/try`, your primary pre-login conversion page, making it the **heaviest page in the app (254 KB gz)**. The client only needs `MINI_HOUSE_EXAMPLES`, min/max chars, build stages, two timing constants, and the `MiniHouse` *type*. Because those live in the same module as the zod schemas, the whole schema graph (and zod itself) is pulled in; `MiniHouseResult.tsx` correctly uses `import type` and contributes nothing.
**Fix:** Split `lib/ai/mini-house.ts` into `mini-house-shared.ts` (constants + plain TS types, zero deps) and keep the zod schemas in a server-only module (add `import 'server-only'` to enforce it). Saves ~62 KB gz / ~277 KB parse on `/try`. Same audit applies to `lib/ai/findings.ts` if any client imports it.

### H4. LCP element hidden at `opacity: 0` until React hydrates on four marketing pages
**Files:** `app/globals.css` (lines 175–184: `[data-reveal] { opacity: 0; transform: translateY(12px) }`), applied to above-the-fold H1 containers in `components/sections/HowIntroSection.tsx:4`, `StoryIntroSection.tsx:4`, `FaqIntroSection.tsx:4`, `EducatorHeroSection.tsx:18,64`, revealed only by `components/ScrollReveal.tsx` (IntersectionObserver added in `useEffect`).
**Impact:** on `/how-it-works`, `/story`, `/faq`, `/educators` the hero H1 — the LCP candidate — is invisible in the prerendered HTML and only appears after **full JS download + hydration + observer callback**, pushing LCP from "first paint of static HTML" (potentially <1 s) to whenever ~190 KB gz of JS executes (easily 2.5–4 s on mid-tier mobile). If JS fails or is disabled, the content never appears. Note the home page hero (`HeroSection.tsx`) does *not* use `data-reveal` — only `/` is safe.
**Fix:** Never apply the hidden state above the fold. Options: (a) add a `no-js`-style guard — set `opacity: 0` only under an `html.js` class toggled by a tiny inline script; (b) exclude hero/intro sections from `data-reveal`; (c) use CSS-only `animation-timeline: view()` with a keyframe that starts visible for browsers without support.

---

## MEDIUM severity

### M1. Full `supabase-js` (incl. Realtime client) in every authed page bundle
**Measured:** chunk `3g0td-2r1ze3i.js` — 240 KB raw / 62 KB gz, containing supabase + realtime (websocket client) code, loaded on `/dashboard`, `/login`, `/classroom`, `/build`, etc.
**Impact:** the Realtime module ships even though no `.channel()`/realtime usage exists in the app; `supabase-js` does not tree-shake it. 62 KB gz of parse/compile ahead of hydration on every authed page.
**Fix:** Largely subsumed by H2 — moving reads to Server Components leaves the browser client needed only for auth flows (login) and mutations. If client fetching stays, this cost is structural; you can trim by instantiating one shared client (already done via `lib/supabase/client.ts`) and accepting the weight, or watch for `supabase-js` v3 modular builds.

### M2. Sticky header changes height on scroll — real CLS source
**Files:** `components/Header.tsx` (lines 22–33) + `.site-header` transition in `app/globals.css` (lines 245–255)
**Impact:** on scroll past 24 px, `paddingBlock` animates 18 px → 11 px. The header is `position: sticky` (in-flow), so the whole document below shifts up 14 px. Scrolling does **not** qualify for CLS's 500 ms input exclusion (only discrete inputs do), so this registers as a layout shift on nearly every page view that scrolls. Estimated contribution ~0.01–0.02 per crossing — enough to push a borderline page over the 0.1 "good" threshold, and it fires in both directions.
**Fix:** Keep the header's outer height constant; achieve the "condensed" look by animating `background`, `border-bottom`, and an inner element's `transform: scaleY()`/margin, or switch to `position: fixed` with a fixed-height spacer.

### M3. Three font families, ~135 KB of preloaded WOFF2 on the critical path
**Files:** `app/layout.tsx` (lines 6–25); measured in `.next/static/media`: preloaded (`-s.p.`) files = 67 KB (Fraunces variable w/ `opsz`) + 45 KB (Inter Tight) + 23 KB (Geist Mono) = **135 KB fonts preloaded on every page**; 456 KB total font media across subsets.
**Impact:** `display: 'swap'` is set (good — FOUT, no FOIT), and `next/font` self-hosts with preload + immutable caching (good). But three families is generous: Geist Mono is used only for tiny uppercase eyebrow/label text at 11–12 px. 135 KB of high-priority font bytes compete with the LCP H1's own font (Fraunces) for early bandwidth on mobile.
**Fix:** Consider rendering eyebrow labels in Inter Tight with `letter-spacing` (drops ~23 KB preload + 2 weights), and check whether Inter Tight really needs three weights (400/500/600 — 500 and 600 are visually close at body sizes). Keep Fraunces; it's the brand voice and the LCP font.

### M4. No `preconnect` to the Supabase origin
**Measured:** zero `preconnect`/`dns-prefetch` hints in the repo; first client-side Supabase call on `/login`, `/dashboard`, etc. pays DNS + TCP + TLS (~100–250 ms) before the first query byte, stacked on top of the H2 waterfall.
**Fix:** In the layout (or an authed-area layout), add `<link rel="preconnect" href={process.env.NEXT_PUBLIC_SUPABASE_URL} crossOrigin="" />`. One line, saves a connection setup on every authed cold navigation. (Becomes moot for reads if H2 moves them server-side, but still helps auth/mutations.)

### M5. Marketing/static pages hydrate more than they need
**Files:** home page sections — `components/sections/HeroSection.tsx` (`'use client'` only to run a 1.7 s cleanup timer, lines 8–16), `InteractiveHouseSection.tsx`, `Header.tsx`, `Footer.tsx`, `FaqGroupsSection.tsx`; `/examples` is an entirely client page (`app/examples/page.tsx`) shipping `lib/examples/data.ts` (19.7 KB source) as JS to filter a static list.
**Impact:** the home page is prerendered (LCP text paints from HTML — good) but still hydrates 190 KB gz. HeroSection's client-ness is avoidable: the draw-in animation is pure CSS; the JS just pins final state after 1.7 s, which `animation-fill-mode: both` (already set via `both` on `.house-layer`) makes redundant. `/examples` could be a Server Component with a small client filter island, moving example content into HTML (better for SEO too).
**Fix:** Remove `'use client'` + the `useEffect` from HeroSection; convert `/examples` to RSC with a client-side `<FilterBar>` island. Moderate INP/TBT win on low-end mobile, small transfer win.

---

## LOW severity

### L1. Redundant `getUser()` duplication pattern
Nearly every client page re-calls `supabase.auth.getUser()` (network) that middleware already performed. Covered by H2, listed separately because even a quick tactical fix (use `getSession()` — local, no network — where you only need the uid client-side) shaves one round trip per page without an architecture change.

### L2. Scroll handler writes styles on every scroll event
`components/Header.tsx:22–33` — listener is `{ passive: true }` (good) and writes are cheap, but it re-assigns three style properties on *every* scroll event rather than only when the `past` boolean flips. Guard with a ref (`if (past === lastRef.current) return`) to avoid style-recalc churn during fast scrolling. Micro-INP hygiene.

### L3. `/try` fake-progress floor of 4.5 s
`lib/ai/mini-house.ts:98–99` — `MIN_LOADING_MS = 4500` enforces a minimum 4.5 s wait even if the API returns faster, and the mini-house route (`maxDuration = 30`) runs multi-step LLM + Brave search serially. Product choice, not a defect — but note it caps perceived performance of the flagship conversion flow; consider streaming partial results (perspectives first) instead of an all-or-nothing 4.5 s+ spinner.

### L4. `/admin` correctly isolated
`app/admin/page.tsx` uses `force-dynamic`; `AiMonitor` refreshes via `router.refresh()` on demand, no polling loop found. No action.

---

## Verified clean (no action)

- **Source maps:** 0 `.map` files in `.next/static` — not shipped. Server-side maps under `.next/server` are never served.
- **Minification/tree-shaking:** production chunks are minified; `openai`, `groq-sdk`, and `zod` (except the H3 leak) are server-only — verified via import grep and chunk content scan. The `groq` strings in `AiMonitor.tsx` are display data, not imports.
- **Images:** there are literally no raster images — one 230-byte `favicon.svg`, all visuals are inline SVG. AVIF/WebP, `srcset`, `next/image`, and lazy-loading findings are all N/A. Inline SVGs have `viewBox` + `width:100%/height:auto` → no CLS from media. (If photography is ever added, `next/image` config is currently absent from `next.config.ts`.)
- **CSS:** single 15.8 KB stylesheet — trivially small, render-blocking cost negligible.
- **Caching:** all marketing routes are statically prerendered (`.html` + `.rsc` in build output); `/_next/static/*` gets immutable caching on Vercel by default. No stale-cache misconfiguration found — the only cache-defeating element is the middleware matcher (H1).
- **Polyfills:** the 110 KB polyfill chunk is `noModule` — modern browsers never download it.
- **Fonts:** `display: swap` everywhere, self-hosted, preloaded — strategy is correct; only volume is at issue (M3).

*(Not run: a live Lighthouse pass — it requires starting the dev/prod server, which writes into `.next/`; all numbers above come from static analysis of the existing production build.)*

---

## What will move Core Web Vitals most

1. **LCP on `/how-it-works`, `/educators`, `/story`, `/faq` (H4):** stop hiding the hero H1 behind `data-reveal` — likely a 1.5–3 s LCP improvement on mobile for four of your seven marketing pages. Smallest diff, biggest single win.
2. **TTFB everywhere for logged-in users (H1):** shrink the middleware matcher and drop the network `getUser()` — removes ~100–300 ms from *every* navigation and API call.
3. **LCP/INP on authed pages (H2 + M4 + L1):** server-render dashboard/classroom/build data — collapses a 3–4-hop client waterfall into streamed HTML; the single highest-leverage architectural change for the logged-in experience.
4. **`/try` bundle (H3):** split constants out of the zod module — 62 KB gz / 277 KB parse off your primary conversion page for a ~20-line refactor.
5. **CLS everywhere (M2):** fix the height-animating sticky header.
