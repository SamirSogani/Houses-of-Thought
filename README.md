# Houses of Thought

**Reason through it, don't just ask.**

[www.housesofthought.org](https://www.housesofthought.org)

Houses of Thought is a critical-thinking tool for students, teachers, and anyone
facing a hard question. It turns a question into structured, defensible reasoning —
concepts, perspectives, cited evidence, assumptions, and a conclusion you build
yourself, with AI that guides instead of deciding.

It is built on John Trapasso's classroom model, itself derived from the Paul-Elder
framework for critical thinking. Always free, with no paid tier.

The AI asks sharpening questions, surfaces missed perspectives, gathers cited
evidence, and stress-tests a conclusion once you reach one. It never writes the
conclusion — a type-level constraint in the codebase, not a prompt instruction.

`app/llms.txt/route.ts` is the canonical machine-readable summary of the product and
its vocabulary (*house*, *House Strength*, *Research Mode*, *Learn/Decide mode*); the
seven reasoning layers are defined in `lib/marketing/constellation.ts`. For deeper
product knowledge see [context/index.md](context/index.md).

The rest of this README covers **running the project locally**. For anything else:

- Where files live → [docs/repository/file-structure.md](docs/repository/file-structure.md)
- Past decisions and their rationale → [`decisions/`](decisions/)
- Operational runbooks → [`docs/operations/`](docs/operations/)

## Prerequisites

- **Node.js ≥ 22** (`engines.node`)
- **pnpm 11.11.0** — pinned via `packageManager`; get it with `corepack enable`

This repo standardizes on pnpm ([decision 013](decisions/013-standardize-on-pnpm.md)).
A `preinstall` guard fails `npm install` / `yarn` immediately rather than letting
them create lockfile drift.

## Setup

```bash
corepack enable          # one-time
pnpm install
cp .env.example .env     # then fill in the values
pnpm dev                 # http://localhost:3000
```

## Environment

Copy `.env.example` to `.env` and fill it in — that file is the source of truth for
every key and where to obtain it. All keys are server-side only.

**The two Supabase keys are required for the app to serve any page at all:**

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

`proxy.ts` constructs a Supabase client on every request, so without these *every*
route returns HTTP 500 with `Your project's URL and Key are required to create a
Supabase client!`. If you see that error on a fresh clone, your `.env` is missing or
unloaded.

The remaining keys gate specific features rather than startup: `SUPABASE_SERVICE_ROLE_KEY`
and `ADMIN_*` for the `/admin` monitor, the AI provider keys for the routing engine
(`lib/ai/router.ts`), and `BRAVE_SEARCH_API_KEY` for evidence research. Expect those
features to fail until their keys are set.

`NEXT_PUBLIC_SITE_URL` is optional locally. `lib/site.ts` resolves the canonical URL
from it, then `VERCEL_PROJECT_PRODUCTION_URL`, then `localhost:3000`.

## Database

There is no local Supabase stack in this repo — `supabase/` contains migrations only,
with no `config.toml`. Point your `.env` at a Supabase project (a free dev project is
fine) and apply [`supabase/migrations/`](supabase/migrations/) in filename order.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | Dev server (Next.js + Turbopack) on port 3000 |
| `pnpm build` | Production build |
| `pnpm start` | Serve a production build |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest, single run |
| `pnpm test:watch` | Vitest in watch mode |

`pnpm lint` currently reports warnings but no errors; they are pre-existing.

## Verifying your setup

With the Supabase keys set, the dev server should start in about a second and:

- `GET /` returns **200**
- `GET /dashboard` returns **307** redirecting to `/login?next=%2Fdashboard`

That redirect is the expected signed-out behavior for protected routes
(`/dashboard`, `/build`, `/profile`, `/classroom`, `/classes`, `/join`).

Public marketing routes — `/how-it-works`, `/examples`, `/educators`, `/faq`,
`/story`, `/try` — render without authentication. `/try` builds a Mini House with no
account, which makes it the quickest end-to-end check that AI routing is configured.
