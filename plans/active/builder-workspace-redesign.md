# Plan — Builder workspace redesign (document + sidebar)

**Scoped:** 2026-09-01 · **Status:** Active, phase 1 in progress
**Source:** Samir's "House UI Prototype" artifact (two variations, A/B).
**Decided with the user (2026-09-01):** Variation **B** (document left, persistent
panel right); Learn/Decide toggle stays **hidden** per
[ai-draft-mode-declutter.md](ai-draft-mode-declutter.md) §2–3; House Strength
renders its **real axes** (Evidence / Logic / Coverage, 40/35/25, invariant 6);
**restyle in place**, phased PRs, each verified in Chromium.

## 1. What changes, and what does not

The prototype is a re-skin of Draft Mode ([decision 016](../../decisions/016-draft-mode.md)):
claim-per-layer, provisional score, co-pilot suggestions with Add/Skip. Every
one of those already exists in `lib/ai/draft.ts`, the reducer, and
`/api/ai/suggest`. **No reducer, schema, or AI-route changes.** This is the
presentation layer of `components/build/` and `app/build/[id]`.

The one real architectural shift: the builder is a **stepped wizard** today
(`Canvas` renders `layers[state.step - 1]`, `BlueprintRail`/`MobileStepStrip`
navigate). The prototype is a **single scrolling document** with all seven
layers stacked and a nav that jumps between them.

`state.step` keeps its meaning as *the focused layer* — it stays view state,
`GO_STEP` stays clamped 1–7, `APPLY_DRAFT_STAGE` still moves it so the view
follows the build. Consumers adapt: nav click → `GO_STEP` → scroll-to-section;
scroll-spy (debounced, IntersectionObserver) → `GO_STEP`. `CopilotPanel`'s
per-step suggestion cache is unchanged, so scrolling costs at most one suggest
call per layer per session — the same as clicking through the wizard today.
`DraftClaimBanner` takes a `step` prop instead of reading `state.step`, so it
can render once per section. `lib/build/state.test.ts` stays green untouched.

`app/house/page.tsx` (the no-login builder) mounts the same `BuildHousePage`
and inherits the redesign; nothing there is special-cased.

## 2. Prototype → component map

| Prototype region | Existing home | Change |
|---|---|---|
| Top bar: logo · house title · actions | `AppBar` + `ContextBar` title | Merge: title moves beside the logo; `ContextBar` retires |
| Layer nav (7 dots, Frame → Review) | `BlueprintRail` (desktop), `MobileStepStrip` (mobile) | One `LayerNav` for both; horizontal, scroll-spied |
| "Saved 2 min ago · N of M unclaimed" | `SaveStatus` text in `ContextBar`; `unclaimedDraftStages()` | Status line right of the nav |
| Document: eyebrow, H1 question, purpose callout | `FrameLayer` | Becomes the document header |
| Section headers ("EVIDENCE · 5 things worth knowing") | `layers[]` in `lib/build/content.ts` | Add `documentHeading()` beside `layers` — one copy source |
| Per-section claim banner | `DraftClaimBanner` | Per-section, restyled |
| Score card + provisional badge | `ContextBar` pill + `ReviewLayer` overall card | Sidebar Overview tab, real axes |
| Next-steps checklist | *(new, derived)* | Pure function of `State` + `DraftState` |
| Co-pilot suggestion cards (Add / Skip) | `FindingCard` in `CopilotPanel` | Restyle; Skip = consume without applying |
| Co-pilot tab | `CopilotPanel` (interview, pipeline card, findings) | Preserved |
| Team tab | `TeamPanel` | Preserved, unchanged |

## 3. Phases

1. **Shell + document** — `AppBar` absorbs the title; `LayerNav` replaces both
   step navs; `Canvas` renders all sections stacked with ids + scroll-spy;
   Back/Next footer removed; sidebar gains an Overview tab holding the score
   card (so the score has a home once the `ContextBar` pill goes).
2. **Overview panel** — score card with real axes + provisional state;
   next-steps checklist; `FindingCard` gets Add/Skip and the prototype's
   suggestion-card language.
3. **Document sections** — perspective cards with "this perspective
   concludes" (= `stance`), inline sub-questions; numbered evidence (E.01)
   with italic source; assumption cards; conclusion "This is yours to write"
   empty state; implications as pos/neg/unc rows; per-section toolbars.

Each phase: `pnpm typecheck && pnpm lint && pnpm test`, then a production
build driven in Chromium at 1440×900 and 390×844 before the PR opens.

## 4. Prototype discrepancies (and what the build does instead)

- **Export / Publish buttons.** No such features exist; `ReviewLayer`'s own
  comment records the earlier Publish/Export as "success-toast theater over
  no-ops", removed in the 2026-07-19 audit. **Not rendered** until the features
  are real. The draft gate still surfaces via the provisional score.
- **Reading view.** No feature. Deferred; cheap CSS toggle if wanted later.
- **Score axes.** Prototype shows Evidence/Perspectives/Assumptions/Conclusion;
  the model is Evidence/Logic/Coverage. Real axes render (decided).
- **Perspective categories** (PRACTICAL / LOGICAL…) and **assumption
  categories** (UNSTATED / FOUNDATIONAL / UNKNOWN UNKNOWN) are not in the data
  model. Rendering them needs a schema decision — out of scope. Cards render
  without a category eyebrow; perspective accent colours cycle by index.
- **"Originally asked:"** — no such field. Omitted.
- **"4 of 6 layers unclaimed"** — there are five draft stages; the real count
  renders.
- **"Ask the co-pilot anything…"** — House Chat is admin-gated (decision 017).
  Not rendered for standard accounts; `LayerFeedbackThread` remains the
  per-layer Q&A.
- **Learn / Decide toggle** in the status bar — hidden (decided; declutter §2).
- **Variation A** shows duplicated Emotional/Long-term cards and 3 of "5"
  evidence items; **A** has Concepts but no Implications, **B** the reverse.
  Mockup artifacts; the build renders every layer once.
- **Co-pilot "Research" / "Help me" actions.** Research Mode exists
  (`ResearchResults`, evidence layer); "Help me" maps to nothing. Cards keep
  Add / Skip.

## 5. Out of scope

No change to `lib/build/state.ts`, `lib/build/strength.ts`, `lib/ai/*`, any
`app/api/*` route, the console (`components/build/console/`), the classroom
submission flow (`SubmissionFeedback`), or the Team panel. No schema changes.
