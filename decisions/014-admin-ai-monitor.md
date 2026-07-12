# Decision 014 — Admin AI monitor & operator gate

**Date:** 2026-07-11
**Status:** Implemented — an admin-only monitor at `/admin` gives live visibility
into the multi-provider routing engine ([decision 013](013-multi-provider-routing.md)):
which providers are up/down, how the router is working, the Groq penalty box, and
the daily airbag. Files: `app/admin/*`, `app/api/admin/*`, `components/admin/*`,
`lib/auth/admin.ts`, plus observability in `lib/ai/router.ts`.

## Context

Once routing spanned five providers with stateful failover, we needed a way to see
what was actually happening — otherwise a bad model id or a rate-limited provider
is invisible until a user hits it (exactly how the OpenRouter airbag model-id bug
in 013 was caught).

## Decision

### Operator gate (separate from capabilities)

Admin is an **operator** role, not a product capability, so it is deliberately
kept out of `capabilities.ts`. `lib/auth/admin.ts#isCallerAdmin()` matches the
signed-in user's email against `ADMIN_EMAIL_001` (the operator logs in through the
normal Supabase flow). Fails closed on any lookup error.

- `/admin` and `/admin/model` are server components → `notFound()` (404) for
  non-admins, so the routes' existence isn't even confirmed.
- `/api/admin/ai-status` and `/api/admin/ai-model` → 403 for non-admins.
- The navbar entry (`AdminNavLink`) self-hides via `/api/admin/whoami`, which
  returns a plain boolean and never leaks the admin email.

### What it shows

- **Monitor (`/admin`):** the failover lanes (suggestor / real-time / drafter),
  Groq penalty-box state, daily-airbag flag, and a per-target health table with
  each model's context window. A "Run live check" button actively probes every
  provider.
- **Per-model detail (`/admin/model?name=…`):** health, an event log (successes +
  errors, from traffic and probes), a single-model live check, and the model's
  failover position — which model it falls back *from* and *to*, with conditions.

### Observability model

Two tiers in `lib/ai/router.ts`:

- **Passive** — every real request records its outcome per target (last status,
  ok/fail counts, latency) into a small per-target ring buffer. Near-zero cost.
- **Active probe** — admin-triggered only. Fires a tiny (`max_tokens: 8`)
  completion at each target and classifies up / rate-limited / daily / error.
  Spends a sliver of quota, and unlike the live path it deliberately does **not**
  open the penalty box or flip the daily flag — a diagnostic must not perturb
  routing.

## Notes

- Monitor state is per server instance (same caveat as the router's penalty box /
  airbag). Fine on one instance; swap to a shared store for a global signal.
- `ADMIN_EMAIL_001` / `ADMIN_PASSWORD_001` documented in `.env.example`.
