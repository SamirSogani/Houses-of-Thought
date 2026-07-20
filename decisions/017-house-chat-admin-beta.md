# Decision 017 — House Chat (admin-only beta)

**Date:** 2026-07-18
**Status:** Decided & implemented same day
([plans/active/house-chat.md](../plans/active/house-chat.md)); pending an
authed E2E pass by the operator.
**Builds on:** [014](014-admin-ai-monitor.md) (operator gate),
[015](015-graceful-context-intake.md) (intake pattern),
[016](016-draft-mode.md) (stage loop, claim gate — reused unchanged).

## Context

Beta request: a conversational surface where the admin asks a question and the
product responds by **building a house in real time** — a Claude-style live
checklist that, when clicked, opens the actual house. Strategically it is the
anti-chatbot chatbot: the core differentiator
(`context/features/chatbot-vs-house.md`) made runnable — the chat's only
possible reply is a claim-gated house with the conclusion left blank.

## Decisions made

### 1. Chat-fronted Draft Mode — no new generation machinery
- The build IS decision 016's loop: the chat card mounts its own reducer and
  drives the shared `useDraftRunner` against `POST /api/ai/draft`, one call per
  stage, persisting via `saveHouse`. Claim gate, provenance marks, provisional
  strength, and publish lock apply unchanged when the house opens in
  `/build/[id]`. No streaming (016 §4 stands).
- One house per question; builds run serially (composer waits).

### 2. Extractive intake keeps invariant 1 true in a conversational surface
- New `POST /api/admin/chat-intake` (coach lane, pure, no DB writes) returns
  either ONE clarify message or `{ question, purpose, context }`. `question`
  and `purpose` must be **verbatim spans of the person's own turns** — clamped
  server-side by `lib/ai/chat.ts` (unit-tested), with fallback to the person's
  literal message. The AI still never writes question, purpose, conclusion, or
  reasoning; the closing chat message is client-templated, not model text.
- At most one clarify round, enforced server-side (an assistant turn in the
  transcript forces extraction) — a chatty model cannot loop paid turns.
- `purpose` is optional: a rephrase or silence yields `''` for the human to
  fill in the builder.

### 3. Admin-only via the 014 operator gate, capabilities untouched
- `/admin/chat` is a server component: `isCallerAdmin()` or `notFound()` (404,
  existence hidden). The intake route 403s non-admins before spending quota.
- The draft route's own gates (auth, `canAuthorDraft`, decide clamp,
  assignment clamp) still apply — the beta rides the admin's normal account and
  stays inside the pooled `ai_usage` caps.

### 4. Zero migrations
- Origin marker `via: 'chat'` is an optional field on `DraftState`, riding the
  existing `houses.draft` jsonb (every reducer transition spreads it).
- The chat transcript is ephemeral (015's privacy posture); houses are the
  only durable artifact.

### 5. Open questions resolved
- Builds **auto-start** on a ready intake (Stop/Pause always visible) — the
  claim gate downstream preserves ownership; the beta optimizes for the demo.
- A paused build resumes inline while it is the newest card; once superseded,
  resume lives in the builder only.

## Consequences

- New: `app/admin/chat/page.tsx`, `app/api/admin/chat-intake/route.ts`,
  `components/admin/HouseChat.tsx`, `components/admin/ChatBuildCard.tsx`,
  `lib/ai/chat.ts` (+ tests), `CHAT_INTAKE_BLOCK` in prompts, `via` on
  `DraftState`, entry link on the monitor.
- Cost per question ≈ 1 coach-lane call + 5 drafter-lane calls + Brave — 016's
  prerequisite (apply `0011_ai_usage.sql` live) applies here too.

## Deferred / open

- Graduation beyond admin: move intake under `/api/ai/` behind
  `canAuthorDraft`, promote `via` to a queryable column, persist transcripts.
- Follow-up turns that edit an existing house (route to the co-pilot suggest
  path) rather than starting a new one.
