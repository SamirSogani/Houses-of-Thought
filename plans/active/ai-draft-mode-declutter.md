# Draft-mode / co-pilot UX declutter

**Scoped:** 2026-08-16, feedback from actually using the workspace after
team-panel-v2 shipped: too much stacked UI on a blank house, a mode toggle
nobody needs to see, and suggestions that feel too template-y.

## 1. Consolidate the blank-house entry point

Today, `CopilotPanel` stacks, on a blank house: the intro tile,
`InterviewCard`'s "Give the co-pilot context" card (chat, up to 6 turns,
distills into `state.aiContext`), `DraftCard`'s "Start with an AI draft"
offer (disabled until the interview's done), then regular suggestion cards
below. Four things where there should be one.

**Change:** when `houseIsBlank(state)` (already exists, `DraftCard.tsx`),
replace the Interview-card-then-Draft-card stack with a single button:
**"Enter reasoning pipeline."** Clicking it should run the *same real
mechanism* that exists today — start the interview flow, then on
completion hand off into the draft runner — just presented as one entry
point instead of two dependent cards. **Do not** attempt to wire this to
the actual `/admin/reasoning` multi-agent pipeline (admin-gated, writes to
a separate `reasoning_runs` table, no house-integration path exists) —
that's a real, separate integration project, explicitly out of scope here
per Samir's own "may be developed further later... not anytime now."

Once the house has any content (`!houseIsBlank`), nothing here changes —
`InterviewCard` keeps its existing standalone role (gathering context to
improve suggestions on a house someone's already building by hand).

## 2. Hide the Learn/Decide toggle

`ContextBar`'s `learn`/`decide` button group (decision 007) goes away from
the UI entirely. The underlying `mode` state and its behavioral effects
stay — `capabilitiesFor` still forces `'learn'` for students regardless
(untouched) — only the manual toggle control disappears. Default to
`'decide'` when nothing forces a mode.

## 3. Co-pilot suggestions: ask *and* suggest, not gated by a hidden mode

`FindingCard` currently renders **either** the Socratic question (`mode
=== 'learn'`) **or** the observation+suggestion+Add button (`'decide'`) —
never both. With the toggle gone (item 2), that binary no longer has a
visible control driving it. Change `FindingCard` to show **both**: the
question first (framed as something to think about), then the
observation/suggestion with its Add button — so the co-pilot always reads
as "here's something to consider, and here's a concrete suggestion if you
want it," not fixed to one register. `/api/ai/suggest`'s findings already
carry both `question` and `observation`/`suggestion` per finding (per
`lib/ai/findings.ts`'s `Finding` type) — this is a rendering change, not a
new AI call.

## Explicitly out of scope

- No change to `/admin/reasoning` or anything under `lib/ai/reasoning/`.
- No new AI prompts/endpoints — item 3 renders data the API already
  returns.
- No schema changes.
