# Decision 009 — AI implementation findings & hardening

**Date:** 2026-07-08
**Status:** Implemented. Records the non-obvious decisions, deviations, and
security findings from executing [plans/active/ai/](../plans/active/ai/README.md)
(Phases 1–6) and the end-to-end test pass. Extends [008](008-ai-wiring-architecture.md).

## Context

All six phases of the AI wiring shipped: co-pilot suggestions, Learn/Decide mode,
the interviewer (per-house `aiContext`), Brave-cited Research Mode, the Socratic
critic, and usage caps + hardening. Migrations `0010`–`0012` are applied. Several
things surfaced during build/test that future work must not re-learn the hard way.

## Findings & decisions

### 1. High-`reasoning_effort` calls need a large `max_completion_tokens`
GPT-OSS on Groq counts reasoning tokens against `max_completion_tokens`. At
`reasoning_effort: 'high'`, a small ceiling is spent entirely on reasoning and the
model returns an **empty generation** → Groq `400 json_validate_failed`. The plan's
per-doc figures (research 1200, critique 1600) both failed this way.
- **Set:** research synthesis `4000`, critique `6000`. Low-effort calls (suggest
  1400, interview 600, query-derivation 200) are fine at their doc values.
- **Rule:** any new high-effort structured call needs a generous token budget
  (reasoning + output), not just enough for the JSON.

### 2. Revoke function `EXECUTE` from `PUBLIC`, not just `anon`/`authenticated`
Postgres auto-grants `EXECUTE` to `PUBLIC` on every function; Supabase's `anon`
and `authenticated` inherit it. `0011`'s `revoke ... from anon, authenticated` was
therefore **ineffective** — an anonymous caller could POST
`/rest/v1/rpc/increment_ai_usage` and inflate any subject's counter (a targeted
rate-limit DoS + count read-back). Fixed in
[`0012_fix_ai_usage_execute_grant.sql`](../supabase/migrations/0012_fix_ai_usage_execute_grant.sql):
`revoke ... from public` + `grant ... to service_role`. Verified: anon RPC now
`42501 permission denied`; service_role still works.
- **Rule:** for any SECURITY DEFINER RPC meant for server-only use, revoke from
  `public` and grant only the intended role.

### 3. Never render an unsanitized href
React does not sanitize the `href` attribute, so a `javascript:`/`data:` URL
renders as a live link. Evidence URLs are user/collaborator-writable on a shared
house, so a malicious editor could plant one. All URL rendering now gates on
[`lib/safeUrl.ts`](../lib/safeUrl.ts) `safeHttpUrl()` (http/https only, else the
link is not rendered).

### 4. Rate-limit posture (implements 007's "quota, not login")
Anonymous users keep AI access (`/house` is the open door). The dial is a pooled
daily cap per subject — `ip:<sha256-16>` (hashed, no raw IPs) at 25/day, `user:<id>`
at 250/day — in [`lib/ai/limits.ts`](../lib/ai/limits.ts). The gate runs **first**
(before body parsing) and **fails open** on any limiter outage: an infrastructure
problem must never take down the co-pilot. Only the service-role key touches
`ai_usage`, whose RLS denies all clients.

### 5. Smaller build-time corrections
- `applyAiAction`'s `add_evidence` dropped the citation `url` (its code predated
  `Evidence.url`, added in Phase 2). Now carried through so Research evidence keeps
  its link.
- The interviewer's `forceSummary` directive is placed **last in the user message**;
  at low effort the model otherwise ignored a system-prompt instruction and asked
  another question instead of closing.

## Deferred (pre-classroom gate — not built)

Content-moderation pipeline; teacher visibility into AI interactions;
student-provisioned accounts locking mode to Learn (007 §2); per-request cost
telemetry. Record the choices here when classroom work starts.
