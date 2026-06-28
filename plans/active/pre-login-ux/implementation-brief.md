# Implementation Brief — Cold Start

**Read this first if you're a fresh Claude instance starting Phase 4 (code).**

This brief tells you what was decided, where to find everything, and what to build.
Do not re-derive the strategy or design system — it's settled.

## What to build

The **pre-login website** for Houses of Thought: the public marketing pages and
the no-login builder entry point. The logged-in app (dashboard, full Collab
builder, classrooms, profile) is **out of scope** for this phase.

## Where everything lives

| What | Path |
|---|---|
| Repository constitution | `CLAUDE.md` |
| Product strategy | `context/vision/product-strategy.md` |
| Reasoning framework (the 12 layers) | `context/framework/trapasso-model.md` |
| Tech stack | `context/architecture/tech-stack.md` |
| All founding decisions | `decisions/001-founding-decisions.md` |
| **Complete UX specification** | `plans/active/pre-login-ux/` (see below) |
| Design tokens (colors, type, spacing) | `plans/active/pre-login-ux/design-tokens.md` |
| Design language + anti-vibecoded rules | `plans/active/pre-login-ux/design-language.md` |
| Component library | `plans/active/pre-login-ux/components.md` |
| Navigation, routing, user flows | `plans/active/pre-login-ux/navigation-and-flows.md` |
| Homepage spec | `plans/active/pre-login-ux/page-home.md` |
| How It Works spec | `plans/active/pre-login-ux/page-how-it-works.md` |
| For Educators spec | `plans/active/pre-login-ux/page-for-educators.md` |
| Examples gallery spec | `plans/active/pre-login-ux/page-examples.md` |
| Try-it + Auth spec | `plans/active/pre-login-ux/page-try-and-auth.md` |
| Content pages (Framework, FAQ, etc.) | `plans/active/pre-login-ux/pages-content.md` |
| Supabase env vars | `.env` (gitignored), `.env.example` |
| Source PDFs (reference only) | `references/` |

## Tech stack (decided)

- **React / Next.js** — SSR for marketing pages, SPA for the builder.
- **Supabase** — auth, database, storage. Env vars configured in `.env`.
- **CSS custom properties** — design tokens from `design-tokens.md`.
- **TypeScript** — assumed standard for Next.js projects.

## Design system summary (details in spec files)

**Identity:** "Architectural Blueprint × Editorial" — NOT a generic SaaS look.

**Colors (key tokens):**
- `--ink-900: #14213A` — primary text, dark sections
- `--paper-50: #F7F6F2` — warm off-white background
- `--amber-500: #F2B021` — single accent (primary buttons, marks)
- `--slate-500: #5A6B85` — secondary text, mono labels
- `--blueprint-500: #3E5C8A` — sparing diagram accent

**Typography (3 roles):**
- Display/headlines: serif (`Fraunces` or `Newsreader`)
- Body/UI: sans (`Inter Tight` or `Geist`)
- Labels/metadata: mono (`Geist Mono` or `IBM Plex Mono`)

**Layout:** 12-col grid, 1200px max, mobile-first breakpoints at 640/1024/1280px.

**Anti-vibecoded rules (must follow):**
- No gradient blobs, glassmorphism, or floating 3D elements
- No default component-library look (uniform rounded cards + shadows everywhere)
- No emoji as iconography, no AI stock imagery
- One accent color only (amber); type does the hierarchy work
- Borders/hairlines define structure, not shadows
- Asymmetric layouts, not centered stacked slabs
- Mono-uppercase labels as "blueprint annotations" connective tissue

## Pages to build (priority order)

1. **Shell** — Header (sticky, condensing), Footer (BlueprintFooter), SheetStrip
2. **Homepage** (`/`) — 10 sections spec'd in `page-home.md`
3. **How It Works** (`/how-it-works`) — scroll-linked house diagram walkthrough
4. **For Educators** (`/educators`) — the primary wedge landing page
5. **Examples** (`/examples`, `/examples/:slug`) — gallery + detail
6. **Content pages** — Framework, FAQ, Our Story, Contact, Legal
7. **Try It** (`/try`) — no-login builder entry (reuses the real builder)
8. **Auth** (`/signup`, `/login`) — split-panel, role-aware, localStorage carry

## Navigation (decided)

**Header nav (4 items):** How it works · For Educators · Examples · FAQ
**Right side:** Log in (text) + Try it free (primary amber button)
**Mobile (`<1024px`):** Logo + compact Try it free + hamburger → full-screen sheet
**Footer columns:** Product · Learn · Legal

## The signature component: HouseDiagram

An interactive SVG line-art of a reasoning house. Layers bottom→top: Concepts →
Question → Perspectives → Evidence → Assumptions → Conclusion → Implications.
Three modes: `animated` (draws in on load), `static` (reduced-motion fallback),
`interactive` (hover/tap reveals layer definitions). This is the brand — invest
build effort here. Full spec in `components.md`.

## User flows (4 paths, all end at Try it free or Create account)

1. **Curious individual:** `/` → Try it free → `/try` → build → save prompt → signup
2. **Teacher:** `/` → For Educators → Create a classroom → `/signup?role=teacher`
3. **Student (invited):** join link → `/signup?role=student&class=…` → app
4. **Skeptic:** `/` → How it works / Examples → Try it free → signup

## Conversion mechanic

`/try` persists to `localStorage`. Prompt account creation on: (1) meaningful
milestone, (2) save/export/publish click, (3) gentle persistent affordance.
On signup, carry the localStorage house into the Supabase-backed account.

## What NOT to do

- Do not recreate previous Lovable designs — they are reference, not templates.
- Do not add "Draft Full House" — it's dead (decision 001 §3).
- Do not add "Guides" — replaced by Examples (decision 001 §4).
- Do not claim multi-user collaboration outside of classrooms.
- Do not use "House of Reason" as the product name (it's the framework name).
- Do not add features, abstractions, or cleanup beyond what's specified.
- Do not hardcode Supabase secrets — use env vars.
