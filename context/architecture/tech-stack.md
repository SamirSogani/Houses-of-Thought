# Tech Stack & Infrastructure

Decided during the founding planning session (2026-06-27).

## Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | React / Next.js | SSR for marketing pages; SPA for the builder |
| Styling | CSS custom properties | Tokens defined in design-tokens.md |
| Backend / Auth | Supabase | Auth, database, storage |
| Deployment | Vercel | Auto-deploys from `main` on GitHub |

## Supabase configuration

Environment variables (`.env` locally, Vercel dashboard in production):
- `NEXT_PUBLIC_SUPABASE_URL` — project URL (`https://eolyqhughtndelsflalt.supabase.co`)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — public/anon JWT key (client-side, RLS-protected)
- `SUPABASE_SERVICE_ROLE_KEY` — server-side only, bypasses RLS

Supabase also provides a **publishable key** (`sb_publishable_…`) — the new
replacement for the legacy anon JWT. Both work simultaneously; the current
`@supabase/ssr` setup uses the JWT-based anon key. When the SDK migrates to
publishable keys, swap the anon key for the publishable key.

`.env.example` exists with placeholder values. Never hardcode secrets.

## Deployment

- **Hosting:** Vercel, connected to `SamirSogani/houses-of-thought` on GitHub.
- **Env vars:** Configured in Vercel dashboard (Settings → Environment Variables).
- **Auto-deploy:** Every push to `main` triggers a production deployment.

## Auth UI status

`/login` (`app/login/page.tsx`) is a **UI shell only** — Log in / Sign up tab
toggle, email + password fields, styled to match the homepage design system.
No Supabase auth calls are wired in yet; `handleSubmit` is a stub.

## Key architectural boundaries

- **Pre-login site** = static/SSR marketing pages + the `/try` no-login builder.
- **Post-login app** = the full Collab builder, dashboard, profile, classrooms.
- **No-login builder** persists to `localStorage`; on account creation the local
  house is imported into the Supabase-backed account.
- The **service role key** is server-side only (API routes, edge functions).
  Client code uses the **anon key** with Row Level Security.

## File conventions

- Source files under ~600 LOC; split before they grow larger.
- Markdown docs under ~150 lines; split before 200.
- No secrets in committed files; `.env` is gitignored.
