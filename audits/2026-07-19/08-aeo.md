# AEO (Answer Engine Optimization) Audit — Houses of Thought

**Auditor:** aeo-auditor (subagent, model: Fable) · read-only · 2026-07-19

Assesses how well the site can be discovered, parsed, cited, and quoted by AI
answer engines and LLM-powered search (ChatGPT/GPT search, Perplexity, Google AI
Overviews / Gemini, Claude, Bing Copilot) — distinct from classic SEO: the focus
is machine extractability and citation-worthiness, not blue-link ranking.

**Scope:** Public marketing routes `/`, `/how-it-works`, `/educators`,
`/examples`, `/examples/[slug]`, `/story`, `/faq`, `/try`.

**Headline:** The site's biggest presumed risk — client-rendered empty shells —
is largely **not** the problem here (most marketing pages are server components
with real text in initial HTML). The actual blockers are: **fabricated citations
served as server-rendered "evidence,"** **zero crawl infrastructure** (no
robots.txt, sitemap, llms.txt, canonical, or metadataBase — there is no `public/`
directory at all), **one generic title/description shared by nearly every page,**
and **zero structured data of any kind.**

---

## CRITICAL

### C1. Fabricated citations and statistics served as server-rendered fact — active citation poison
**Routes:** `/examples/[slug]` (server-rendered, static params), homepage teaser
**Files:** `lib/build/content.ts`, `lib/build/state.ts`, `lib/examples/data.ts`

The demo houses render "evidence" cards verbatim in initial HTML, each with a precise number and an authoritative-sounding source — none with URLs, and the sources appear invented while mimicking real institutions:

- `lib/build/state.ts:60-62`: *"Global K-12 AI-in-education market projected to reach $32B by 2027 — HolonIQ Global Education Outlook (2025)"*; *"Average effect size of AI tutoring on learning outcomes: d = 0.34 — Stanford GSE Meta-Analysis (2024)"*; *"76% of OECD countries now have a national AI-in-schools policy — OECD Education Digest (2025)"*
- `lib/build/content.ts:128-250`: *"RAND Education (2024)… 19% drop in low-level student errors"*, *"World Economic Forum Future of Jobs (2025)"*, *"FTC COPPA Guidance (2025)"*
- `lib/examples/data.ts:110-297`: invented correlation coefficients attributed to *"Journal of Sports Economics (2022)"* (a real journal), *"Carta equity report (2025)"*, *"Levels.fyi cohort data (2025)"*, *"Migration retrospectives survey (2024)"*, mixed with a few real facts (FAO 14.5%, 4 Day Week Global 71%) that lend the fake ones plausibility.

**Why this is the worst possible AEO posture:** This is exactly the content shape answer engines are built to extract — short factual sentence + statistic + named source. Perplexity or an AI Overview could lift *"76% of OECD countries now have a national AI-in-schools policy"* and cite **this domain** as the origin. When fact-checking layers (or human users) fail to verify the source, the domain gets classified as unreliable — a durable, hard-to-reverse penalty in retrieval ranking and citation selection. It is doubly toxic here because the product's core promise (per the site's own FAQ) is *"How do you prevent hallucinated sources? … every citation links to the original."* The marketing site demonstrably violates its own pitch.

**Fix (blocks citability entirely until done):** Replace every statistic with a verifiable one linked to a real URL, or rewrite the demo evidence as explicitly illustrative (e.g., "Example evidence — illustrative") and exclude those pages from indexing (`robots` meta `noindex` on `/examples/[slug]`) until real content exists. Do not ship invented numbers attributed to real institutions under any circumstances.

### C2. No robots.txt, no sitemap, no llms.txt — zero crawl/citation infrastructure
**Files:** No `public/` directory exists; no `app/robots.ts`, `app/sitemap.ts`, or `app/manifest.ts`.

- `robots.txt` 404s. That defaults to "allow all," so GPTBot, ClaudeBot/anthropic-ai, PerplexityBot, OAI-SearchBot, Google-Extended, and CCBot are **not blocked** — nothing prevents crawling. But there is also no affirmative signal, no sitemap reference, and no way to steer bots away from `/login`, `/join/*`, `/api/*`.
- No `sitemap.xml`: AI search crawlers (OAI-SearchBot, PerplexityBot) rely heavily on sitemaps for discovery and freshness; without one, discovery depends on internal links — several of which 404 (see H1).
- No `llms.txt`: an easy, high-leverage artifact for an early-stage site trying to define a novel framework ("Houses of Thought," "House Strength," layer names). A curated `/llms.txt` pointing at the FAQ/framework definitions is the cheapest way to become the canonical source for your own terminology.

**Fix:** Add `app/robots.ts` (allow AI bots explicitly, disallow `/api/`, `/dashboard/`, `/build/`, `/classroom/`, point to sitemap), `app/sitemap.ts` (marketing routes + `/examples/[slug]` with `lastModified`), and a static `public/llms.txt` summarizing the product, framework, and key definition URLs. Also note `middleware.ts` matcher runs the Supabase auth roundtrip on *every* request including `robots.txt`/`sitemap.xml` — add them to the exclusion.

### C3. One generic title/description for nearly the entire site; no canonical, OG, or metadataBase
**Files:** `app/layout.tsx:27-31` (the only site-wide metadata), `app/try/page.tsx:7` (the only page-level metadata).

`/how-it-works`, `/educators`, `/examples`, `/examples/[slug]`, `/story`, `/faq`, and `/` all share the identical layout title *"Houses of Thought — Structured, Defensible Reasoning"* and one description. There is no `metadataBase`, no `alternates.canonical`, no `openGraph`, no `twitter` metadata anywhere (grep confirms zero matches). `app/examples/page.tsx` is `'use client'`, so it **cannot** export metadata at all without restructuring. `/examples/[slug]` has `generateStaticParams` but no `generateMetadata` — five distinct, citable case-study pages are invisible as distinct documents.

**Why it hurts:** Answer engines use title/description as the primary label when selecting and attributing citations. Seven pages presenting as one document means at most one gets retrieved for any query; the FAQ — the most answer-shaped page — has no FAQ-specific title. No canonical means preview deploys (`*.vercel.app`) and the production domain can compete as duplicates.

**Fix:** Per-page `metadata` exports (question-shaped titles: "What is Houses of Thought? — FAQ", "How Houses of Thought Works: the 7-layer reasoning framework"), `generateMetadata` for `/examples/[slug]` using the house title + conclusion summary, `metadataBase` + canonical in the root layout, and OG/Twitter metadata. Split the `/examples` gallery so the page shell is a server component (filter chips can stay client).

---

## HIGH

### H1. Broken nav/footer links: `/framework`, `/contact`, `/terms`, `/privacy`, `/signup` all 404
**Files:** `components/Header.tsx:280-282` (mobile menu → `/framework`, `/contact`), `components/sections/Footer.tsx:12,27-29` (`/framework`, `/terms`, `/privacy`, `/contact`), `components/sections/EducatorHeroSection.tsx:55` and `components/sections/FinalCtaSection.tsx:39` (`/signup`), `components/sections/EducatorTrustSection.tsx:64-65` (in-copy Privacy/Terms links). No corresponding routes exist in `app/`.

**Why it hurts:** (a) Crawl dead-ends on every page waste the crawl and signal an unmaintained site. (b) `/framework` is the one link that would be the **definitional hub** — the single most citable page for a novel framework — and it doesn't exist. (c) Missing `/privacy` and `/terms` is an E-E-A-T failure for an education product; the FAQ (`components/sections/FaqGroupsSection.tsx:86` — *"Our Privacy and Terms cover the full detail"*) and educator trust copy both reference documents that don't exist. An answer engine asked "Is Houses of Thought safe for students?" finds a promise pointing at a 404. **(Terms/Privacy content exists at `legal/*.md` and just needs routing.)**

**Fix:** Build `/framework` first (see priority list), route real `/privacy` and `/terms` from `legal/`, and either create `/signup`/`/contact` or repoint links to `/login`/mailto. This blocks extraction of the framework definition entirely (the page doesn't exist) and reduces trust everywhere else.

### H2. No structured data of any kind
**Evidence:** grep for `application/ld+json` / `schema.org` across `app`, `components`, `lib` returns nothing.

Missing, in order of AEO value:
1. **FAQPage** on `/faq` — the questions/answers already exist as a typed array in `components/sections/FaqGroupsSection.tsx:9-110`; emitting JSON-LD from the same array is nearly free and is the single highest-ROI markup for answer engines.
2. **Organization/EducationalOrganization + WebSite** in `app/layout.tsx` — name, description, url, founder (Samir Sogani), `sameAs`. This is how a model forms a stable entity for "Houses of Thought" (currently ambiguous with the generic phrase "houses of thought").
3. **Article/AboutPage** on `/story` with `author` Person markup (Samir Sogani) and mention of John Trapasso / Paul–Elder lineage.
4. **HowTo** on `/how-it-works` — the "five moves" build flow (`HowIntroSection.tsx`: *"the whole build in five moves"*) maps directly onto HowTo steps.
5. **DefinedTerm/DefinedTermSet** for the glossary terms (House, House Strength, Research Mode, layer names) once `/framework` exists.

### H3. Public placeholder copy: "COPPA / FERPA review pending"
**File:** `components/sections/EducatorTrustSection.tsx:70-73` — renders publicly on `/educators`: *"COPPA / FERPA review pending. Copy here will be finalized against policy before launch."*

An answer engine answering "Is Houses of Thought COPPA compliant?" will quote this verbatim. It's honest, but as the extractable answer of record it reads as "not compliant, unfinished." Reduces citation odds for the entire educator-trust topic cluster. Fix: replace with a factual current-state statement, or remove until the review is done.

### H4. FAQ answers hidden behind a client accordion, no server fallback nuance
**File:** `components/sections/FaqGroupsSection.tsx:121,166`

Good news: because Next pre-renders client components, all answer text **is present in the initial HTML**. But closed items render with `display: none` (only the first item per group is `defaultOpen`). Pure-text extractors (GPTBot, CCBot, most RAG pipelines) will read it; visibility-aware pipelines and snippet renderers may discount `display:none` content, and Google's guidance treats hidden-by-default content as lower-weight for snippets. Combined with no FAQPage JSON-LD (H2), the best answer-shaped content on the site is at its weakest presentation.

**Fix:** Use `<details>/<summary>` or render answers expanded with CSS-only collapse, and add FAQPage JSON-LD. One change, two audits satisfied (this overlaps the SEO pass — do it once).

---

## MEDIUM

### M1. `data-reveal` renders all section content at `opacity: 0` until JS runs
**Files:** `app/globals.css:175-187`, `components/ScrollReveal.tsx`

Every marketing section is wrapped in `[data-reveal]` → `opacity: 0; transform: translateY(12px)`, revealed only by an IntersectionObserver. The text **is** in the HTML source (fine for non-rendering extractors), but any pipeline that renders the page without executing JS — or that computes visibility — sees a fully invisible page. The `prefers-reduced-motion` escape hatch shows this is fixable in CSS. **Fix:** default-visible with a `.js`-class gate (add the hiding class only when JS is present), so no-JS = fully visible. Classifying this as "reduces extraction for a subset of engines," not a total block.

### M2. Entity signals exist but are not machine-legible
**File:** `components/sections/StoryChaptersSection.tsx:86-116`

The raw material is genuinely good and rare: a named creator (*"Created by Samir Sogani"*), a named intellectual lineage (*"Based on John Trapasso's model, derived from the Paul–Elder Model for critical thinking"*), and a distinctive origin story. But it exists only as prose on `/story`: no Person/Organization schema, no `sameAs` links (no social profiles, no external corroboration anywhere in the repo), no footer identity block, no author attribution on other pages. The Paul–Elder connection is an underused asset — it ties the unknown entity "Houses of Thought" to a well-established entity models already know. **Fix:** Organization + founder Person JSON-LD, `sameAs` once profiles exist, and repeat the one-sentence entity definition (from FAQ: *"It's a tool for building structured, defensible reasoning…"*) consistently on `/`, footer, and metadata descriptions.

### M3. No freshness signals anywhere
No dates, no "last updated," no `lastModified` (no sitemap to carry it), no Article `datePublished`. Answer engines prefer dateable sources, and Perplexity surfaces dates in citations. Fix alongside C2/H2.

### M4. `/try` produces valuable, citable artifacts that evaporate
**Files:** `components/try/TryItFlow.tsx`, `app/api/ai/mini-house/route.ts`

Mini Houses are generated client-side and never get URLs. Only the input-phase copy is SSR'd. This is a missed AEO surface rather than a defect — shareable/permalinked example outputs (curated, human-verified) would compound the `/examples` corpus. Low priority; only worth doing with real citations (see C1).

### M5. No favicon, icons, or OG image at all
No `public/` dir, no `app/icon.*` or `app/opengraph-image.*`. Perplexity, ChatGPT search, and Bing Copilot render favicons next to citations; a missing favicon makes citations look broken and reduces click-through/trust. Minor but visible.

### M6. Quotability of the marketing copy is mixed
The FAQ (`FaqGroupsSection.tsx`) is the strongest asset: definition-shaped, answer-first, self-contained (*"What is House Strength? A score that reads your reasoning across three axes: evidence, logic, and coverage."* — perfectly liftable). The section copy elsewhere is evocative but vague ("Build the reasoning, not just the answer", "How a House gets built") — headings are brand-voice, not question-shaped, so they won't match query intent. There are **no true original data points** about the product itself (no usage numbers, no pilot results) — the only "statistics" on the site are the fabricated demo ones (C1), which is exactly backwards. Fix: question-shaped H2s on `/how-it-works` and `/educators`, and a one-paragraph canonical definition of each framework term.

---

## What's already good (don't break it)

- `/`, `/how-it-works`, `/educators`, `/story`, `/faq`, `/examples/[slug]` are **server components delivering full text in initial HTML** — the prior audit's "empty shell" concern applies only partially (M1's opacity issue, H4's display:none, and the `/examples` gallery being a client page that still pre-renders its static cards).
- Nothing blocks AI crawlers; middleware only gates `/dashboard`, `/build`, `/profile`, `/classroom`, `/join`.
- Exactly one `h1` per page, sensible h2 hierarchy.
- The FAQ content and the named framework + Paul–Elder lineage are genuinely citable raw material.

---

## Prioritized fix list (to become citable)

1. **Kill or fix the fabricated citations** (`lib/build/content.ts`, `lib/build/state.ts`, `lib/examples/data.ts`) — real sourced stats with URLs, or label as illustrative + `noindex` the example pages. Nothing else matters if the domain gets classified as a fabricator. *(C1)*
2. **Ship crawl infrastructure**: `app/robots.ts`, `app/sitemap.ts`, `public/llms.txt`, favicon/OG image; exclude robots/sitemap from the middleware matcher. *(C2, M5)*
3. **Per-page metadata + canonical + metadataBase**; convert `/examples/page.tsx` shell to a server component; `generateMetadata` for `/examples/[slug]`. *(C3)*
4. **Create `/framework`** as the definitional hub (terms, layers, House Strength, Research Mode, Paul–Elder lineage) with DefinedTerm markup — it's already linked from header/footer and is the page answer engines would cite for the framework's terminology. Fix `/privacy`, `/terms`, `/signup`, `/contact` 404s at the same time. *(H1)*
5. **Structured data**: FAQPage JSON-LD (data already exists as an array), Organization + founder Person, Article on `/story`, HowTo on `/how-it-works`. *(H2, M2)*
6. **Replace the "COPPA/FERPA review pending" placeholder** with a factual trust statement. *(H3)*
7. **FAQ presentation**: `<details>`-based accordion or default-expanded answers. *(H4)*
8. **No-JS visibility fix** for `data-reveal`. *(M1)*
9. Freshness dates, question-shaped headings, canonical one-sentence definitions repeated site-wide. *(M3, M6)*

**Overlap with the SEO pass — do these once, not twice:** items 2, 3, 5, and 7 (robots/sitemap, per-page metadata/canonical, all JSON-LD, FAQ markup) are identical work items in classic SEO; item 8 (no-JS rendering) covers the SEO "render without JS" concern; the broken-link fixes (item 4) also resolve the SEO crawl-error findings. The AEO-only items are C1 (fabricated citations), llms.txt, the `/framework` definitional hub content strategy, and the quotability rewrites (M6).
