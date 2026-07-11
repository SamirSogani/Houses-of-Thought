# 08 — Usage caps, auth posture, hardening

Phase 6. Makes the AI safe to leave running in public. **Gate for
publicizing `/house`** (README risk note).

## Files

- **Read first:** `lib/supabase/server.ts`, `middleware.ts`,
  `supabase/migrations/0004_collaborators.sql` (SECURITY DEFINER pattern),
  `supabase/migrations/README.md`, all four `app/api/ai/*/route.ts`.
- **Create:** `supabase/migrations/0011_ai_usage.sql`, `lib/ai/limits.ts`.
- **Modify:** the four AI routes (insert the gate), `CopilotPanel.tsx` /
  `InterviewCard.tsx` / `ResearchResults.tsx` / `CritiqueSection.tsx`
  (429 copy), `supabase/migrations/README.md`.

## Auth posture (product decision, per 007)

Anonymous users **keep AI access** — `/house` is the open door and the demo;
an inert co-pilot there defeats its purpose. The dial is quota, not login:

| Subject | Daily cap (all AI routes pooled) |
|---|---|
| Anonymous (per IP) | 25 calls |
| Authenticated (per user) | 250 calls |

Caps are constants in `limits.ts` — tune freely later.

## Migration `0011_ai_usage.sql`

```sql
create table if not exists public.ai_usage (
  day     date not null,
  subject text not null,          -- 'user:<uuid>' or 'ip:<sha256-16>'
  count   int  not null default 0,
  primary key (day, subject)
);
alter table public.ai_usage enable row level security;   -- no policies: deny all
create or replace function public.increment_ai_usage(sub text)
returns int language sql security definer set search_path = public as $$
  insert into ai_usage (day, subject, count) values (current_date, sub, 1)
  on conflict (day, subject) do update set count = ai_usage.count + 1
  returning count;
$$;
revoke execute on function public.increment_ai_usage(text) from anon, authenticated;
```

Deny-all RLS + revoked execute: only the service-role key (server routes)
touches it. Same idempotent style as 0004's helpers.

## `lib/ai/limits.ts`

`enforceAiLimit(req: Request): Promise<void>` — throws `AiError(429)` when over.

1. Supabase server client (`lib/supabase/server.ts` pattern) → `getUser()`.
2. Subject: `user:<id>` if authed; else `ip:` + first 16 hex chars of
   SHA-256 of (`x-forwarded-for` first hop, else `x-real-ip`, else
   `'unknown'`). Hashed → no raw IPs at rest.
3. Service-role client (`SUPABASE_SERVICE_ROLE_KEY` + URL; create inline
   here — this is the first server-side service-role use in the repo, keep it
   private to this module) → `rpc('increment_ai_usage', { sub })` → compare
   to the cap. RPC failure → **fail open** with a `console.error` (an outage
   in limits must not kill the co-pilot).

Every AI route calls it first; 429 body `{ error: 'rate-limited' }`.

## Client 429 copy

One shared message where each surface shows errors: "The co-pilot is resting
— daily limit reached. It resets tomorrow." (anon copy may append "Sign in
for a higher limit.") No Retry button on 429.

## Hardening checklist (verify across all four routes)

- Body caps enforced (100 KB) before any parsing work; zod-validate
  everything; unknown fields stripped.
- `maxTokens` ceilings as spec'd per doc (200–1600); `maxDuration = 30`.
- No house content, transcripts, or keys in server logs — log only
  route + status + subject hash + duration.
- Error responses never echo model raw output or stack traces.
- PERSONA rules present on every call (single source in `prompts.ts`).
- Grep the repo: the Groq tier keys (`GROQ_*_API_KEY`) / `BRAVE_SEARCH_API_KEY`
  appear only in `lib/ai/groq.ts`, `lib/ai/brave.ts`, `lib/ai/limits.ts`
  (service key), `.env`, `.env.example`.

## Explicitly deferred (pre-classroom gate, not now)

Content moderation pipeline; teacher visibility into AI interactions;
student-provisioned accounts locking mode to Learn (decision 007 §2);
per-request cost telemetry. Record these in the decisions doc when classroom
work starts.

## Acceptance

- Set anon cap to 3 locally → 4th `/house` co-pilot call returns 429 and the
  panel shows the resting copy; next day (or manual row delete) restores.
- Signed-in usage increments a `user:` row; anon a `ip:` row (hashed).
- `select * from ai_usage` as anon/authenticated via the API fails (RLS).
- `npx tsc --noEmit`, `npm run build`, migration applied.
