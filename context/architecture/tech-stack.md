# Tech Stack & Infrastructure

Decided during the founding planning session (2026-06-27).

## Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | React / Next.js | SSR for marketing pages; SPA for the builder |
| Styling | CSS custom properties | Tokens defined in design-tokens.md |
| Backend / Auth | Supabase | Auth, database, storage |
| Deployment | TBD | Vercel is the natural fit for Next.js |

## Supabase configuration

Environment variables (`.env`, gitignored):
- `SUPABASE_URL` — project URL
- `SUPABASE_ANON_KEY` — public/anon key (client-side, RLS-protected)
- `SUPABASE_SERVICE_ROLE_KEY` — server-side only, bypasses RLS

`.env.example` exists with placeholder values. Never hardcode secrets.

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
