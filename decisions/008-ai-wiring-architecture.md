# Decision 008 — AI wiring architecture

**Date:** 2026-07-07
**Status:** Decided — execution plan in [plans/active/ai/](../plans/active/ai/README.md)

## Context

006 fixed the model (GPT-OSS 120B on Groq); 007 fixed the roles and the
Learn/Decide posture. This fixes the technical shape of the wiring. Keys for
Groq and Brave Search are in `.env` and Vercel env. Brave exists specifically
so evidence comes from live search, never model memory.

## Decisions made

### 1. Stack: `groq-sdk` + `zod`, non-streaming JSON
- **Choice:** Direct Groq SDK calls with `response_format` JSON-schema output,
  zod-validated; no Vercel AI SDK; no streaming in v1.
- **Reasoning:** Four small structured endpoints don't need an abstraction
  layer, and Groq's speed makes non-streamed short replies feel instant.
  Streaming is an additive later change.

### 2. AI routes are pure functions
- **Choice:** `app/api/ai/{suggest,interview,research,critique}` take house
  JSON, return proposals. They never touch the DB (except the usage counter).
- **Reasoning:** All persistence stays on the existing autosave path, so RLS,
  local-vs-Supabase adapters, and `/house` anonymity all keep working with
  zero new write paths.

### 3. One detection engine, two renderings, one accept gate
- **Choice:** Every finding carries `observation`/`suggestion` (Decide) and
  `question` (Learn); the client renders by mode. Accepting dispatches a
  typed `AiAction`; the union deliberately has **no variant** for
  `conclusion`/`reasoning`/`question`/`purpose` — 007's "AI never writes the
  conclusion" enforced in types, not prompts.

### 4. Evidence is Brave-or-nothing
- **Choice:** `add_evidence` actions exist only via the research route; the
  server drops any candidate whose URL isn't verbatim from that request's
  Brave results; suggest-route evidence actions are filtered out.

### 5. Anonymous users keep AI, metered by quota
- **Choice:** `/house` (no login) gets the co-pilot with a small per-IP daily
  cap (hashed IPs); authed users get ~10×. Enforced via a service-role-only
  `ai_usage` table + `increment_ai_usage` RPC.
- **Reasoning:** 007's "one target, many welcome" — the open door stays open;
  cost is bounded by quota, not by a login wall.

### 6. Mode defaults to `decide`; provenance reuses what exists
- New houses default `mode='decide'` (today's users are adults; classroom
  provisioning flips this later). Provenance rides the existing
  `owner_key='ai'` / `by_ai` columns; new columns limited to `houses.mode`,
  `houses.ai_context`, `house_evidence.url` (0010) and `ai_usage` (0011).

## Deferred

- Streaming; content moderation + teacher visibility + Learn-locked student
  accounts (pre-classroom gate); cost telemetry; deleting the deprecated
  static suggestion bank; memo export / compare / longitudinal loop (007).
