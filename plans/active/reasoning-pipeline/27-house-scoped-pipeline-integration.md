# 27 — Wire the real reasoning pipeline into `/build`

**Scoped:** 2026-08-16. Corrects a judgment call from
[ai-draft-mode-declutter.md](../ai-draft-mode-declutter.md): "Enter
reasoning pipeline" was built to relabel the existing Interview+Draft
mechanism, not invoke the actual multi-agent pipeline at `/admin/reasoning`
(decision 019). Samir's correction: it should be the real thing — same
engine, same 9-standard review panel, same 22-step rigor, reachable from a
house instead of only the admin surface.

## What already exists, and what doesn't

**Reusable as-is:**
- The whole orchestration engine — `lib/ai/reasoning/orchestrator-{setup,perspectives,global,panel}.ts`, `steps.ts`, `budget.ts`, `contracts.ts` (3166 lines). Pure step functions; nothing here is admin-specific.
- The display components — `components/admin/reasoning/{ReasoningStagesList,EvidenceGatherAnswerBox,ContextGatherAnswerBox,ReviewPanelVerdictPanel,FinalAnswerCard}.tsx` (1817 lines). Reuse, don't rebuild.

**Admin-specific, do NOT touch or loosen:**
- `app/api/admin/reasoning/route.ts` — gated by `isCallerAdmin()` (single hardcoded operator email, deliberately separate from `capabilitiesFor`, per its own doc comment). This stays exactly as-is.
- `reasoning_runs` — deny-all RLS, service-role-only, no `house_id` column, nothing reads it back except the admin "Past Runs" browser.

**Net new, this doc's actual scope:**
1. A second, house-scoped route reusing the same engine.
2. A `house_id` link on `reasoning_runs` so runs can be tied to a house (additive — admin-triggered runs keep `house_id: null`).
3. A client-side driver + embedded UI inside `/build`'s co-pilot rail, reusing the existing display components.
4. A mapping from the pipeline's final packets onto the house schema, riding the *existing* Draft Mode claim mechanism rather than inventing a new one.

## 1. New route: `app/api/houses/[id]/reasoning/route.ts`

Mirrors `/api/admin/reasoning/route.ts`'s shape almost exactly (same step
dispatcher, same `RequestSchema`-style body, same `after()`/persistence
pattern) — copy its structure, don't reinvent the step sequencing. Differs
only in gating:

- Caller must be authenticated and either own the house or be an `editor`
  collaborator (`house_collaborators`, migration 0004) — not admin.
- `capabilitiesFor(accountType).canAuthorDraft` must be true. **Excludes
  students**, matching Draft Mode today (Samir's explicit call — same
  restriction this session already protected once in the co-pilot
  Add-button fix, now applied consistently here too).
- No rate limit/quota on this route for now (Samir's explicit call,
  2026-08-16) — flagged as a real, known gap, not silently accepted. Worth
  a coarse per-account cap (reusing `ai_usage`/`increment_ai_usage`,
  migration 0011) before this is ever exposed beyond you personally
  testing it.

Persists to `reasoning_runs` (service-role, same as admin route) with a
new nullable `house_id uuid references houses(id) on delete cascade`
column — migration needed, additive only, admin's own queries/RLS
untouched.

## 2. Client-side driver + embedded UI

`/admin/reasoning`'s client code drives the step loop (resend full
`RunState`, get a `patch`, merge, repeat) — find and reuse that driving
logic (likely inside `ReasoningPipelinePage.tsx` or a hook it calls),
adapted to call the new house-scoped route instead of the admin one.
Render progress via the existing `ReasoningStagesList` /
`EvidenceGatherAnswerBox` / `ContextGatherAnswerBox` /
`ReviewPanelVerdictPanel` / `FinalAnswerCard` components, embedded in
`CopilotPanel`'s consolidated blank-house entry point (replacing the
current placeholder button behavior that just triggers the old
interview→draft handoff — that handoff and the InterviewCard/DraftCard
components stay as they are for the non-pipeline path if you want to keep
both; the button click now starts a real run instead).

## 3. Output mapping — ride the existing Draft claim mechanism

`state.draft` (`DraftState`: stage, drafted, claimed — `lib/ai/draft.ts`)
already exists precisely for "AI wrote this, awaiting the user's review
and claim per layer." Feed the pipeline's finished packets through that
*same* system rather than a new insertion path:

| Pipeline packet | House field |
|---|---|
| `FramePacket.core_question` (only if `state.question` was empty going in — otherwise the pipeline is seeded FROM the house's own typed question) | `houses.question` |
| `FramePacket.definitions` | `state.concepts` |
| `PerspectiveBundle[]` (`stance_label`→name, `stance_summary`→summary, `sub_questions`, `counterargument.rebuttals`→counters) | `house_perspectives` |
| `PerspectiveBundle.evidence` | that perspective's own `supportingEvidence` (nested, not the flat table) |
| `GlobalEvidencePacket.question_level_evidence` | flat `house_evidence` |
| `GlobalAssumptionsPacket.question_level_assumptions` | `house_assumptions` |
| `ConclusionsPacket.conclusions` | `houses.conclusion` |
| `FinalAnswer.answer` | `houses.reasoning` |
| `ImplicationsPacket.implications[]` (`ikind`/`text`/`horizon`/`who`) | `house_implications` — near 1:1, minimal transform |

Owner attribution: mark these `owner: 'ai'` (`PersonKey`), consistent with
how Draft Mode already tags AI-authored content — no new attribution
concept needed.

## Explicitly out of scope

- No changes to `/api/admin/reasoning`, `isCallerAdmin`, or anything about
  who can reach `/admin/reasoning` itself.
- No rate-limiting/quota system (flagged above, deliberately deferred).
- No changes to `reasoning_runs`' RLS (stays deny-all/service-role-only;
  `house_id` is additive, not a new access path).
- No student access (matches Draft Mode).
- No changes to `owner_key`/`PersonKey` beyond using the existing `'ai'`
  value the same way Draft Mode already does.

## Verification checklist

- A real run, triggered from a blank house by a standard account: confirm
  it actually calls the new route (not the admin one), completes or
  pauses for clarification exactly like an admin run does, and the
  finished packets land in the house's own layers as unclaimed drafts.
- A student account: confirm the button/entry point is unavailable or
  clearly blocked, same as Draft Mode today.
- `/admin/reasoning` and its Past Runs browser: confirm completely
  unaffected — existing admin runs still show `house_id: null`, nothing
  about the admin flow changed.
- A stranger (not owner, not editor collaborator) hitting the new route
  directly: confirm it's rejected, same posture as every other
  house-scoped route this session already built.
