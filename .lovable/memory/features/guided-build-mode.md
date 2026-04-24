---
name: Guided Build Mode
description: Step-by-step onboarding/build flow as a third view mode on AnalysisPage alongside Standard and Interactive Builder
type: feature
---

Guided Build Mode is a third `viewMode` ("guided") on `src/pages/AnalysisPage.tsx`, sitting alongside `"standard"` and `"builder"`. It is implemented as `src/components/house/GuidedBuildMode.tsx`.

Key behaviors:
- Sidebar entry: Compass icon button is the FIRST view-toggle button in the left rail (above Standard and Interactive). Mirrored as a "Guided" entry in the mobile bottom nav.
- Auto-entry: First time a logged-in user opens any analysis on a device, Guided Mode auto-activates (one-shot via `localStorage` key `hot:guided-onboarded:<userId>`). Respects an explicit `?view=` URL param.
- Live sync (no separate draft): every input writes directly to the same tables as Standard/Interactive (`analyses`, `pov_labels`, `sub_questions`, `assumptions`; implications/consequences serialized into `analyses.consequences` JSON, matching `ImplicationsPage.tsx`'s schema).
- Step model: 10 steps + intro + completion. User-controlled "Continue" at each step (no enforced minimums beyond a non-empty input on text-entry steps).
- For steps 5–7 (Information / Assumptions / Sub-Conclusions) the UI operates on the FIRST sub-question only; a note tells the user to use Free Build Mode to repeat for other sub-questions.
- Progress weights (must total 100): Purpose 10, Question 10, POVs 15, Sub-Questions 20, Information 15, Assumptions 10, Sub-Conclusions 10, Conclusion 5, Implications 5. Consequences and Intro/Complete are 0%.
- Completion screen embeds `LogicStrengthPanel` to surface the real Logic Strength Score and suggestions.
- Exit Guided Mode → drops user into Standard view; navSuffix supports `?view=guided` so deep links/breadcrumbs preserve the mode.
- Hidden in `readonly` (teacher review) — Guided Mode never renders when `readonly === true`.
