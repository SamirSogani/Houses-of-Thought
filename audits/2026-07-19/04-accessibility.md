# WCAG 2.2 AA Accessibility Audit — Houses of Thought

**Auditor:** accessibility-auditor (subagent, model: Fable) · read-only · 2026-07-19

No axe-core, pa11y, or Lighthouse were installed locally (and as a read-only
auditor the agent did not install packages), so this is a full manual static
review of every page and component in `app/` and `components/`, plus programmatic
contrast-ratio computation using the WCAG relative-luminance formula (run via
`node`). Line numbers reference file state at 2026-07-19.

**Scope reviewed:** all 22 routes in `app/` and all 60+ components in
`components/`, plus `app/globals.css` and `app/layout.tsx`.

**Overall picture:** solid foundations (landmarks, labeled form controls,
`aria-hidden` icons, reduced-motion handling) undermined by three systemic gaps:
**no focus-visible styling combined with widespread `outline: none`**, **no focus
management in any modal/overlay**, and **a brand amber/warning palette that fails
contrast almost everywhere it is used as text**.

---

## CRITICAL

### C1. Widespread invisible keyboard focus — WCAG 2.4.7 (Focus Visible), 2.4.13
There is **not a single `:focus` or `:focus-visible` rule in the entire codebase** (`app/globals.css` and all components), and ~20 components explicitly suppress the UA indicator with `outline: 'none'`. Controls with **no focus indicator at all**:
- `components/sections/InteractiveHouseSection.tsx:61` — the interactive house diagram's `role="button"` SVG groups (`outline: 'none'`, no replacement).
- `components/build/Editable.tsx:12` — every inline-edit field in the entire Build workspace (borderless, transparent, `outline: none`; focus is completely undetectable).
- `components/build/ContextBar.tsx:74` — house title input.
- `components/profile/DeleteAccountModal.tsx:59`, `components/dashboard/HouseCard.tsx:255`, `components/try/TryItFlow.tsx:195`, `components/build/SubmissionFeedback.tsx:143,183`, `components/build/layers/ResearchResults.tsx:79`, `components/build/rail/InterviewCard.tsx:142` — inputs/textareas with `outline: none` and no focus style.
Some inputs (login, InviteModal, profile primitives) swap border `--rule`→`--ink` on focus, which is a weak but present indicator; the rest have nothing.
**Fix:** add a global rule to `globals.css` — `:focus-visible { outline: 2px solid var(--blueprint); outline-offset: 2px; }` — and delete every inline `outline: 'none'` (or replace with `outline: 'none'` only under `:focus:not(:focus-visible)`).

### C2. Modals and overlays have no focus management — WCAG 2.4.3 (Focus Order), 2.1.2, 1.3.2
All four overlay surfaces render `role="dialog" aria-modal="true"` (or nothing) without trapping or restoring focus. Tab moves into the obscured page behind the dialog while `aria-modal` tells screen readers that content doesn't exist:
- `components/build/InviteModal.tsx:33-39` — focuses the input on open (good), but no trap, no focus restore on close.
- `components/profile/DeleteAccountModal.tsx:28-33` — `autoFocus` on input (good), no trap/restore.
- `components/build/WhatsNewDrawer.tsx:22-28` — **no initial focus at all**, no trap, no restore; a keyboard user opening "What's new" is still focused behind the drawer.
- `components/Header.tsx:180-286` — full-screen mobile nav sheet: no `role="dialog"`, no `aria-modal`, focus is not moved into it, not trapped, not restored; the hamburger (`Header.tsx:147`) lacks `aria-expanded`. Escape works (good); body scroll locked (good).
**Fix:** on open, move focus to the dialog (first control or close button); trap Tab within it; on close, return focus to the invoking control. Add `aria-expanded={mobileOpen}` to the hamburger.

### C3. Brand amber / warning text colors fail contrast site-wide — WCAG 1.4.3 (Contrast, Minimum)
Measured ratios (foreground on background):

| Usage | Ratio | Location |
|---|---|---|
| `.eyebrow-amber` #F2B021 on parchment/white | **1.76–1.91** | `app/globals.css:59-66`; used at `components/try/TryItFlow.tsx:138`, `components/try/MiniHouseResult.tsx:33` (12px text) |
| `--amber-hover` #D9990C mono labels on parchment/white | **2.28–2.47** | `components/build/Canvas.tsx:38` ("Layer x / 7"), `components/build/WhatsNewDrawer.tsx:32,44,53`, `components/sections/FaqGroupsSection.tsx:208` (FAQ group labels), `components/build/BuildHousePage.tsx:134` (strawman banner) |
| `.text-link:hover` #D9990C on parchment | **2.28** | `app/globals.css:142`; also login switch-mode hover `app/login/page.tsx:345` |
| "In progress" chip #D9990C on amber-tint | **2.16** | `lib/dashboard/houses.ts:27` → `components/dashboard/HouseCard.tsx:163` (9px text) |
| "Active" chip #D9990C on amber-tint | **2.16** | `components/profile/AccountTypeSelector.tsx:68` (8px text) |
| `--warning` #C2682B body-size text | **3.66–3.96** | login error `app/login/page.tsx:276`, profile errors `components/profile/ProfileForm.tsx:121-122` (12–13px), MiniHouseResult perspective labels `components/try/MiniHouseResult.tsx:12` (11px) |
| `--green-strong` #3F8F5B small text | **3.67–3.97** | "Turned in" chip `HouseCard.tsx:168` (9px), strength numbers |
| `var(--rule)` on parchment | **1.85** | login footer note `app/login/page.tsx:367` |
| `--ink-subtle` on ink footer | **2.96** | `components/sections/Footer.tsx:34-41` (column headings) and `:137` (bottom bar) |

**Fix:** create darker text-safe variants (e.g. amber-text ≈ #8A6200, warning-text ≈ #A8501B, green-text ≈ #2E7347) and reserve `--amber`/`--amber-hover` for backgrounds and large graphics. Change footer secondary text to `var(--rule)` (8.01:1 on ink).

### C4. Interactive house diagram: state and semantics incomplete — WCAG 4.1.2, 1.4.1, 2.4.7
`components/sections/InteractiveHouseSection.tsx:58-65` — the clickable SVG layers are keyboard-operable (`tabIndex`, Enter/Space — good), but:
- No exposed selected state: the active layer is conveyed **only by fill color** (1.4.1, 4.1.2). Add `aria-pressed={activeLayer === k}`.
- No focus indicator (`outline: 'none'`, C1). Add an SVG focus style (e.g. thicker amber stroke on `:focus-visible`).
- The Perspectives group's accessible name computes to "SELF GROUP IDEAS" (its child `<text>`); give each `<g>` an explicit `aria-label` ("Perspectives, layer 3 of 7").
- The definition panel that updates on selection (`:157-233`) is not announced; add `aria-live="polite"` to the detail card, or better, convert the layer list to a proper `tablist`/radiogroup pattern where the panel is referenced via `aria-controls`.
- **Documented accessible alternative:** the text panel does contain all layer content one-at-a-time, but there is no static all-layers text alternative. The same diagram content exists accessibly at `components/sections/HowBuildFlowSection.tsx` (static `role="img"` + `aria-label` + adjacent text list) — link or replicate that pattern here.

---

## SERIOUS

### S1. Nested interactive controls inside `role="button"` cards — WCAG 4.1.2
`components/build/layers/PerspectivesLayer.tsx:38-49` — each perspective card is a `div role="button" tabIndex={0}` that **contains** an `<input>`, a `<textarea>`, and two `<button>`s (remove, reassign-owner). Nested interactive elements inside a button role are invalid ARIA structure; screen readers flatten the card into one button and the inner fields become unreachable/unpredictable. The `stop()` spans (`:65,91`) patch mouse behavior but not the semantics.
**Fix:** make the card a plain `<div>`; add an explicit "Open" button (the existing chevron at `:86-88` is the natural candidate) for the drill-in action.

### S2. Dynamic content changes are never announced — WCAG 4.1.3 (Status Messages)
Only the Build workspace `Toast` (`components/build/Toast.tsx:9-10`) is a live region. Missing announcements:
- `components/try/TryItFlow.tsx` — the input → loading → result/error phase swaps replace the whole view silently; the loading checklist (`:301-335`) and its progress are visual-only. Add `role="status"` to the loading stage list and `role="alert"` to `ErrorView`; move focus to the result heading when it renders.
- `components/build/rail/CopilotPanel.tsx:163-194` — loading skeletons, error states, and newly-arrived findings are unannounced. Wrap the results region in `aria-live="polite"` / `role="status"`.
- `app/login/page.tsx:271-281` — auth error `<p>` has no `role="alert"`.
- `components/profile/ProfileForm.tsx:214-221` — `SaveIndicator` ("Saving… / All changes saved / Couldn't save") should be `role="status"`; a failed autosave is currently invisible to screen-reader users.
- `components/dashboard/HouseCard.tsx:213` — "Link copied" feedback is menu-text-only.

### S3. Kebab menu is not a keyboard-complete widget — WCAG 4.1.2, 2.1.1
`components/dashboard/HouseCard.tsx:179-225` — the "House options" trigger lacks `aria-expanded`/`aria-haspopup`; the open menu has **no Escape handling** and no focus management; the only close mechanism besides selecting an item is a click-only backdrop `div` (`:197`), which keyboard users can't operate — they must Tab away leaving the menu open over the card.
**Fix:** add `aria-haspopup="menu"` + `aria-expanded`, close on Escape and on focus-out, return focus to the trigger.

### S4. Tab-style toggles expose no state — WCAG 4.1.2, 1.4.1
- `app/login/page.tsx:130-151` — Log in / Sign up tabs: selected state is background/color only; no `aria-pressed` (and the amber underline pattern used elsewhere is itself below 3:1 non-text contrast).
- `components/build/BuildHousePage.tsx:194-206` — Co-pilot / Team rail tabs: same, color + amber underline only.
- `components/build/BlueprintRail.tsx:89-121` — layer nav buttons: active step conveyed by amber tint only; add `aria-current="step"`. Also add `aria-current="page"` to active nav links in `components/Header.tsx:74` and `components/dashboard/DashboardHeader.tsx` (visual underline only today).
(Counter-examples done right: `ContextBar.tsx:136` uses `aria-pressed`; `EvidenceLayer.tsx:29` too; `AccountTypeSelector` uses `role="radio"`+`aria-checked`.)

### S5. Form errors and instructions not programmatically associated — WCAG 3.3.1, 3.3.2, 1.3.1
- `components/profile/ProfileForm.tsx:120-122` — username errors are adjacent `<p>`s; the input sets `aria-invalid` (good) but nothing links the message. Add `id` + `aria-describedby`.
- `components/profile/DeleteAccountModal.tsx:51-60` — `<label>` "Type DELETE to confirm" has no `htmlFor`; the input's accessible name is only the placeholder `DELETE` (placeholders are not labels).
- `components/dashboard/HouseCard.tsx:246-255` — rename input has placeholder "House title" and no label/aria-label.
- `components/profile/primitives.tsx:33-46` — `FieldLabel` renders visual-only `div`/`p`; helper text ("3-30 characters…") is not linked via `aria-describedby`, so requirements are unavailable at the field.
- `components/try/TryItFlow.tsx:215-217` — character counter not associated with the textarea (`aria-describedby`).

### S6. Target size below 24×24 CSS px — WCAG 2.5.8 (Target Size, Minimum)
- `components/build/Editable.tsx:74-108` — `RemoveButton` is 20×20, and 16×16 at `components/build/layers/PerspectiveDetail.tsx:137,171,208`, adjacent to other controls with no spacing exemption.
- `components/classroom/AssignmentPanel.tsx:229-230, 280-290` — ▲/▼ reorder buttons are ~14×12px (8px font, 1px/4px padding).
**Fix:** give these a 24×24 minimum hit area (padding, not glyph size).

### S7. Hover-only information (title tooltips) — WCAG 1.4.13, keyboard parity
- `components/build/ContextBar.tsx:158-168` — the presence stack (who is in the house) is conveyed exclusively through `title` tooltips on non-focusable `<span>` avatars: invisible to keyboard and touch users, unreliable for screen readers.
- `components/build/ContextBar.tsx:125` — the Learn/Decide explanation ("Student accounts stay in Learn mode.") is title-only on a `div`.
**Fix:** add visually-hidden text or an accessible disclosure for collaborator identity; put mode-lock explanation in visible or SR-visible text.

---

## MODERATE

### M1. No skip link — WCAG 2.4.1 (Bypass Blocks)
`app/layout.tsx:43` — no "skip to main content" link anywhere; the marketing header + SheetStrip repeat on every page and the header is sticky. Add a visually-hidden-until-focused skip link targeting each page's `<main>`.

### M2. FAQ accordion structure — WCAG 1.3.1, 2.4.6
`components/sections/FaqGroupsSection.tsx` — group labels are `<p>` (`:201-213`) and questions are plain `<button>`s (`:130`); the page has no heading hierarchy below the intro h1. Wrap each question button in an `<h3>` and make group labels `<h2>`s; add `aria-controls`/`id` between button and panel. Same pattern: footer column headings are `<p>` (`components/sections/Footer.tsx:104`).

### M3. Severity conveyed by color alone in Co-pilot findings — WCAG 1.4.1
`components/build/rail/CopilotPanel.tsx:230-239` — "important" findings differ only by a 3px amber left border. Add a text badge (e.g. "Important" next to the kind label at `:252`).

### M4. Radiogroup without roving tabindex — WCAG 4.1.2 (pattern conformance)
`components/profile/AccountTypeSelector.tsx:38-47` — `role="radiogroup"`/`role="radio"` with every option in the Tab order and no arrow-key support. Screen-reader users are told it's a radio group and will try arrow keys, which do nothing. Either implement roving tabindex + arrow keys, or drop the radio roles and keep them as toggle buttons with `aria-pressed`.

### M5. Loading/percent bars have no accessible equivalent — WCAG 1.1.1 / 1.3.1
Progress bars in `components/build/BlueprintRail.tsx:53-64`, `components/dashboard/HouseCard.tsx:128-139`, `components/build/ContextBar.tsx:108-120`, `components/build/layers/PerspectivesLayer.tsx:103-105` are bare `div`s. Most have adjacent visible text ("3/7 layers · 43%"), which largely covers 1.1.1 — but the ContextBar strength bar and perspective strength bars pair the number with a color-coded value where color is the only quality cue at a glance; consider `role="progressbar"` + `aria-valuenow` or `<meter>`, and a text qualifier ("weak/strong") next to the score.

### M6. Decorative hero SVG not hidden — WCAG 1.1.1
`components/sections/HeroSection.tsx:32` — the animated hero house `<svg>` has no `role`/`aria-hidden`; SRs may announce stray geometry. Add `aria-hidden="true"` (the good counter-example is `HowBuildFlowSection.tsx:82`, which uses `role="img"` + `aria-label`). Same for the blueprint-grid SVGs and the `InteractiveHouseSection` background rect.

### M7. Admin data tables missing scope — WCAG 1.3.1
`components/admin/AiMonitor.tsx:326-333`, `components/admin/ModelDetail.tsx:277-284` — `<th>` without `scope="col"`, tables without `<caption>`/`aria-label`. Low traffic (admin-only) but a one-line fix.

### M8. `aria-disabled` back button remains in tab order as a no-op — WCAG 2.4.3 (minor confusion)
`components/build/Canvas.tsx:79-87` — Back is `aria-disabled` but rendered at 1.85:1 (`--rule` text) and still focusable; visually and programmatically ambiguous. Use `disabled` for consistency with the rest of the app.

### M9. Inert "Invite people" button — WCAG 4.1.2 / user trust
`components/build/BuildHousePage.tsx:227-232` — a real `<button>` that intentionally does nothing. Either mark `disabled` with explanatory text or remove until wired.

---

## MINOR

- **Dead link destinations:** `/framework`, `/contact`, `/terms`, `/privacy`, `/signup`, `/forgot-password` are linked from `Header.tsx:280-282`, `Footer.tsx:12-29`, `app/login/page.tsx:256`, `components/sections/EducatorHeroSection.tsx:55` but have no routes in `app/` — keyboard/SR users land on a 404 with no warning. (Site-quality issue that disproportionately hits AT users.)
- **Very small text:** 8–10px mono labels are used pervasively (chips, meta lines, e.g. `HouseCard.tsx:163` at 9px, `AccountTypeSelector.tsx:68` at 8px). Not a WCAG failure per se, but combined with the contrast issues above it compounds low-vision barriers; consider a 11–12px floor.
- **Hover-swap colors via JS** (`onMouseEnter` style mutation, e.g. `Header.tsx:86-91`, `Footer.tsx:111-112`) never fire on keyboard focus, so focused links miss the hover affordance — the `:focus-visible` rule from C1 largely covers this; prefer CSS `:hover, :focus-visible` classes over JS.
- **TryItFlow loading/error views drop to no `<h1>`** (`TryItFlow.tsx:279-347, 384-413`) — heading level resets between phases (2.4.6 polish).
- **Reduced motion is handled well** overall (`globals.css:161,185,199,240`; `ScrollReveal.tsx:7`) — no action needed; noted as a strength. Ditto `lang="en"`, per-control `aria-label` coverage in forms, and universally `aria-hidden` icon components.

---

## Highest-impact fixes, in order

1. **Global focus-visible style + remove all `outline: 'none'`** (`globals.css` + ~20 components) — one CSS rule plus a mechanical sweep restores keyboard usability across the entire product (C1).
2. **Focus trap/restore utility applied to the four overlays** (InviteModal, DeleteAccountModal, WhatsNewDrawer, mobile nav) — a single shared hook fixes every modal (C2).
3. **Introduce text-safe amber/warning/green tokens** and swap them in the ~15 flagged locations, starting with `.eyebrow-amber`, `.text-link:hover`, FAQ group labels, status chips, and form-error text (C3).
4. **Interactive house diagram:** `aria-pressed`, per-layer `aria-label`, SVG focus style, `aria-live` on the detail panel (C4).
5. **Announce dynamic state:** `role="status"`/`role="alert"` on TryItFlow phases, Co-pilot panel, login error, and profile SaveIndicator (S2).
6. **Restructure perspective cards** to remove nested interactives inside `role="button"` (S1).
7. **Menu/tab semantics:** `aria-expanded` + Escape on the HouseCard kebab and Header hamburger; `aria-pressed`/`aria-current` on login tabs, rail tabs, BlueprintRail steps, and nav links (S3/S4).
8. **Form association pass:** `aria-describedby` for errors/helpers, `htmlFor` in DeleteAccountModal, label for the rename input (S5).
9. **24px hit areas** for RemoveButton and reorder arrows (S6).
10. **Skip link** in `app/layout.tsx` (M1).

Recommend adding `eslint-plugin-jsx-a11y` and a CI axe-core/pa11y run once fixes land, since no automated a11y tooling currently exists in the repo.
