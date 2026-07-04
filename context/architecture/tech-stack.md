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

`/login` (`app/login/page.tsx`) is wired to Supabase email/password auth —
`signInWithPassword` / `signUp`, with loading and error states. On success,
redirects to `/welcome` (`app/welcome/page.tsx`), a placeholder post-auth
screen. Verified working end-to-end in production (2026-07-03).

Email confirmation is **off** (Supabase dashboard → Authentication →
Providers → Email → "Confirm email" disabled) — signup logs the user in
immediately rather than requiring a confirmation link.

A `public.profiles` table mirrors `auth.users` (id, email, created_at),
populated via an `on_auth_user_created` trigger on signup, protected by RLS
(a user can only select/update their own row). This SQL was originally run
directly in the Supabase SQL editor; it is now backfilled as a tracked
migration at `supabase/migrations/0001_profiles.sql` (reconstructed from this
description — diff against the live DB before treating it as authoritative).

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
