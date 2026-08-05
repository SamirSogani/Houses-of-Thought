# Repository File Structure

How this repository is organized. Each top-level directory has one job. Claude
should normally read **only the files the user explicitly requests** — this map
exists to locate the right file, not to invite broad exploration.

---

## `assets/`

- **Purpose:** Static repository assets.
- **Belongs here:** Branding (`branding/`), logos, icons, fonts, static images.
- **Does NOT belong:** Source code, documentation, raw research material.
- **New files:** Add a new asset when a static file is needed by the repo or product.
- **Workflow:** Drop the asset in the matching subfolder; reference it by path.

## `docs/`

- **Purpose:** Documentation about the **repository itself**, not the product.
- **Belongs here:** Conventions, structure, navigation, contribution rules.
- **Does NOT belong:** Product knowledge, feature specs, architecture of the app.
  (Those live in `context/`.)
- **New files:** Add a doc when a new repository-level convention needs recording.
- **Workflow:** Keep concise; one topic per file.

## `context/`

- **Purpose:** Stable project knowledge — the durable understanding of the product.
- **Belongs here:** Vision, framework, feature knowledge, system architecture.
  See [context/index.md](../../context/index.md) for the section map.
- **Does NOT belong:** Transient plans, decisions logs, or raw source material.
- **New files:** Add a document when stable knowledge needs a home; keep it focused.
- **Workflow:** Write once it is settled; update in place when understanding changes.

## `decisions/`

- **Purpose:** A record of important architectural or product decisions.
- **Belongs here:** One document per significant decision — context, options, outcome.
- **Does NOT belong:** Open questions still being explored, or general docs.
- **New files:** Create one whenever a consequential, hard-to-reverse choice is made.
- **Workflow:** Append new decision records; never rewrite history — supersede instead.

## `plans/`

- **Purpose:** Planning documents across their lifecycle.
- **`plans/active/`** — work currently being executed.
- **`plans/backlog/`** — future work, not yet started.
- **`plans/completed/`** — archive of finished planning documents.
- **Does NOT belong:** Permanent knowledge (that graduates to `context/`).
- **New files:** Add a plan to `backlog/` (or `active/` if starting now).
- **Workflow:** Move a plan `backlog → active → completed` as it progresses.

## `references/`

- **Purpose:** Raw source material — the inputs behind the project.
- **Belongs here:** PDFs, exports, research, design mockups, source frameworks.
  Subfolders: `trapasso/`, `ux/`, `marketing/`, `legal/`, `architecture/`, `research/`.
- **Does NOT belong:** Synthesized knowledge (that belongs in `context/`).
- **New files:** Drop source material into the subfolder matching its **content**.
- **Workflow:** Treat as read-only source; cite it, don't load it by default.

## `app/`

- **Purpose:** Next.js App Router — routes, pages, layouts.
- **Belongs here:** `page.tsx`/`layout.tsx` per route, route-scoped styles.
  `app/api/` holds server-only route handlers (`route.ts`) — the co-pilot AI
  routes under `app/api/ai/` (e.g. `ai/suggest`), which take a house payload
  and return proposals and never write the DB, plus the admin-gated routes
  under `app/api/admin/` (monitor endpoints, plus House Chat's `chat-intake`
  and `chat-conclusions`; decisions 017–018), and the public `app/api/health/`
  uptime probe (DB reachability + configured AI-lane count).
- **Does NOT belong:** Shared components (`components/`) or utilities (`lib/`).
- **Current routes:** marketing — `/`, `/how-it-works`, `/framework` (the
  definitional hub), `/educators`, `/story`, `/faq`, `/examples`
  (+ `/examples/[slug]`), `/try`, `/contact`; legal — `/terms`, `/privacy`
  (both render `legal/*.md` through `components/legal/LegalArticle`); auth —
  `/login`, `/forgot-password`, `/reset-password`, `/auth/callback`
  (emailed-link landing route), `/welcome` (post-auth screen); app —
  `/dashboard`, `/build` (+ `/build/[id]`), `/house` (orphaned no-login
  builder), `/profile`, `/classes`, `/classroom` (+ `[classId]`,
  `[classId]/assignments/[assignmentId]`), `/join/[code]`, `/admin`
  (+ `/admin/model`, `/admin/chat` — House Chat beta, decision 017;
  `/admin/reasoning` + `/admin/reasoning/runs` — multi-agent reasoning
  pipeline, decision 019; `/admin/usage` — token usage & cost ledger,
  decision 020).
- **Metadata & crawl surface:** `app/robots.ts`, `app/sitemap.ts`,
  `app/llms.txt/route.ts`, `app/icon.svg`, `app/opengraph-image.tsx`, and
  `app/not-found.tsx`. Per-page metadata is built with `pageMetadata()` from
  `lib/site.ts`, which also resolves the production domain. Every app/auth
  route directory carries a tiny `layout.tsx` whose only job is the `noindex`
  metadata export (those pages are client components and cannot export it).

## `components/`

- **Purpose:** Shared React components consumed by `app/` routes.
- **Belongs here:** Reusable UI. Top-level holds the site shell (`Header`,
  `SheetStrip`, `Footer` lives under `sections/`), `ScrollReveal`, and
  `icons.tsx` (shared SVG set). Route-specific building blocks live in
  `sections/`.
- **`sections/`:** One component per full-width page section, prefixed by the
  page it belongs to (`Hero*`, `How*`, `Educator*`, `Faq*`, `Story*`).
  Cross-page reusable sections have plain names (`CTASection`, `Footer`).
- **Does NOT belong:** Route entry points (`app/`) or non-UI utilities (`lib/`).
- **New files:** Add a section component when a page needs a new full-width
  block; reuse `CTASection` for end-of-page CTAs rather than writing a new one.

## `lib/`

- **Purpose:** Shared utility modules used by the application.
- **Belongs here:** Client/server helpers, SDK wrappers, shared logic.
- **Does NOT belong:** React components, pages, or documentation.
- **Current contents:** `supabase/client.ts` (browser client),
  `supabase/server.ts` (server client). `ai/` holds the co-pilot core:
  `router.ts` (server-only multi-provider routing engine + `completeJSON`;
  decisions 013–015), `groq.ts` (thin back-compat re-export of `router.ts`),
  `serialize.ts` (house → prompt text, pure), `prompts.ts` (shared persona +
  capability blocks), `findings.ts` (client-safe zod schemas / `AiAction`
  contract), `draft.ts` (client-safe Draft Mode contract — stages, claim
  state, gate helpers; decision 016), `chat.ts` (client-safe House Chat intake
  contract + verbatim-span clamps; decision 017). `auth/admin.ts` gates the AI
  monitor and House Chat (decisions 014, 017). `log.ts` is the server-side
  structured logger (single-line JSON for Vercel log search).

## Root files

- `proxy.ts` — Next.js proxy (the middleware convention, renamed in Next 16);
  refreshes Supabase auth sessions on every request.
- `eslint.config.mjs` — flat ESLint config (`pnpm lint`); two react-hooks v7
  rules are downgraded to warnings as tracked debt (see the file's comment).
- `.github/workflows/` — `ci.yml` (typecheck / lint / test / build gate) and
  `backup.yml` (nightly encrypted pg_dump; no-ops until repo secrets are set).

---

## Reading discipline

- Read only what the user names. Do not scan the tree.
- `references/` holds raw material — consult concise docs in `context/` and `docs/`
  first, and open references only when a specific file is clearly needed.
- See [navigation.md](navigation.md) for how to navigate when more context is needed.
