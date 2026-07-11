# Plan — Wire the AI into the builder (Groq + Brave)

**Status:** All phases ✅ 1–6 (co-pilot suggestions · Learn/Decide mode &
provenance · interviewer → per-house AI context · Research Mode with Brave-cited
evidence · Socratic critic on Review · usage caps + hardening). ⚠️ Two migrations
must be applied to the live Supabase DB (paste into the SQL editor): `0010_ai_columns.sql`
(before `/build/[id]` persists `mode`/`ai_context`/evidence `url`) and
`0011_ai_usage.sql` (before rate limits actually enforce — until then the limiter
fails open, i.e. no cap).
> Complete, but kept in `plans/active/` on purpose: ~8 shipped source files and
> several decision docs point to `plans/active/ai/*.md` in their comments. Moving
> this directory would break those pointers — do not relocate it.

**Implements:** [decisions/006](../../../decisions/006-groq-model-choice.md) (GPT-OSS on Groq),
[decisions/007](../../../decisions/007-ai-roles-and-audience.md) (roles, Learn/Decide),
[decisions/008](../../../decisions/008-ai-wiring-architecture.md) (wiring architecture).

> **Update 2026-07-10:** the single-model default in these docs was replaced by a
> two-tier 429-failover chain (`qwen/qwen3.6-27b` → `openai/gpt-oss-20b`) — see
> [decision 012](../../../decisions/012-groq-tiered-failover.md) for the
> current model/env truth. Where docs below say `openai/gpt-oss-120b` /
> `GROQ_API_KEY`, read 012.

Mission: replace every inert AI affordance in the Build workspace with real
capabilities powered by Groq (two-tier failover per decision 012), with
**Brave Search as the only source of evidence** (never model memory). Both
builder routes get it: `/build/[id]` (Supabase-authed) and `/house`
(localStorage, anonymous).

## Non-negotiable invariants (hold in every phase)

1. **The AI never writes the conclusion.** No AI output may set `conclusion`,
   `reasoning`, `question`, or `purpose`. Enforced in the `AiAction` type
   (no variant targets those fields) — not just in prompts.
2. **Nothing enters the house without an explicit user accept.** AI routes
   return proposals; only a user click dispatches a state change.
3. **Evidence cites only Brave results returned in the same request.** The
   server drops any candidate whose URL is not in that request's result set.
4. **AI routes are pure functions**: house JSON in → proposals out. They never
   write the DB. Persistence rides the existing autosave path (RLS intact).
5. **Provenance**: AI-accepted items are marked (`owner: 'ai'` / `byAI: true`).
6. **Deterministic House Strength stays.** AI critique is commentary beside the
   score, never an input to `computeStrength`.

## Phases — execute strictly in order; each is independently shippable

| Phase | Docs | Delivers |
|---|---|---|
| 1 ✅ | [01](01-foundation.md), [02](02-findings-and-actions.md), [03](03-suggest-and-copilot.md) | AI foundation + live co-pilot suggestions |
| 2 ✅ | [04](04-mode-and-provenance.md) | Learn/Decide mode, provenance, migration 0010 |
| 3 ✅ | [05](05-interviewer.md) | Interviewer → per-house AI context |
| 4 ✅ | [06](06-research-mode.md) | Research Mode (Brave-cited evidence) |
| 5 ✅ | [07](07-critic.md) | Socratic critic on the Review layer |
| 6 ✅ | [08](08-limits-and-safety.md) | Usage caps, auth posture, hardening |

## Execution protocol (for a fresh session)

- Read this README, then only the phase doc(s) for the phase you are executing.
  Each doc lists exactly the files to read and modify — that list is your
  CLAUDE.md scope grant; do not explore beyond it.
- Env keys already exist in `.env` and Vercel: the two tier keys
  (`GROQ_QWEN_3_POINT_6_27B_API_KEY`, `GROQ_OPENAI_GPT_OSS_20B_API_KEY`) and
  `BRAVE_SEARCH_API_KEY`. Never print their values.
- After each phase: `npx tsc --noEmit` and `npm run build` must pass; run the
  doc's manual checks against `npm run dev`; tick the phase here; commit.
- Phase 1 also updates `.env.example` and flips decision 006 to Implemented.
- External docs allowed: Groq API reference (the tier models per decision 012,
  `reasoning_effort`, `response_format`), Brave Search API reference. Verify
  exact parameter names there rather than assuming.

## Out of scope (deliberate — do not build)

Classrooms / rosters / student provisioning; invite & publish wiring;
streaming responses (Groq is fast enough non-streamed for v1); memo export;
compare-two-houses; longitudinal loop; content-moderation pipeline (required
before any classroom rollout, not before);
deleting `lib/build/suggestions.ts` (deprecate in place; deletion needs the
user's explicit OK per CLAUDE.md).

## Risk note

Phase 6 landed the usage caps, but they only bite once `0011_ai_usage.sql` is
applied to the live DB — until then the limiter **fails open** (no cap). Apply
`0010` and `0011` before publicizing `/house`.
