# 32 — Public Express Mode: inline reasoning pipeline for users

**Scoped:** 2026-09-03  
**Status:** Plan — ready for implementation session

## What this is

A new public-facing experience that lets users build a house by running the
reasoning pipeline directly — not from the admin panel, but inline inside the
build workspace. Think Notion AI: the pipeline runs visibly, the user watches
it think step-by-step, and the result populates their house.

This is **not** the admin-panel Express/Thorough toggle (implemented
separately, already in the working tree — 7 modified files + migration 0046).
This is the user-facing feature: making the pipeline a first-class way to
create a house.

## What already exists

### Pipeline engine (fully reusable)

- `lib/ai/reasoning/orchestrator-{setup,perspectives,global,panel}.ts` — pure
  step functions, nothing admin-specific
- `lib/ai/reasoning/steps.ts` — step order, labels, layer groups; has
  `EXPRESS_STEP_ORDER` (7 steps) and mode-aware helpers
- `lib/ai/reasoning/budget.ts` — cost estimates for both modes
- `lib/ai/reasoning/contracts.ts` — all packet schemas
- `lib/ai/reasoning/persistence.ts` — writes to `reasoning_runs` (now with
  `mode` column)

### House-scoped pipeline (already wired, doc 27)

- `app/api/houses/[id]/reasoning/route.ts` — house-scoped route
- `components/build/useReasoningPipelineRunner.ts` — client step-loop hook
- `components/build/rail/ReasoningPipelineCard.tsx` — rail card (offer →
  progress → done), ~300px embedded in copilot panel
- `lib/ai/reasoning/houseMapping.ts` — maps pipeline packets to house actions

### Post-pipeline console (already wired, docs 28–31)

- `app/build/[id]/console/page.tsx` — full-page chatbot for refining a
  pipeline-built house
- Console chats, reruns, sandbox reruns — all implemented

### Current UX flow

1. User opens blank house at `/build/[id]`
2. Copilot rail shows `ReasoningPipelineCard` (consolidated entry point)
3. User enters question → "Build my house" → pipeline runs in rail card
4. Pipeline completes → `APPLY_REASONING_RESULT` populates house
5. "Continue in full console →" link → chat to refine

### The gap

The pipeline UX is **buried in the copilot rail** — a small card in a side
panel. The feature should be a **primary, full-screen experience** that feels
inline. Users should discover it when they open a house, and optionally expand
into it from the copilot panel.

## Design

### Entry points

**1. Blank canvas CTA (primary)**  
When `houseIsBlank(state)`, the canvas itself shows a prominent entry point —
not hidden behind the copilot tab. Two paths:
- **"Let AI reason through this"** — centered CTA on the blank canvas with a
  question input. Clicking it enters the full-screen pipeline view.
- **Manual build** — existing "just start typing" flow, unchanged.

**2. Copilot panel → "Open full view" (secondary)**  
The existing `ReasoningPipelineCard` gains an "Expand" / "Open in full view"
button that transitions to the full-screen pipeline experience. Like clicking
"Open in full page" on a Notion AI block.

### Full-screen pipeline view

When the pipeline is running, the **canvas area replaces** the normal 7-layer
document with a dedicated pipeline progress view. Architecturally identical to
the sector deep-dive (`Canvas.tsx`'s `sectors?.activeSector` branch):

**Layout:**
- Canvas area shows pipeline progress (step checklist, live status, timing)
- Copilot rail stays visible (can show same progress or collapse)
- Layer nav hides or shows pipeline stages instead of 7 layers
- Back / exit button (like sector deep-dive's back button)

**During a run:**
- Step-by-step checklist (`ReasoningStagesList`, reused) — larger, centered
- Live status label ("Framing the core question…")
- Elapsed time counter
- Express checklist by default (6 groups, fast)
- Option to switch to thorough (22 steps, slower)

**On completion:**
- Transition back to populated canvas
- Toast: "Your house is ready — review and refine each layer"
- Console link appears

### Express as the public default

The admin panel defaults to Thorough (testing tool). The public view defaults
to **Express** — fast, no pauses, no review panels. Users who want the full
22-step experience can switch, but the default should feel snappy (~30-60 sec).

## Implementation

### Phase 1: Full-screen pipeline view in the canvas

1. **`components/build/PipelineView.tsx`** (NEW ~200 lines)  
   Full-screen pipeline progress component. Contains:
   - `ReasoningStagesList` (reused, larger layout)
   - Status label + elapsed timer
   - Mode indicator (Express / Thorough)
   - Back/exit button
   - On-completion transition

2. **`Canvas.tsx`** (MODIFY)  
   Third branch alongside existing two:
   ```
   if (sectors?.activeSector) → sector deep-dive (existing)
   if (pipelineFullView)      → PipelineView (new)
   else                       → normal 7-layer canvas (existing)
   ```
   Same pattern — scroll-reset, `ref={mainRef}`, replaces canvas content.

3. **`BuildHousePage.tsx`** (MODIFY)  
   - `pipelineFullView` state
   - Thread to `Canvas`
   - When pipeline starts from blank-canvas CTA or rail expand, set true
   - On completion + acknowledge, set false

4. **`ReasoningPipelineCard.tsx`** (MODIFY)  
   "Open full view" button → sets `pipelineFullView = true` via callback.

5. **Blank canvas CTA** (in `Canvas.tsx` or separate component)  
   When `houseIsBlank(state)` and pipeline idle, show centered entry with
   question input and "Build my house" button.

### Phase 2: Express mode in the house-scoped route

6. **`app/api/houses/[id]/reasoning/route.ts`** (MODIFY)  
   Accept `mode` in request body. Use `nextStepForMode()`. Same changes as
   the admin route — the admin Express changes are the template.

7. **`useReasoningPipelineRunner.ts`** (MODIFY)  
   - Accept `mode` parameter, default `'express'`
   - Send `mode` in every step fetch body
   - Start at `'frame-generate'` in express mode

### Phase 3: Polish

8. Transition animation: pipeline view → populated canvas
9. LayerNav during pipeline view
10. Mobile responsive treatment

## Key decisions for the implementing session

1. **Follow the sector deep-dive pattern in `Canvas.tsx`** — conditional
   render, back button, scroll reset. Don't invent a new pattern.

2. **Reuse existing components** — `ReasoningStagesList`,
   `ContextGatherAnswerBox`, `EvidenceGatherAnswerBox`, `FinalAnswerCard`.

3. **State in `BuildHousePage`** — `pipelineFullView` lives there, same level
   as `sectors`, `draftRunner`, `pipelineRunner`.

4. **Express as public default** — `useReasoningPipelineRunner` defaults to
   express. Admin keeps thorough.

5. **Don't touch admin** — admin route, admin page, admin components stay
   as-is. Public feature reuses shared engine + display components.

## Files to read first

| File | Why |
|------|-----|
| `components/build/Canvas.tsx` | Sector deep-dive branch = template |
| `components/build/BuildHousePage.tsx` | Runner state lives here |
| `components/build/useReasoningPipelineRunner.ts` | Client step loop |
| `components/build/rail/ReasoningPipelineCard.tsx` | Existing embedded UI |
| `components/build/rail/CopilotPanel.tsx` | How pipeline card is mounted |
| `components/admin/reasoning/ReasoningStagesList.tsx` | Step checklist |
| `app/api/houses/[id]/reasoning/route.ts` | House-scoped route |
| `lib/ai/reasoning/steps.ts` | EXPRESS_STEP_ORDER, mode helpers |
| `plans/active/reasoning-pipeline/27-house-scoped-pipeline-integration.md` | Original integration plan |

## What's already done (don't redo)

- Express mode types in `steps.ts` (`PipelineMode`, `EXPRESS_STEP_ORDER`)
- Express cost estimate in `budget.ts` (`estimateExpressCost`)
- `mode` field in admin `RequestSchema`
- Express dispatch in admin `route.ts`
- Express persistence (`persistence.ts` writes `mode`)
- Admin UI mode selector
- Migration `0046_reasoning_runs_mode.sql` (applied)

---

## Session prompt

Copy this into a new session's first message to kick off implementation:

---

**Implement public Express Mode — doc 32**

Read `plans/active/reasoning-pipeline/32-public-express-mode.md` first. It has
the full plan, architectural decisions, and file list.

Summary: Users should be able to run the reasoning pipeline as an inline,
full-screen experience when building a house — not buried in the copilot rail.
Think Notion AI: visible, step-by-step, taking over the canvas area.

**Phase 1** (do this first — it's the core UX):

1. Create `components/build/PipelineView.tsx` — full-screen pipeline progress
   view. Reuse `ReasoningStagesList` from admin (import, don't copy). Include
   elapsed timer, status label, mode indicator, back button.

2. Add a third branch to `Canvas.tsx` following the sector deep-dive pattern
   (`sectors?.activeSector` conditional). When `pipelineFullView` is true,
   render `PipelineView` instead of the normal canvas.

3. Add `pipelineFullView` state to `BuildHousePage.tsx`. Thread it to Canvas.
   Set true when pipeline starts from blank-canvas CTA or rail expand. Set
   false on completion.

4. Add blank-canvas CTA — when `houseIsBlank(state)` and pipeline is idle,
   show a centered entry point with question input and "Build my house" button.
   This lives in Canvas.tsx or a dedicated component.

5. Add "Open full view" button to `ReasoningPipelineCard.tsx` that sets
   `pipelineFullView = true`.

**Phase 2** (express mode in the house-scoped pipeline):

6. Add `mode` support to `app/api/houses/[id]/reasoning/route.ts` — use
   `nextStepForMode()` from `steps.ts`. The admin route's express changes
   are your template.

7. Update `useReasoningPipelineRunner.ts` to accept a `mode` parameter
   (default `'express'`), send it in fetch bodies, and start at
   `'frame-generate'` in express mode.

**Key rules:**
- Follow the sector deep-dive pattern in Canvas.tsx — don't invent new
  patterns
- State lives in BuildHousePage, same level as sectors and pipelineRunner
- Express is the default for public; admin stays thorough
- Don't touch admin components — reuse shared engine + display components
- Read the "Files to read first" table in the plan doc before coding

Use Sonnet 4.6 subagents if you want to parallelize — Phase 1 steps 1-3 are
independent of Phase 2 steps 6-7.
