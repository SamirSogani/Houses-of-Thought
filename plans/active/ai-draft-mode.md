# Plan — AI Draft Mode (AI-forward flow for standard accounts)

**Scoped:** 2026-07-16 · **Status:** Implemented (same day) — phases 1–4 ✅;
phase 0 (live DB applies: `0010`, `0011`, `0022`) and an authed end-to-end
pass remain. Typecheck + build pass; anonymous surfaces verified unchanged
(no draft card on `/house`; `/api/ai/draft` returns 401 unauthenticated).
**Decided:** [decision 016](../../decisions/016-draft-mode.md) resolved §6:
Option B (conclusion/reasoning human-only) and account-only (standard +
teacher via `canAuthorDraft`; students never; not on `/house` or `/try`).
**Motivating feedback:** current UX lands for Classrooms but not standard
accounts; standard users want the AI to build most of the house while they
watch it assemble in real time, then revise and review — not a summary teaser.

## 1. What it is

A standard-account entry path where the AI drafts the house layer-by-layer
**inside the real builder**, visibly, while the user watches, pauses, or edits.
The user then *claims* the draft through a review pass and writes the
conclusion themselves. Working name: **Draft Mode** (avoid the dead
"Draft Full House" label — see §2).

Flow: create house → context interview (existing) → user confirms question +
purpose → live staged build (concepts → perspectives → evidence → assumptions
→ implications) → per-layer review/claim pass → user writes conclusion +
reasoning → critic / stress test (existing).

## 2. Philosophy reconciliation (the hard part)

Prior rulings this touches:
- Decision 001 §3 / product-strategy: "Draft Full House" **removed** — a
  one-shot answer machine contradicted the core philosophy.
- Decision 007: Author posture is off-limits as real output; sanctioned only
  as labeled strawmen/worked examples.
- Decision 010 §6: the teacher strawman is the sole shipped Author use —
  generate → review → revise → release.
- `plans/active/ai/README.md` invariants 1 (AI never writes `conclusion`,
  `reasoning`, `question`, `purpose`) and 2 (nothing enters the house without
  explicit user accept).

**How Draft Mode differs from what was removed:** the removed feature handed
over a finished verdict (chatbot behavior). Draft Mode drafts *materials* —
never the verdict. With the recommended shape (§6, Option B), invariant 1
survives verbatim: `question`/`purpose` come from the user via the interview;
`conclusion`/`reasoning` stay human-authored. The AI scaffolds; the user still
does the thinking that matters. Marketing line ("the AI never writes your
conclusion") stays literally true in every mode.

**What must be amended:** invariant 2 only. In Draft Mode, per-item accept
becomes **deferred, per-layer confirmation**: drafted items land visibly with
`owner: 'ai'` plus a new `unreviewed` provenance flag; House Strength renders
as *provisional* and publish/export stays locked until every layer is
confirmed. The accept still exists — it moves from insertion-time to
review-time. Requires a decision record (016) superseding the 007 boundary
for standard accounts and amending invariant 2 for this flow only.

## 3. Reuse map (why this is a feature, not a second product)

| Existing piece | Role in Draft Mode |
|---|---|
| Router `drafter` lane (013: Gemini → Cerebras) | already the mini-house/strawman lane; handles every stage call |
| Strawman route + `STRAWMAN_SYSTEM` (010 §6) | template for full-house generation prompts/schemas |
| Mini house pipeline (`/api/ai/mini-house`) | Brave-grounded evidence pattern; `/try` teaser stays as-is |
| Interviewer (`/api/ai/interview`, 015) | the intake step, unchanged |
| Learn/Decide mode + `capabilities.ts` | gating: flip dormant `canAuthorDraft` for `standard`; students stay pinned out server-side |
| Provenance (`owner: 'ai'`, AI avatar) | extend with `unreviewed` state |
| Reducer + autosave persistence (002) | staged results dispatch as normal actions; autosave persists; AI routes stay pure |
| Research route / Brave (`/api/ai/research`) | evidence stage citations |
| Copilot suggest + critic | the revise/review pass, unchanged |
| Usage limits (`enforceAiLimit`) | caps drafting (≈6 calls/draft) |

## 4. New build

- **`app/api/ai/draft/route.ts`** — one route, `stage` param; each stage takes
  house-so-far + `ai_context`, returns that layer's items (zod schemas
  extending `findings.ts` patterns). Evidence stage runs Brave grounding with
  URL-allowlist validation. Gated by `capabilitiesFor(accountType).canAuthorDraft`,
  server-side.
- **Client stage loop** — the builder calls stages sequentially and dispatches
  results into live state. Real progress, no streaming/SSE (stays out of scope
  per the AI plan README); pause/stop = don't call the next stage.
- **Drafting rail card** — sibling of `InterviewCard`: per-layer progress,
  pause/stop, "drafted by AI — review to claim" framing.
- **Review/claim UX** — per-layer confirm affordance; provisional-strength
  badge; conclusion composer prompting the user to synthesize from the
  (reviewed) layers.
- **Entry point** — "Start with an AI draft" on house creation for standard
  accounts; Learn-mode/student accounts never see it.
- **Decision record 016** + capability flip + `unreviewed` provenance flag
  (state, serialize, migration for the flag on item tables or houses jsonb).

## 5. Phases (each independently shippable)

0. ⚠️ **Prereq (outstanding):** apply `0010_ai_columns.sql` + `0011_ai_usage.sql`
   + `0022_houses_draft.sql` to the live DB — the limiter fails open and
   `draft` won't persist until then. Draft Mode must not ship uncapped.
1. ✅ Draft route (`app/api/ai/draft`) + stage prompts (`DRAFT_COMMON` +
   `DRAFT_STAGE_BLOCKS`) + contract (`lib/ai/draft.ts`) + capability gate.
2. ✅ Client stage loop (`useDraftRunner` in BuildHousePage) + live insertion
   (`APPLY_DRAFT_STAGE` → `applyAiAction`) + `DraftCard` rail UI.
3. ✅ Claim pass (`DraftClaimBanner` + `CLAIM_DRAFT_LAYER`) + provisional
   strength (ContextBar/ReviewLayer) + reducer-guarded publish/export lock.
4. ✅ Entry points (dashboard card + `?draft=1` flow). Deferred: an explicit
   `/try` → signup handoff pitching Draft Mode as the account payoff.

## 6. Product decisions — resolved by [decision 016](../../decisions/016-draft-mode.md)

1. **Conclusion authorship: Option B.** AI drafts all layers *except*
   conclusion/reasoning; the user writes the verdict from reviewed materials.
   Invariant 1 and the brand promise stay intact verbatim.
2. **Account-only.** Not on `/house` (anonymous) or `/try`; the mini house
   stays the teaser and Draft Mode is the signup payoff. Gate:
   `canAuthorDraft` → standard + teacher, never student (server-clamped).

## 7. Risks

- **Cost/latency:** ≈6 drafter calls + 1–2 Brave searches per draft on free-tier
  budgets (Gemini daily). Caps (phase 0) are the guard; watch `/admin`.
- **Philosophy drift:** the review pass must be substantive, not a click-through
  ritual, or Draft Mode quietly becomes the removed answer machine. The
  claim-gate on strength/publish is the enforcement.
- **Classroom trust:** teachers must be able to see Draft Mode can never reach
  students (server clamp in capabilities + no UI in Learn mode).
