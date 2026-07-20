# Runtime Performance & Scalability Audit — Houses of Thought

**Auditor:** performance/scalability auditor (subagent, model: Opus) · read-only · 2026-07-19

**Stack observed:** Next.js 16 (App Router) on Vercel (serverless, `@vercel/analytics`), Supabase (PostgREST + RLS, no direct Postgres connections), client-side data fetching everywhere (`'use client'` pages), multi-provider LLM router (`lib/ai/router.ts`) riding free-tier quotas, Brave Search for evidence. No queue, no cache layer, no Redis.

---

## HIGH severity

### H1. Anonymous AI rate limit is trivially bypassable → unbounded LLM + Brave spend on a public endpoint
- **Where:** `lib/ai/limits.ts:64-78` (`anonCookieSubject`), used by `app/api/ai/mini-house/route.ts` (public, unauthenticated by design).
- **Bottleneck:** The anon subject is a cookie minted per request. A cookieless scripted client never sends `hot_aid`, so every request mints a **fresh** `anon:<uuid>` with count = 1 — the 25/day cap is never reached. The IP-hash fallback only engages if the cookie *can't be set*, and in a Route Handler it always can. Side effect: each such request also inserts a brand-new `ai_usage` row (one per UUID per day), so the deny-all table grows unboundedly under abuse.
- **When it bites:** The first time anyone points a script at `/api/ai/mini-house` (or any AI route). Each call costs a Brave search + an `effort: 'high'`, 6000-token drafter completion. This is a direct wallet/quota DoS that will trip the router's daily blackout and take AI down for all real users.
- **Fix:** Layer a hashed-IP ceiling *in addition to* the cookie subject (both must pass); optionally require the cookie to round-trip once (mint on GET, only count on requests that present it). Add TTL cleanup for `ai_usage`.

### H2. Worst-case AI failover chain far exceeds the route's `maxDuration` — request killed mid-flight
- **Where:** `lib/ai/router.ts:171` (`timeout: 25_000` per provider, `maxRetries: 0`), `execute()` at `router.ts:666-735` (up to 4–5 sequential attempts), `completeJSON()` at `router.ts:818-825` (a schema-parse failure re-runs the **entire** chain a second time); every AI route declares `export const maxDuration = 30`.
- **Bottleneck:** One slow (not failing) provider consumes up to 25s; a chain of them is unbounded relative to the 30s function budget. `/api/ai/research` is worst: query-derivation completion → Brave (10s budget) → drafter completion, each of which may itself cascade + retry, all inside one 30s window. There is no overall deadline budget shared across attempts.
- **When it bites:** Any provider brownout (slow 200s or hanging connections rather than fast 429s). Users see opaque 502/timeouts, and Vercel bills the full duration.
- **Fix:** Per-attempt timeout derived from remaining budget (e.g. `deadline = start + 25s`, give each attempt `min(8s, remaining)`), and cap the `completeJSON` retry to the last-successful target rather than re-walking the chain.

### H3. Autosave `saveHouse` is a non-atomic delete-then-reinsert with zero error handling and last-writer-wins
- **Where:** `lib/build/persistence.ts:242-325`; called from `app/build/[id]/page.tsx` on an 800ms debounce (`BuildHousePage.tsx:80-97`).
- **Bottleneck:** Every content change issues up to **9 sequential PostgREST round trips** (1 parent update + 4 deletes + up to 4 bulk inserts). None of the results are checked — a failed insert after a successful delete silently drops an entire layer (the code comment admits it's not atomic). Two tabs (or the planned collaborators feature) autosaving concurrently interleave deletes/inserts → duplicated or vanished perspectives/evidence. Continuous delete+reinsert also churns dead tuples and burns UUID PKs on child tables.
- **When it bites:** At 2 concurrent writers, or a single flaky connection during typing. Data loss, not just slowness — this is the scariest correctness-under-load issue in the repo.
- **Fix:** One transactional `save_house(jsonb)` RPC (single round trip, atomic), plus an `updated_at`-based optimistic-concurrency check; at minimum check and surface errors.

### H4. All routing/limiter/monitor state is per-serverless-instance memory
- **Where:** `lib/ai/router.ts:184-224` (Groq penalty box, `dailyExhaustedOn`), `router.ts:256-257` (`health`/`events` maps feeding the admin monitor), acknowledged in the comment at 184-189.
- **Bottleneck:** On Vercel every concurrent instance has its own penalty box and daily-blackout flag. Under fan-out: (a) each cold/parallel instance independently re-hammers a rate-limited provider before learning its own lesson — under load the "org-wide Groq 429" signal is rediscovered N times; (b) the admin AI monitor (`/api/admin/ai-status`) reads whichever instance answers, which almost certainly saw none of the traffic — the observability feature is effectively decorative in production; (c) `okCount/failCount` and event logs reset on every cold start.
- **When it bites:** The moment traffic needs >1 warm instance — i.e., the first classroom-sized burst.
- **Fix:** Move the penalty/daily flags to a shared row (Supabase) or KV with a few-second local cache; accept the monitor as single-instance-dev-only or persist events.

---

## MEDIUM severity

### M1. Middleware performs a Supabase Auth round trip on **every** request, including static marketing pages and all `/api` routes
- **Where:** `middleware.ts:30-32` (`supabase.auth.getUser()` — a network call to Supabase Auth whenever a session cookie is present) with a catch-all matcher (`middleware.ts:47-51`) that excludes only static assets.
- **Bottleneck:** Logged-in users pay an extra auth round trip for `/`, `/faq`, `/examples`, etc. Worse, every AI API call pays **2–3 auth verifications**: middleware `getUser()` → `enforceAiLimit`'s `getUser()` (`lib/ai/limits.ts:87`) → `getCallerCapabilities`'s `getUser()` in `/api/ai/suggest`. That's serialized latency (~100–300ms) prepended to every AI request and multiplies load against Supabase Auth's per-project rate limits.
- **Fix:** Narrow the matcher to `PROTECTED_PREFIXES` (the only place the result is used), and inside API routes resolve the user once per request.

### M2. Unbounded queries, no `.limit()` anywhere, silent 1000-row truncation
- **Where:** `grep` finds zero `.limit(` calls in the app. Notables: dashboard houses list (`app/dashboard/page.tsx:55-60`), teacher roster query fetching **all houses of all students in a class** (`app/classroom/[classId]/page.tsx:70-77`), `StudentAssignments` fetching all assignments/courses/houses across all memberships.
- **Bottleneck:** Payload and render cost grow linearly with data; PostgREST's default `max-rows` (typically 1000) will one day silently truncate the roster mid-list with no error. The roster query also fetches every student's *personal* houses, not just class work.
- **When it bites:** A class of 30 students × ~35 houses each hits the truncation cliff; payloads get heavy well before that.
- **Fix:** Paginate (or at least `.limit()` + "show more"), and scope the roster query to `assignment_id`-linked houses.

### M3. RLS `houses_select` runs up to 3 SECURITY DEFINER sub-queries **per candidate row**
- **Where:** `supabase/migrations/0020_fix_houses_select_returning.sql` — `owner_id = auth.uid() OR is_house_collaborator(id) OR can_view_student_house(id) OR can_view_assignment_strawman(id)`; `can_view_student_house` (0014) is itself a 3-table join. Child-table select policies (0014) do the same per row.
- **Bottleneck:** SECURITY DEFINER SQL functions are not inlined into the plan, so non-owner scans (teacher roster paths) execute a per-row function-call cascade. Owner-first ordering saves the common case, but the teacher path is O(rows × joins).
- **When it bites:** Tens of thousands of house rows with active teachers; combined with M2's unbounded scans.
- **Fix:** For teacher views, query through an explicit RPC that joins once (like `get_class_roster`) instead of relying on per-row policy fan-out; add a composite index on `houses (owner_id, is_strawman, updated_at desc)` for the dashboard sort while you're there.

### M4. Free-tier provider quotas are the ceiling for the whole product; Brave has no cache and a ~1 rps free tier
- **Where:** `lib/ai/router.ts` lanes (Mistral 50k TPM shared budget per its own comments, Gemini 1,500/day, etc.); `lib/ai/brave.ts` (no caching, no rate limiting, called per research/mini-house request); `USER_DAILY_CAP = 250` (`lib/ai/limits.ts:36`) is generous relative to those quotas.
- **Bottleneck:** Cost/quota grows linearly with active users and there is no caching or dedup of identical prompts (e.g., `CopilotPanel` refetches suggestions per step change; identical house+step pairs from 30 students on the same strawman all pay full price). One classroom working simultaneously will walk the lanes into 429s and eventually trip the daily airbag — after which everyone shares one free OpenRouter model for the rest of the UTC day.
- **Fix:** Short-TTL response cache keyed on (house-hash, step, mode) for `/suggest`; cache Brave results per query for hours; treat the daily blackout as an alerting event, not just a silent lane change.

### M5. `open_assignment` race can create duplicate submission houses
- **Where:** `supabase/migrations/0015_assignments.sql` — `open_assignment()` does SELECT-then-INSERT with no unique constraint on `(assignment_id, owner_id)`.
- **Bottleneck:** Two rapid clicks / double-fired requests both pass the existence check and insert two houses for one assignment; `StudentAssignments`'s status map keyed by `assignment_id` then behaves unpredictably. (The client's `opening` guard is per-mount only.)
- **Fix:** `create unique index on houses (assignment_id, owner_id) where assignment_id is not null` + `on conflict` handling in the RPC.

### M6. Interview/critique/mini-house are long synchronous requests with no idempotency or queue
- **Where:** all `app/api/ai/*/route.ts` — AI generation runs inline on the request; a client retry after a timeout re-pays the full chain; `enforceAiLimit` increments the counter *before* the call, so a user's failed/timed-out requests still consume their cap (and conversely the limiter "fails open" on any Supabase error — a limiter outage means zero rate limiting product-wide, `lib/ai/limits.ts:109-121`).
- **When it bites:** Provider brownouts + user retry storms; each retry compounds H2.
- **Fix:** Acceptable for now, but add client-side backoff and consider counting only successful completions (or refund on failure).

---

## LOW severity

- **L1. `select('*')` on four child tables** in `loadHouse` (`lib/build/persistence.ts:178-181`) — mild over-fetch (`created_at`, `questions`, uuids you re-map away). Cheap fix, low win.
- **L2. Per-keystroke O(house) serialization in the builder** — `BuildHousePage.tsx:79` runs `serializeContent(state)` every render; `CopilotPanel` re-serializes + djb2-hashes the whole house per render (`liveHash`); `SubmissionFeedback` gets `JSON.parse(contentKey)` per render in edit mode (`BuildHousePage.tsx:166`). Negligible now; noticeable once houses hold hundreds of items. Memoize on state identity.
- **L3. Client-side fetch waterfalls** — dashboard: `getUser` → `profiles` → `houses` sequential (3 round trips before paint, `app/dashboard/page.tsx:43-68`); builder open: `getUser` → parallel (profile, house row, `loadHouse` = 1+4 queries) ≈ 7 queries. Server components or a single RPC would halve time-to-content, but latency is acceptable at present scale.
- **L4. `AssignmentPanel.reorder`** issues N parallel updates, one per assignment in the group (`components/classroom/AssignmentPanel.tsx:112-115`) — fine at classroom N, would be one RPC at scale; two teachers reordering concurrently can interleave positions (self-heals on next rewrite).
- **L5. `ai_usage` has no archival** (`0011`) — one row per subject per day forever; trivial until H1 is exploited, then it's the abuse amplifier's ledger. Add a cron delete for rows older than ~35 days.
- **L6. Admin `POST /api/ai/ai-status` probes every provider** — admin-only and deliberate, but note each click costs quota across 6 targets and records into instance-local state (see H4).

**Positives worth keeping:** no direct Postgres connections (PostgREST avoids the classic serverless connection-exhaustion trap); marketing pages are static server components; prompt serialization is hard-capped (`lib/ai/serialize.ts`, 14k chars); interview transcripts are condensed to bound prompt growth; body-size caps on every AI route; Brave calls have an explicit 10s abort; the suggestion cache-per-step and content-hash staleness hint already protect tokens from typing.

---

## What breaks first as load grows

1. **First:** the public `/api/ai/mini-house` + bypassable anon cap (H1). One script exhausts free-tier daily quotas, trips the router's blackout, and degrades AI for every user — this can happen at *zero* legitimate load.
2. **Second:** the first real classroom session — 30 students concurrently pulling `/api/ai/suggest` (no caching, M4) walks the failover lanes into 429s while multiple serverless instances each rediscover the penalty box independently (H4); slow-provider brownouts then collide with the 30s `maxDuration` (H2) and retry storms.
3. **Third:** collaborative/multi-tab editing meets the delete-and-reinsert autosave (H3) — the first bottleneck that *loses user data* rather than just slowing down.
4. **Later:** roster/dashboard unbounded queries + per-row RLS function fan-out (M2/M3) as houses accumulate into the thousands.
