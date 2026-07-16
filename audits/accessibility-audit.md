# Accessibility Audit — Houses of Thought (WCAG 2.2 AA)

**Auditor:** accessibility-auditor (general-purpose subagent, model: fable)

**Scope:** Next.js 16 App Router site. All files in `app/` and `components/` reviewed: marketing pages (`/`, `/how-it-works`, `/educators`, `/faq`, `/story`, `/examples`), auth (`/login`), Try-It flow (`/try`), dashboard/profile/classroom, the Build-a-House workspace, and admin monitor.
**Method:** Manual code review of all ~70 TSX/CSS UI files; contrast ratios computed from `globals.css` tokens. No automated scanner available in the environment (no axe-core, pa11y, or Lighthouse binaries found in `node_modules/.bin` or PATH — none installed).
**Severity scale:** Critical / Serious / Moderate / Minor.

---

## 1. Color & contrast (SC 1.4.3 Contrast Minimum, 1.4.11 Non-text Contrast)

Measured ratios (foreground on background):

| Pair | Ratio | AA (normal text) |
|---|---|---|
| `--amber` #F2B021 on white / parchment | **1.91 / 1.76** | Fail |
| `--amber-hover` #D9990C on white / parchment | **2.47 / 2.28** | Fail |
| `--warning` #C2682B on white / parchment | **3.96 / 3.66** | Fail |
| white on `--warning` | **3.96** | Fail |
| `--green-strong` #3F8F5B on white | **3.97** | Fail |
| white on `--green-strong` | **3.97** | Fail |
| `--rule` #AEB8C7 on parchment | **1.85** | Fail |
| `--ink-subtle` on ink #14213A | **2.96** | Fail |
| `--ink-subtle` on white/parchment | 5.42 / 5.01 | Pass |
| `--ink` on `--amber` (primary buttons) | 8.41 | Pass |

**1.1 — Critical.** `.eyebrow-amber` renders 12px uppercase text at 1.9:1.
- `app/globals.css:59-66`; used at `components/try/TryItFlow.tsx:138`, `components/try/MiniHouseResult.tsx:33`.
- **Fix:** switch these eyebrows to `--ink-subtle` (5:1) or a darkened amber ≥ #8a6400; reserve `--amber` for non-text accents.

**1.2 — Serious.** `--amber-hover` (#D9990C, 2.47:1) used as *text* color widely: FAQ group labels (`components/sections/FaqGroupsSection.tsx:208`), "Layer X / 7" kicker (`components/build/Canvas.tsx:38`), WhatsNewDrawer labels (`components/build/WhatsNewDrawer.tsx:32,44,53`), "ACTIVE" chip at 8px (`components/profile/AccountTypeSelector.tsx:68`), read-only strawman banner (`components/build/BuildHousePage.tsx:134`), third perspective accent (`components/try/MiniHouseResult.tsx:11,79`), and the `.text-link:hover` state (`app/globals.css:142`).
- **Fix:** introduce a text-safe amber (~#946A00 gives ≥ 4.5:1 on parchment) as `--amber-text` and use it for all amber-tinted text; keep #D9990C for backgrounds/borders only.

**1.3 — Serious.** All error messages use `--warning` (3.96:1) at 11–13px: `app/login/page.tsx:271-281`, `components/profile/ProfileForm.tsx:121-122`, `components/classroom/StudentClasses.tsx:151`, `components/classroom/AssignmentPanel.tsx:177`, `components/classroom/StrawmanAuthor.tsx:130`, `app/dashboard/page.tsx:165`, `app/classroom/page.tsx:138`, `components/admin/AiMonitor.tsx:261`. Also the "Delete Account" button (white on `--warning`, 14px semibold, `components/profile/DeleteAccountModal.tsx:73-90`) and its 22px heading.
- **Fix:** darken `--warning` to ~#A54A10 (≥ 4.5:1 on white) or add a `--warning-text` token; error text especially must pass.

**1.4 — Serious.** `--green-strong` (3.97:1) as text: "Turned in" chip at 9px (`components/dashboard/HouseCard.tsx:168`), saved-status text (`components/profile/ProfileForm.tsx:215`), first perspective accent (`MiniHouseResult.tsx:11`); white-on-green "Done" badge (`components/build/BlueprintRail.tsx:152`).
- **Fix:** darken to ~#2E6B44 for text usage.

**1.5 — Moderate.** `--rule` (#AEB8C7) used as *text* on parchment (1.85:1): login footer note "Your reasoning stays yours" (`app/login/page.tsx:359-371`). (Its use on the ink mobile overlay is fine at 8:1.)
- **Fix:** use `--ink-subtle`.

**1.6 — Moderate.** Footer column headings and bottom bar use `--ink-subtle` on ink background = 2.96:1 at 11px (`components/sections/Footer.tsx:34-41,124-142`).
- **Fix:** lighten to `--rule` (#AEB8C7 → 8:1 on ink) or parchment at reduced opacity ≥ 4.5:1.

---

## 2. Keyboard & focus (SC 2.1.1, 2.4.3, 2.4.7, 2.4.11)

**2.1 — Critical.** No visible focus indicator on the interactive house diagram. Each SVG layer is `role="button" tabIndex={0}` with `outline: 'none'` and no replacement (`components/sections/InteractiveHouseSection.tsx:61`). Keyboard users cannot see which layer is focused. SC 2.4.7.
- **Fix:** remove `outline: 'none'`; add e.g. `:focus-visible { outline: 3px solid var(--ink); outline-offset: 2px }` or increase stroke-width/fill on focus.

**2.2 — Critical.** Inline-edit fields have **no focus indicator at all**: `components/build/Editable.tsx:9-19` sets `border: none; outline: none` with no focused-state styling. Same for the house-title input (`components/build/ContextBar.tsx:60-77`) and inline inputs in `components/build/layers/PerspectiveDetail.tsx:181`, `EvidenceLayer.tsx:85`, `ImplicationsLayer.tsx:87`. Tabbing through the build canvas gives zero visual feedback. SC 2.4.7.
- **Fix:** add a global rule `input:focus-visible, textarea:focus-visible, [tabindex]:focus-visible, button:focus-visible { outline: 2px solid var(--blueprint); outline-offset: 2px }` in `globals.css`, then remove per-component `outline: 'none'` (about 20 occurrences; the border-color-swap pattern on login/profile inputs is a weak but passing indicator — the Editable/ContextBar fields have nothing).

**2.3 — Serious.** Modals have `aria-modal="true"` but **no focus trap and no focus restoration**: `components/build/InviteModal.tsx`, `components/profile/DeleteAccountModal.tsx`, `components/build/WhatsNewDrawer.tsx`. Tab walks into the inert background while ARIA tells screen readers it doesn't exist. WhatsNewDrawer additionally never moves focus on open (no autofocus, `WhatsNewDrawer.tsx:8-16`). SC 2.4.3 / 1.3.2 / 4.1.2.
- **Fix:** trap Tab within the dialog (loop first/last focusable), focus the dialog or close button on open, and return focus to the invoking control on close.

**2.4 — Serious.** Header mobile nav sheet (`components/Header.tsx:180-286`) is a full-screen overlay with no `role="dialog"`, no `aria-modal`, no focus trap, focus not moved on open or returned on close. The hamburger (`Header.tsx:147`) lacks `aria-expanded`/`aria-controls`. Escape works (good). SC 2.4.3 / 4.1.2.
- **Fix:** treat as a modal dialog (role, focus management, trap) and add `aria-expanded={mobileOpen}` to the trigger.

**2.5 — Serious.** No skip link anywhere (`app/layout.tsx:38-48`); every page forces keyboard users through the full header. SC 2.4.1 Bypass Blocks.
- **Fix:** add a visually-hidden-until-focused "Skip to main content" anchor as the first element in `<body>` and `id="main"` on each `<main>`.

**2.6 — Serious.** HouseCard kebab menu (`components/dashboard/HouseCard.tsx:179-225`): trigger lacks `aria-expanded`/`aria-haspopup`; the menu cannot be closed with Escape (only an invisible click-backdrop, line 197); focus is not moved into or restored from the menu; delete confirmation swaps in-place with no announcement. SC 4.1.2 / 2.1.1.
- **Fix:** add `aria-haspopup="true" aria-expanded={menuOpen}`, close on Escape and on focus-out, focus first item on open.

**2.7 — Serious.** Perspective cards are `role="button" tabIndex={0}` **divs containing nested interactive controls** (text inputs, remove button, avatar button) — `components/build/layers/PerspectivesLayer.tsx:38-99`. Nested interactives inside a control are invalid; screen readers announce the whole card (including editable fields) as one button, and the button's accessible name is the concatenated card content. SC 4.1.2 / 1.3.1.
- **Fix:** make the drill-in affordance an explicit "Open" button/link inside a plain card (the chevron at line 86-88 is the natural candidate) instead of putting `role="button"` on the container.

**2.8 — Moderate.** `role="radiogroup"`/`role="radio"` without roving tabindex or arrow-key support (`components/profile/AccountTypeSelector.tsx:38-47`). Radios are expected to be one tab stop with arrow navigation. SC 4.1.2.
- **Fix:** implement roving tabindex, or drop the radio roles and keep them as `aria-pressed` buttons (simpler and honest).

**2.9 — Moderate.** Tab-like controls expose no state to AT: login Log-in/Sign-up switch (`app/login/page.tsx:130-151`) and build right-rail Co-pilot/Team tabs (`components/build/BuildHousePage.tsx:194-206`) convey the active tab by color/background only. SC 4.1.2 / 1.4.1.
- **Fix:** add `aria-pressed` (or full `tablist`/`tab`/`aria-selected` semantics with arrow keys).

**2.10 — Moderate (WCAG 2.2 SC 2.5.8 Target Size Minimum, 24×24px).** Failing targets: `RemoveButton` 20×20 (`components/build/Editable.tsx:90-101`) and its 16×16 variants (`components/build/layers/PerspectiveDetail.tsx:137,171,208`); ▲/▼ reorder buttons ~14×12 stacked with no spacing (`components/classroom/AssignmentPanel.tsx:229-230`, `reorderBtn` at 280-291); avatar reassign buttons 24px (borderline).
- **Fix:** give these a 24px minimum hit area (padding, not glyph size).

**2.11 — Minor.** Inert "Invite people" button that does nothing (`components/build/BuildHousePage.tsx:221-234`, commented "intentionally inert") and non-interactive nav-styled `<span>`s "Framework"/"Collab" inside `<nav>` (`components/build/AppBar.tsx:35-53`). Keyboard/SR users get dead ends. **Fix:** `disabled` + explanation, or remove.

---

## 3. ARIA, live regions & dynamic content (SC 4.1.2, 4.1.3)

**3.1 — Serious.** The AI surfaces have **no live regions at all**:
- Co-pilot suggestions load/refresh/error silently (`components/build/rail/CopilotPanel.tsx:163-194`).
- Interview chat: assistant replies appear with no announcement; the transcript has no log semantics and user/assistant turns are distinguished only by alignment/background color (`components/build/rail/InterviewCard.tsx:101-123`) — also SC 1.3.1.
- Try-It flow: the input → loading → result/error phase swaps are unannounced, and the 5-stage progress checklist is purely visual (`components/try/TryItFlow.tsx:106-117, 279-347`).
- Profile save status "Saving/Saved/Error" (`components/profile/ProfileForm.tsx:215`).
- **Fix:** wrap suggestion list status, chat transcript (`role="log" aria-live="polite"`), loading stage text, and save/error status in polite live regions; on Try-It phase change move focus to the result `<h1>` / error heading.

**3.2 — Serious.** Interactive house diagram state (`components/sections/InteractiveHouseSection.tsx`): selected layer conveyed only by amber fill (SC 1.4.1 — color-only, and the tint is ~1.4:1 against the background, SC 1.4.11); no `aria-pressed`/`aria-current` on the layer buttons; the definition panel updates are not announced and not programmatically associated with the diagram. The panel *is* a good text alternative — it just isn't wired up.
- **Fix:** `aria-pressed={activeLayer===k}` on each group, `aria-live="polite"` on the definition panel, a `<title>`/`aria-label` per group (the Perspectives group currently gets the name "SELF GROUP IDEAS" from its text children), and a non-color selected treatment (thicker stroke). Consider also documenting the panel as the accessible alternative in the section intro ("Hover or tap" → "Hover, tap, or use Tab/Enter").

**3.3 — Moderate.** Form-level errors are not announced and not associated: login error `<p>` (`app/login/page.tsx:271-281`), join-code error (`StudentClasses.tsx:151`), username errors (`ProfileForm.tsx:121-122`). SC 4.1.3 / 3.3.1.
- **Fix:** `role="alert"` on error paragraphs and `aria-describedby` + `aria-invalid` on the offending inputs.

**3.4 — Moderate.** Toast (`components/build/Toast.tsx:5-7`) returns `null` when empty, so the `role="status"` container is mounted *with* its content — screen readers frequently miss live-region content inserted together with the region.
- **Fix:** keep the container permanently rendered and toggle only the message text/visibility.

**3.5 — Moderate.** Unlabeled/mis-labeled form fields in dialogs: InviteModal's "Email or name" is a styled `<div>` not associated with the input (`components/build/InviteModal.tsx:52-59` — placeholder only); DeleteAccountModal's `<label>` lacks `htmlFor` and doesn't wrap the input (`components/profile/DeleteAccountModal.tsx:51-60`). SC 1.3.1 / 3.3.2.
- **Fix:** `htmlFor`/`id` pairs or `aria-labelledby`.

**3.6 — Minor.** `aria-label="Done"` on a plain `<span>` (`components/build/BlueprintRail.tsx:152`) — aria-label is ignored/unreliable on generic elements; done-state also isn't in the layer button's name. **Fix:** append visually-hidden "(done)" text inside the layer button.

**3.7 — Minor.** Tooltip-only names via `title` throughout the build UI (`components/build/Avatar.tsx:27`, `ContextBar.tsx:84,125,165`, `AppBar.tsx:60`): `title` is not keyboard-discoverable and unreliable on touch. The owner-cycling avatar button never announces the *current* owner or the change (`PerspectivesLayer.tsx:75-85`). **Fix:** real `aria-label`s that include state ("Owner: Maya — click to reassign") plus a live region or toast on change.

**3.8 — Minor.** Admin tables lack `scope="col"` on headers (`components/admin/AiMonitor.tsx:326-335`, `components/admin/ModelDetail.tsx:277-284`). SC 1.3.1.

---

## 4. Semantic structure (SC 1.3.1, 2.4.6, 2.4.1)

**4.1 — Moderate.** FAQ accordion (`components/sections/FaqGroupsSection.tsx`): questions are bare `<button>`s, not wrapped in headings, and group labels ("The basics", …) are styled `<p>`s — the FAQ page has no navigable heading structure below its h1. Buttons also lack `aria-controls`/panel `id`s. **Fix:** `<h2>` for group labels, `<h3><button aria-expanded aria-controls></h3>` per question (the `aria-expanded` already present is good).

**4.2 — Moderate.** Profile page has no `<h1>` and its section titles are styled `<div>`s (`components/profile/primitives.tsx:33-46` `FieldLabel`). SC 1.3.1 / 2.4.6. **Fix:** render `FieldLabel` as `h2`/`h3` (accept a `as` prop) and add a page h1.

**4.3 — Moderate.** Heading order jumps: dashboard `<h1>` → HouseCard `<h3>` (`components/dashboard/HouseCard.tsx:107`) with no h2; home page `HeroSection` h1 → section `h2`s is fine, but `InteractiveHouseSection` uses h2 → h3 for the panel title while sibling sections put h3s elsewhere — verify sequence per page. **Fix:** make HouseCard titles `h2` (or add a visually-hidden "Your houses" h2).

**4.4 — Minor.** Repeated item collections are divs, not lists: house grid (`app/dashboard/page.tsx`), findings (`CopilotPanel.tsx:220-226`), evidence (`EvidenceLayer.tsx`), footer link columns (`components/sections/Footer.tsx:101-119`), nav-sheet links. SC 1.3.1. **Fix:** `ul/li` where order/count matters.

**4.5 — Minor.** Current page not exposed in nav: active link styled by underline/color only, no `aria-current="page"` (`components/Header.tsx:72-95`, `components/dashboard/DashboardHeader.tsx:60`).

**4.6 — Minor.** Decorative hero SVG not hidden from AT (`components/sections/HeroSection.tsx:32` — no `aria-hidden` or `role="img"`+label; the "Draws in 900ms" annotation is exposed). By contrast `components/sections/HowBuildFlowSection.tsx:82` does this correctly (`role="img"` + descriptive label) — use it as the model. SC 1.1.1.

---

## 5. Forms (SC 3.3.1, 3.3.2, 1.3.5)

- **Good:** login has real `<label htmlFor>`s, `autoComplete`, `required`, `minLength` (`app/login/page.tsx:155-233`); most custom inputs carry `aria-label`s; `StrawmanAuthor` wraps inputs in `<label>` (`components/classroom/StrawmanAuthor.tsx:176-185`); `AssignmentPanel` labels its `<select>`.
- **5.1 — Moderate.** Widespread placeholder-as-visible-label (`aria-label` only): join code (`StudentClasses.tsx:113`), rename (`HouseCard.tsx:246-256`), research focus (`ResearchResults.tsx:73`), interview answer (`InterviewCard.tsx:136`). Placeholder text disappears on input; SC 3.3.2. **Fix:** add small persistent visible labels (the mono-label pattern already used in InviteModal, properly associated).
- **5.2 — Moderate.** Signup "Account type" group label is a styled `<span>` not associated with the radiogroup (`app/login/page.tsx:236-249` — though the selector itself has `aria-label="Account type"`, the visible text isn't linked; acceptable, but keep them in sync).
- **5.3 — Minor.** Required-field cues: nothing marks which fields are required visually (login relies on browser validation only).

---

## 6. Motion & media (SC 2.3.3, 2.2.2)

- **Good:** comprehensive `prefers-reduced-motion` coverage in `app/globals.css:161-164, 185-187, 199-201, 240-242`, and `components/ScrollReveal.tsx:7` checks `matchMedia` before observing. `components/try/Fade.tsx` reuses the gated keyframe. This is genuinely well done.
- **6.1 — Minor.** Scroll-reveal content stays at `opacity: 0` if JS fails or IntersectionObserver is unavailable (`app/globals.css:175-180`). **Fix:** set the hidden state via a JS-added class (`.js [data-reveal]`) so no-JS renders content.
- **6.2 — Minor.** The Try-It loading view runs a timed spinner/checklist with no pause need (< 5s, auto-progresses) — acceptable, but announce completion (covered in 3.1).

---

## Positive practices (keep these)

`html lang="en"`; `header/main/footer` landmarks on all pages; `aria-expanded` on FAQ; `role="dialog" aria-modal` + Escape + autofocus on Invite/Delete modals; `role="status" aria-live` on Toast; `aria-pressed` on Learn/Decide and Research Mode toggles; `aria-label` on nearly all icon-only buttons; keyboard handlers (Enter/Space) on the interactive diagram; no `user-scalable=no`; reduced-motion discipline; text-based progress ("3/7 layers · 43%") accompanying every progress bar.

---

## Highest-impact fixes, in order

1. **Restore visible keyboard focus globally** — one `:focus-visible` rule in `globals.css` + delete the ~20 `outline: 'none'` declarations. Unblocks every keyboard user across the entire app (2.4.7). Critical files: `components/build/Editable.tsx:12`, `components/build/ContextBar.tsx:74`, `components/sections/InteractiveHouseSection.tsx:61`.
2. **Fix the color-token contrast failures** — add text-safe variants of `--amber`, `--amber-hover`, `--warning`, `--green-strong` and swap them in for all text usage; fixes ~25 call sites at once, including every error message (1.4.3).
3. **Make the interactive house diagram state-complete** — focus outline, `aria-pressed`, `aria-live` on the definition panel, per-layer accessible names (2.4.7, 4.1.2, 4.1.3, 1.4.1).
4. **Modal focus management** — shared trap + focus-restore for InviteModal, DeleteAccountModal, WhatsNewDrawer, and convert the mobile nav sheet into a proper dialog with `aria-expanded` on the hamburger (2.4.3, 4.1.2).
5. **Add live regions to the AI surfaces** — co-pilot findings, interview chat, Try-It phase changes, save/error statuses; keep Toast mounted (4.1.3).
6. **Add a skip link** in `app/layout.tsx` (2.4.1).
7. **Un-nest the perspective cards** — replace container `role="button"` with an explicit open control (4.1.2).
8. **Kebab menu semantics** on HouseCard — `aria-expanded`, Escape, focus management (4.1.2, 2.1.1).
9. **Error wiring** — `role="alert"` + `aria-describedby`/`aria-invalid` on all form errors (3.3.1, 4.1.3).
10. **Target sizes** — 24px minimum for remove/reorder/avatar micro-buttons (2.5.8).
