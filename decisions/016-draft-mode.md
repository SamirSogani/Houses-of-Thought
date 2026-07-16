# Decision 016 — Draft Mode (AI-forward flow for standard accounts)

**Date:** 2026-07-16
**Status:** Decided & implemented same day ([plans/active/ai-draft-mode.md](../plans/active/ai-draft-mode.md));
pending live apply of migrations `0010`/`0011`/`0022` + an authed E2E pass
**Amends:** [007](007-ai-roles-and-audience.md) (Author boundary), [010](010-classroom-model.md) §1
copy ("Draft Full House is dead for everyone"), and invariant 2 of
[plans/active/ai/README.md](../plans/active/ai/README.md) — for this flow only.

## Context

User feedback: the builder UX lands for Classrooms but not standard accounts.
Standard users want the AI to build most of the house **while they watch it
assemble in the real builder**, then revise and review — not the mini house's
one-shot summary. Strategy call (2026-07-16): standard accounts get a
divergent AI-forward mode; Classrooms keep the full deliberative workflow.
Scoping: [plans/active/ai-draft-mode.md](../plans/active/ai-draft-mode.md).

The tension: decision 001 §3 removed "Draft Full House" as an answer machine,
and 007 rules Author-posture off-limits as real output. Decision 010 §6 shipped
the one sanctioned Author use — the teacher strawman: generate → review →
revise → release. Draft Mode extends that *pattern* (AI authors a first pass, a
human owns it through review) to a user's own house, with a stricter constraint
than the strawman: the verdict is never AI-written.

## Decisions made

### 1. The AI drafts materials, never the verdict (Option B)
- **Choice:** Draft Mode generates concepts, perspectives, Brave-grounded
  evidence, assumptions, and implications. `question` and `purpose` come from
  the user via the existing interview. `conclusion` and `reasoning` remain
  **human-only, in every mode** — the user synthesizes them from the reviewed
  layers.
- **Rejected:** full strawman semantics (AI authors a conclusion the user must
  overturn or adopt). Marginal extra value; breaks the brand promise.
- **Consequence:** plan invariant 1 (AI never writes `conclusion`, `reasoning`,
  `question`, `purpose`) survives **verbatim**; the shared `PERSONA`
  conclusion-ban stays intact (no self-contained prompt carve-out, unlike the
  strawman). "The AI never writes your conclusion" stays literally true.

### 2. Acceptance moves from insertion-time to review-time (invariant 2 amendment)
- In Draft Mode only, drafted items land in live state immediately — marked
  `owner: 'ai'` and **unreviewed** — instead of waiting behind per-item Add
  buttons. The user then **claims each layer** in a review pass.
- The gate has teeth: House Strength renders as *provisional* and
  publish/export/turn-in stay locked until every drafted layer is claimed.
  The explicit accept still exists; it is deferred and batched per layer.
- Everywhere else (co-pilot suggestions, research, critic) invariant 2 is
  unchanged: proposals still require a user click to enter the house.

### 3. Account-only, gated by capability
- Draft Mode requires an account: not on `/house` (anonymous) and not on
  `/try`. The mini house stays the teaser; Draft Mode is the signup payoff.
  Drafting cost (~6 drafter-lane calls + Brave) stays behind auth and caps.
- Gate is `capabilitiesFor(accountType).canAuthorDraft` — the dormant flag
  ships `true` for **standard** and **teacher** (both `aiPosture: 'full'`
  adults on their own houses), permanently `false` for **student**, clamped
  server-side in the route. Students can never see or reach it; Learn mode
  never surfaces it. 010 §1's "dead for everyone" is superseded to "dead as a
  verdict machine; reborn as claim-gated scaffolding for full-posture accounts."
- Draft Mode additionally requires the house's mode to be `decide`
  (server-clamped) — it is a Decide-posture capability per 007's dial.

### 4. Real-time build via a client-orchestrated stage loop — no streaming
- The client calls `POST /api/ai/draft` once per stage (concepts →
  perspectives → evidence → assumptions → implications); each response
  dispatches into live reducer state, so the user watches the house genuinely
  assemble (unlike the mini house's cosmetic timer). Pause/stop = don't call
  the next stage. Streaming/SSE stays out of scope (AI plan README).
- The route stays a **pure function** (invariant 4): house-so-far +
  `ai_context` in, layer items out, no DB writes; persistence rides autosave.
  Evidence cites only Brave results returned in the same request (invariant 3).

### 5. Naming
- User-facing: **"Start with an AI draft"** / "Draft Mode". The dead
  "Draft Full House" label is never reused — it names the removed verdict
  machine, not this flow.

## Consequences

- New: `app/api/ai/draft` route, stage schemas, drafting rail card, per-layer
  claim state persisted on `houses` (migration 0022), claim-pass UI,
  provisional-strength + publish lock, creation-time entry point.
- Prereq before ship: apply `0010_ai_columns.sql` and `0011_ai_usage.sql` live
  — the AI limiter fails open until 0011 is applied; Draft Mode must be capped.
- Classroom trust posture: the student clamp is server-side in capabilities +
  the route, quotable to teachers ("students can never reach this").

## Deferred / open

- Teacher-side polish (e.g. drafting from an assignment context) — the flag is
  on for teachers, but the entry point ships on personal house creation only.
- Draft Mode telemetry beyond `/admin` router stats.
- Whether the claim pass should require an edit (not just a confirm) per layer
  if click-through claiming proves too shallow in practice.
