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
- **Does NOT belong:** Shared components (`components/`) or utilities (`lib/`).
- **Current routes:** `/` (landing page), `/login` (auth shell, Log in /
  Sign up tabs, no auth logic wired yet), `/how-it-works`, `/educators`,
  `/story`, `/faq` (pre-login marketing pages).

## `lib/`

- **Purpose:** Shared utility modules used by the application.
- **Belongs here:** Client/server helpers, SDK wrappers, shared logic.
- **Does NOT belong:** React components, pages, or documentation.
- **Current contents:** `supabase/client.ts` (browser client),
  `supabase/server.ts` (server client).

## Root files

- `middleware.ts` — Next.js middleware; refreshes Supabase auth sessions on
  every request.

---

## Reading discipline

- Read only what the user names. Do not scan the tree.
- `references/` holds raw material — consult concise docs in `context/` and `docs/`
  first, and open references only when a specific file is clearly needed.
- See [navigation.md](navigation.md) for how to navigate when more context is needed.
