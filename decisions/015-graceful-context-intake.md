# Decision 015 — Graceful context-intake (interview)

**Date:** 2026-07-11
**Status:** Implemented — `app/api/ai/interview/route.ts` no longer hard-fails a
long context-intake conversation. Complements the size-aware routing in
[decision 013](013-multi-provider-routing.md).

## Context

The interviewer (which gathers context the other AI calls read) returned a 413
`payload-too-large` when the request body exceeded 100 KB, and `transcript-too-long`
when the conversation exceeded 12 turns. Both discarded the whole intake — the
worst moment to error — and were easy to mistake for a model context-window limit
(they are route-level guards, not model limits).

## Decision

Degrade gracefully instead of erroring. Two limits, not one hard wall:

- **Body cap 100 KB → 512 KB.** Now safe because an oversized prompt routes to
  Gemini's ~1M window via 013's size-aware routing rather than overflowing a small
  model. A genuinely huge (>512 KB) body still rejects as abuse.
- **Soft transcript cap (14 turns) → graceful wrap-up.** At/above it the route
  forces the summary (reusing the existing `forceSummary` path): the interview
  concludes with the context gathered so far instead of 413-ing. Only a **hard**
  ceiling (60 turns) still rejects, purely as an abuse guard.
- **Prompt condensing.** A long transcript is folded to its opening turn + the
  most recent 10 (older turns elided) so prompt size and cost stay bounded
  regardless of conversation length. The summary is still produced from what was
  said.

## Notes

- The model-side of "too much context" is handled by 013 (size-aware routing +
  overflow escalation); this decision is only about the route's own guards.
- The client (`components/build/rail/InterviewCard.tsx`) is unchanged: it already
  acts on `done + context`, so the graceful wrap-up flows through, and it already
  self-limits to ~6 questions before forcing a summary.
