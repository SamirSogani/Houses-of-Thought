# UX Review — Houses of Thought

**Auditor:** ux-reviewer (general-purpose subagent, model: fable)
**Scope reviewed:** all routes under `/app` (landing, /try, /login, /welcome, /dashboard, /build, /build/[id], /house, /classes, /classroom, /join/[code], /profile, /examples, /how-it-works, /educators, /faq, /story), all components under `/components`, state/persistence logic under `/lib/build`, `middleware.ts`, and `app/globals.css`.

**Product shape:** Next.js app. Funnel is Landing → `/try` (no-account Mini House) → signup CTA → `/dashboard` → Build workspace (7-layer "house" builder with AI co-pilot), plus teacher/student classroom flows.

---

## 1. Critical findings

### 1.1 Primary CTAs and footer links point at routes that do not exist
- **Severity: Critical**
- **Where:**
  - `components/sections/FinalCtaSection.tsx:39` → `/signup` (no such route; signup lives at `/login?mode=signup`)
  - `components/sections/EducatorHeroSection.tsx:55` and `app/educators/page.tsx:30` → `/signup?role=educator` — this is the **primary CTA of the entire educators page** ("Create a classroom")
  - `app/login/page.tsx:256` → `/forgot-password` (no route; no password reset exists)
  - `components/dashboard/DashboardHeader.tsx:84` → `/framework` — dead link in the **center slot of the authenticated header** on dashboard, profile, classes, and classroom pages
  - `components/sections/Footer.tsx` → `/framework`, `/terms`, `/privacy`, `/contact` (footer renders on nearly every page, including the authenticated dashboard)
  - `components/Header.tsx:280-282` (mobile menu) → `/framework`, `/contact`
  - `app/how-it-works/page.tsx:30`, `app/story/page.tsx:24` → `/framework`; `app/educators/page.tsx:32` → `/contact`; `components/sections/EducatorTrustSection.tsx:64-65` → `/privacy`, `/terms`
  - `components/sections/HowBuildFlowSection.tsx:151` — copy literally says "Full model at /framework"
- **Friction:** A motivated educator clicking the page's only primary CTA 404s. A user who forgets their password hits a dead end with no recovery path. The trust section links to Privacy/Terms that don't exist while the product collects emails, passwords, and student data. There is also no custom `app/not-found.tsx`, so all of these land on the default Next.js 404.
- **Recommendation:** Triage every `href` in the repo. Point `/signup*` at `/login?mode=signup` (and make `?role=educator` preselect the Teacher account type — the selector already exists). Ship minimal `/terms`, `/privacy`, `/contact`, `/framework` pages or remove the links. Add a password-reset flow or remove the link. Add a branded not-found page that routes people back to `/try` or `/dashboard`.

### 1.2 Fake success states: Publish, Export, Invite, and Copy link do nothing
- **Severity: Critical**
- **Where:** `lib/build/state.ts:376-398` — `SEND_INVITE` returns toast "Invite sent to {name}", `COPY_LINK` returns "Invite link copied" **without writing anything to the clipboard**, `PUBLISH` returns "House published · strength N", `EXPORT` returns "Exported as PDF". Surfaced by `components/build/InviteModal.tsx`, `components/build/ContextBar.tsx` (Publish button), `components/build/Canvas.tsx:75` (final step's primary button is "Publish house"), and `components/build/layers/ReviewLayer.tsx` (Publish + Export panel).
- **Friction:** These are confirmed-success lies. A user "invites" a colleague who never receives anything; "copies" a link that isn't on their clipboard; "publishes" and "exports as PDF" with nothing produced. The final step of the entire build flow (step 7's primary CTA) terminates in a no-op toast. This is the single fastest way to destroy trust in a product about *defensible reasoning*.
- **Recommendation:** Until these features exist: remove Publish/Export/Invite from the authenticated build surface, or replace with honest states ("Coming soon" disabled affordances, or at minimum make Copy link actually copy the `/build/[id]` URL via `navigator.clipboard`). Change step 7's footer CTA from "Publish house" to something real ("Back to dashboard" / "Mark complete").

### 1.3 Fake collaborators and fabricated presence in every real house
- **Severity: Critical**
- **Where:** `lib/build/people.ts` (Maya R. "Teacher", Devan K. "Co-builder" + seeded presence "In Evidence"/"In Perspectives" + a fabricated activity feed), rendered by `components/build/ContextBar.tsx:158-169` (avatar stack shows You + Maya + Devan + AI on **every** house, including a brand-new empty one) and reachable via `CYCLE_OWNER` (`lib/build/state.ts:238`), which lets a real user assign their perspective to "Maya R." with the toast "Maya R. now owns Students". The Team tab's "Invite people" button is intentionally inert (`components/build/BuildHousePage.tsx:221-235`).
- **Friction:** A new user sees three collaborators present in their private house. Students in a classroom context may believe a teacher is watching in real time. Ownership can be handed to people who don't exist, and that fake attribution is persisted to the database (`owner_key` in `saveHouse`).
- **Recommendation:** Strip demo personas from real (`/build/[id]`) houses: show only You (+ Co-pilot). Keep the seeded cast only in the demo `initialState` if a demo route ever uses it. Disable owner cycling until real collaborators exist, and remove or clearly label the inert Team tab.

### 1.4 The post-auth welcome page ships placeholder copy
- **Severity: Critical (it is user-visible shipped scaffolding)**
- **Where:** `app/welcome/page.tsx:17` — the eyebrow literally renders the word "Placeholder". Copy says "Your Collab workspace is ready" (terminology used nowhere else user-facing), and the CTA "Continue to your house" links to `/build`, which silently creates *another* new house row (see 2.3).
- **Recommendation:** Either finish this page (real eyebrow, "Houses" terminology, CTA to `/dashboard` or into the house created from their Mini House question) or delete the route until it's ready.

---

## 2. Core flows and path-to-value

### 2.1 The try→signup conversion promise is broken: the user's question is thrown away
- **Severity: High**
- **Where:** `components/try/MiniHouseResult.tsx:294` builds `/login?mode=signup&q=<question>`, but nothing in the codebase ever reads `q` (`app/login/page.tsx` only reads `mode` and `next`). After signup the user lands on an **empty dashboard**.
- **Friction:** The moment of maximum motivation — "I just got a Mini House on *my* question, I want the full version" — ends on a blank grid with a dashed "Create New House" tile. The user must re-type their question from memory into an unfamiliar 7-layer workspace. This is the most costly drop-off point in the funnel.
- **Recommendation:** On signup with `q`, create the first house pre-seeded with that question (title + Frame layer question field) and land the user directly in `/build/[id]` at step 1. This one change connects the aha-moment to the first real action.

### 2.2 First-run dashboard has no designed empty state
- **Severity: High**
- **Where:** `app/dashboard/page.tsx:175-195` — zero houses renders just the `CreateHouseCard` dashed tile; heading copy is generic ("Build and explore your Houses of Thought").
- **Friction:** No guidance on what a House is, what the 7 layers are, how long it takes, or any link to `/examples` as proof. Loading state is a bare full-screen mono line ("LOADING YOUR HOUSES…") — consistent across pages but skeleton-free, so the grid pops in.
- **Recommendation:** Design a first-run state: one-line value restatement, a "Start from your Mini House question" prompt when available, a link to an example house, and a skeleton grid while loading.

### 2.3 Houses are created eagerly, producing "Untitled House" clutter
- **Severity: High**
- **Where:** `app/dashboard/page.tsx:86-89` (insert on click, before any input), `app/build/page.tsx:22-33` (visiting bare `/build` — linked from the header "Collab" item and `/welcome` — inserts a row **on page load**).
- **Friction:** Every click on "Collab", every stray visit to `/build`, every abandoned create becomes a permanent "Untitled House / *No question set yet* / 0/7 layers · 0% / Empty" card. `deriveStatus` even has an `empty` status — the system knows these are junk. The dashboard the task is meant to celebrate progress fills with debris that the user must kebab→Delete→Confirm one at a time.
- **Recommendation:** Create the row lazily on first meaningful edit (title or question), or open a lightweight "What's your question?" dialog before insert (this doubles as the framing step). At minimum: auto-delete or auto-coalesce `empty` houses (reuse an existing empty house instead of inserting a new one), and consider bulk-clearing empties.

### 2.4 The orphaned `/house` no-login builder and a mismatched promise
- **Severity: Medium**
- **Where:** `app/house/page.tsx` is a full local-storage builder with **zero inbound links** anywhere in the app. Meanwhile `app/examples/page.tsx:103` promises "No sign-up needed to try it. Your work saves locally until you create an account" — but its buttons link to `/try`, where **nothing is saved** (the Mini House result explicitly says "Mini House results aren't saved").
- **Friction:** Dead code path plus copy that describes a feature the linked flow doesn't have. Users who take "saves locally" at face value will lose work.
- **Recommendation:** Either promote `/house` as the real "try the full builder without an account" surface (and wire its localStorage draft into signup import), or delete it and fix the examples-page note.

### 2.5 Join-a-class flow ends without confirmation
- **Severity: Medium**
- **Where:** `app/join/[code]/page.tsx:49` — success silently `router.replace('/dashboard')`.
- **Friction:** A student clicking a teacher's invite link lands on their dashboard with no "You joined Ms. R's class" feedback and no pointer to `/classes`. The error message is one generic string for every failure kind (invalid, expired, already joined).
- **Recommendation:** Redirect to `/classes` with a success confirmation naming the class; differentiate "already a member" (which should read as success) from a genuinely bad code.

---

## 3. Information architecture

### 3.1 "Collab", "Framework", and blueprint jargon in the authenticated nav
- **Severity: High**
- **Where:** `components/dashboard/DashboardHeader.tsx` — nav reads *Framework · Classroom · Collab · Profile · Sign Out*. "Collab" (with a spark icon) is the link that creates/opens the builder; "Framework" is a dead link in the header's center slot. Inside the builder, `components/build/AppBar.tsx:35-53` renders "Framework" and "Collab" as **non-interactive `<span>`s styled like nav items**. The brand line adds "Intellectual Blueprint · Est. 2026"; `SheetStrip` adds "Method · Trapasso / Paul–Elder · Rev. A" with no explanation anywhere reachable.
- **Friction:** The single most important action in the product — build a house — is labeled "Collab", a word used nowhere in marketing (which says "Try it", "Build", "House"). "Framework" looks clickable in the builder and does nothing, and 404s from the dashboard. First-time users cannot map nav labels to intent.
- **Recommendation:** Rename "Collab" → "New House" (or remove it; the dashboard tile suffices). Remove the dead/inert "Framework" items until the page exists. Cut decorative pseudo-nav from the builder AppBar.

### 3.2 The teaching framework's arithmetic never matches the product
- **Severity: Medium**
- **Where:** `components/sections/HowItWorksSection.tsx` ("Three steps from question to defensible answer"), `components/sections/HowBuildFlowSection.tsx` ("Five moves, foundation to roof", with 6 labeled layer rects + roof), builder (`lib/build/content.ts`) has **7 layers** (Frame, Perspectives, Evidence, Assumptions, Conclusion, Implications, Review). The how-it-works diagram labels layers "Concepts / Overarching question / … / Implications(roof)" — a different decomposition than the builder's rail.
- **Friction:** A user who reads the marketing forms a 3- or 5-step mental model, then meets a 7-step rail with different names and different ordering (roof-to-foundation in the rail, foundation-to-roof in marketing). The rich pedagogy (Paul–Elder) is invoked but never explained.
- **Recommendation:** Pick one canonical layer model and name set; make marketing diagrams reuse `lib/build/content.ts` layer names verbatim. "Five moves" can survive as grouping *of* the 7 layers only if the grouping is shown explicitly.

### 3.3 The "What's new" drawer is an internal design-rationale doc
- **Severity: Medium**
- **Where:** `components/build/AppBar.tsx:57-70` (button, title tooltip "What changed vs the old flow") + `lib/build/content.ts:280-306` + `WhatsNewDrawer.tsx` (header literally: "Design rationale / What changed, and why", cards comparing "Old" vs "New" flows).
- **Friction:** No real user has seen the "old flow"; this is a handoff artifact occupying a prominent app-bar slot, and it advertises features that are fake ("Invite co-builders… see live presence").
- **Recommendation:** Remove it from the shipped UI (keep in docs), or repurpose the slot as a genuine "How this works" onboarding panel for first-time builders — which the product currently lacks entirely.

---

## 4. UI states

| # | Finding | Severity | Where | Recommendation |
|---|---|---|---|---|
| 4.1 | Loading states are bare mono text ("LOADING YOUR HOUSES…", "CREATING YOUR HOUSE…") across dashboard, build, profile, classes | Low | `centerNotice` pattern repeated in 5+ pages | Acceptable v1; add skeletons for grid pages; extract the repeated style into one component |
| 4.2 | Mini House flow states are genuinely well designed — staged checklist loading, min-display time, distinct error view with Retry/New question | Positive | `components/try/TryItFlow.tsx` | Use this as the quality bar for the rest of the app |
| 4.3 | Co-pilot panel has skeletons, stale-data hint, rate-limit copy, retry — also good | Positive | `components/build/rail/CopilotPanel.tsx` | — |
| 4.4 | Raw server error strings are surfaced verbatim to users | Medium | `TryItFlow.tsx:83` (`data?.error` shown directly), `app/login/page.tsx:60` (raw Supabase messages like "Invalid login credentials") | Map known errors to human copy; keep raw detail in console |
| 4.5 | House Strength shows a numeric score (with "Weak" label) on a completely empty house, and the Review layer's "strengthen" list always includes a generic third item | Medium | `ContextBar.tsx` strength pill; `ReviewLayer.tsx:37-40` | Show "—" or "Not yet scored" below a content threshold; make strengthen items conditional |
| 4.6 | Destructive actions inside the builder have no confirm/undo: one accidental click on a perspective's × deletes its stance, sub-questions, evidence, and counters; autosave persists the loss 800ms later | High | `Editable.tsx` RemoveButton + `REMOVE_PERSPECTIVE` etc. in `state.ts` | Add an "Undo" action to the toast (the reducer is pure — keeping one previous state snapshot is cheap), or confirm for non-empty items |
| 4.7 | House delete confirm ("Delete" → "Confirm delete" inside the kebab) is a good lightweight pattern | Positive | `HouseCard.tsx:217-222` | — |

---

## 5. CTAs

- **5.1 (High) Three "Publish" affordances, all fake, and always enabled.** ContextBar "Publish" (amber, top-right, visible from step 1 of an empty house), Canvas footer "Publish house" on step 7, and ReviewLayer's "Ready to publish" panel. Two amber primaries (Publish and the layer's Next) compete on most screens. Fix per 1.2; only one primary per view — the step's Next/footer action.
- **5.2 (Medium) Inconsistent labels for the same action:** "Try it free" (header, hero, FAQ, examples) vs "Try it instantly" (`app/story/page.tsx:21`); "Create free account" (Mini House CTA) vs "Sign up" (login tab) vs "Get started" (login eyebrow) vs `/signup` links labeled variously. Standardize on "Try it free" and "Create free account".
- **5.3 (Medium) The Mini House comparison card oversells.** `MiniHouseResult.tsx:352-360` promises "Logic Strength Meter + Reasoning Stress Tests", "All your Houses saved, versioned, and shareable". Versioning doesn't exist; sharing is fake (1.2). Users who convert on these bullets will notice. Trim to what's real.
- **5.4 (Low) HouseCard "Share (copy link)"** copies a `/build/[id]` URL that only the owner (or their teacher) can open — recipients get silently bounced to their own dashboard by RLS. Rename ("Copy link (only you can open)") or gate until sharing exists.
- **5.5 (Low) Login's "or" divider** (`app/login/page.tsx:299-321`) sits between the submit button and the mode-switch text, visually promising an alternative auth method (OAuth) that doesn't exist. Remove the divider.

---

## 6. Copy clarity

- **6.1 (Medium) "Learn | Decide" mode toggle** (`ContextBar.tsx:123-154`): two lowercase mono words with no in-place explanation; the meaning arrives only as a toast *after* switching. Add a two-line tooltip/popover or sublabels ("Asks questions" / "Suggests answers").
- **6.2 (Medium) Blueprint-conceit strings leak into functional UI:** "Sheet 00 / Try it", "Sheet 99 / Footer", "Rev. A", "Draws in 900ms" (hero card), "Est. 2026". Charming on marketing; noise in app chrome. Keep it out of authenticated surfaces.
- **6.3 (Low) Builder microcopy is largely strong** — layer blurbs in `lib/build/content.ts`, Frame placeholders ("Why does this question matter, and who does the reasoning have to hold up to?"), empty lines ("Strong houses name the best objection to each perspective"). Good.
- **6.4 (Low) "House · Draft · autosaved"** (`ContextBar.tsx:57`) claims autosaved statically, even before the first save and in read-only mode. Bind to actual save state ("Saving… / Saved").

---

## 7. Forms

- **7.1 (Medium) Login/signup:** no password visibility toggle; no client-side password guidance beyond the placeholder "Min. 8 characters"; error text is small and low-contrast (13px `--warning`), not associated with a field via `aria-describedby`; no `aria-live` for errors. Signup also silently ignores a possible failure of the follow-up `profiles.update` for account type.
- **7.2 (Low) Account-type selector at signup is good** (radiogroup semantics, clear descriptions), but the choice's consequences ("students are pinned to Learn mode") are not disclosed at selection time — a student who picks wrong discovers a locked toggle later with only a tooltip explaining it. Add one line per card about what it locks.
- **7.3 (Low) Join-code input** (`StudentClasses.tsx`): good (`autoCapitalize`, mono style, Enter-to-submit, disabled state, inline error). Consider `maxLength` and auto-uppercase visual on input.
- **7.4 (Low) Mini House textarea:** good defaults (char counter, Cmd+Enter, example chips that auto-submit). The Cmd+Enter shortcut is undiscoverable — hint it near the counter.

---

## 8. Consistency

- **8.1 (Medium) Two different header systems for signed-in users:** `DashboardHeader` (grid, Framework center, Classroom/Collab/Profile) vs the builder's `AppBar` (different order, fake nav spans, email + Sign out but no way back to the dashboard except the logo — and in the builder the logo is **not a link at all**). A user inside a house has no visible route back to "Your Houses". Add a real "← Your Houses" link in the builder AppBar.
- **8.2 (Low) Terminology drift:** "Co-pilot" vs "AI Sidebar" (Mini House compare list) vs "AI that guides" — pick one name. "Turned in" chip vs "Turn in" menu action is fine; "Collab" vs "Team" tab both refer to collaboration.
- **8.3 (Low) Styling is inline-everything with JS hover handlers;** focus-visible states are never designed (only browser defaults, and inputs replace outline with a border-color change that has weak contrast). One keyboard pass would surface several invisible-focus traps (kebab menu, filter chips, mode toggle).

---

## 9. Mobile / responsive

- **9.1 (High) The Build workspace is desktop-only with no fallback.** `BuildHousePage.tsx` hard-codes a `100vh` three-column flex row: 264px BlueprintRail + fluid canvas + 320px right rail = 584px of fixed chrome; `globals.css` contains **no media queries for any build class**. On a 375px phone the canvas gets negative space; nothing collapses, stacks, or warns. Marketing pages *are* responsive and the mobile header pushes "Try it free" → Mini House (which is responsive) → "Create free account" → dashboard (responsive grid) → tap a house → broken screen. The funnel dead-ends on mobile at the moment of activation.
- **Recommendation:** Short-term: below ~900px, collapse the rails into toggleable drawers (rail → bottom sheet or hamburger; co-pilot → slide-over) or show an honest "Best on a larger screen" interstitial with a link to continue. Long-term: single-column step-by-step mobile layout — the reducer architecture already supports it.
- **9.2 (Medium) Touch targets:** kebab button 28px, RemoveButton 20px (16px in FrameLayer concepts), mode-toggle segments ~24px tall, footer "Finish early" link ~10px font. All below the 44px guideline. Increase hit areas via padding even if glyphs stay small.
- **9.3 (Low) Header breakpoint is 1024px** — tablets get the mobile sheet, fine; but the desktop-only/mobile-only style block is injected per-Header render (harmless duplication, slight consistency smell).
- **9.4 (Low) Mini House result grids** (`mh-cols-3` etc.) have proper breakpoints — content parity on mobile is good in the try flow.

---

## Top changes most likely to improve activation (ordered)

1. **Fix the dead CTA routes** — `/signup`, `/signup?role=educator`, `/forgot-password`, footer legal links, dashboard-header `/framework` (1.1). These are hard stops in the funnel, minutes to hours of work each.
2. **Carry the Mini House question through signup into a pre-seeded first house**, landing in `/build/[id]` step 1 (2.1). This connects the product's aha-moment directly to first meaningful action.
3. **Remove or honestify the fake actions** — Publish, Export, Invite, Copy link, fake collaborators/presence (1.2, 1.3). Trust is the product's entire pitch ("defensible reasoning"); one fake "Invite sent" undoes it.
4. **Stop eager house creation; kill "Untitled House" clutter** (2.3). Create on first edit or ask for the question first — this also fixes the confusing `/welcome` → `/build` path.
5. **Make the builder survivable on mobile** (9.1) — even a drawer-collapse or an honest interstitial beats a silently broken screen for every mobile convert.
6. **Rename "Collab" → "New House" and unify the layer model** across home ("three steps"), how-it-works ("five moves"), and the builder ("7 layers") so the framework users are taught is the framework they meet (3.1, 3.2).
7. **Design the first-run dashboard empty state** with one example house and a "start from your question" prompt (2.2).
8. **Finish or remove `/welcome`** — shipped "Placeholder" copy is the first thing some users see after creating an account (1.4).

**Strengths worth preserving:** the `/try` Mini House flow is the best-designed surface in the product (staged loading, real error states, strong conversion block structure); the co-pilot panel's fetch/stale/rate-limit handling is thoughtful; the accept-into-house AI invariant ("nothing enters the house without your click") is a genuinely good interaction principle and is communicated well in the panel intro.
