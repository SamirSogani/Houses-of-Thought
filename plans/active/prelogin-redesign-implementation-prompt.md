# Implement the Houses of Thought pre-login redesign

You have no prior context on this — everything you need is in this prompt. This is the full output of a separate brainstorming-only session with the product owner (a parent building this product). Nothing has been implemented yet. You are the first session authorized to write code for this.

## Product context

Houses of Thought is a decision-making/decision-helping AI. A user enters a question, and the product reasons through it using **John Trapasso's Houses of Thought model** — a real classroom methodology (Trapasso is a teacher; the product owner's son is his student) derived from the **Paul–Elder framework for critical thinking**. The goal right now: relaunch this as a **free, better alternative to Rationale by Jina AI**, which is shutting down this month. The product is, and will remain, entirely free — there are no paid tiers.

The product already exists and has a working post-login product (dashboard, collaborative "house builder," the AI reasoning pipeline). **This task is exclusively about the pre-login experience** — everything a visitor can reach before creating an account.

## Hard constraints — read before touching anything

1. **Scope is pre-login only.** Do not modify the post-login app, the dashboard, the collab/house builder, or the reasoning pipeline implementation itself (`lib/ai/reasoning/**`, `app/api/**`, etc.). You may **read** files there for reference (see "ground truth" below) but never edit them.
2. **Do not modify the For Educators route** (`app/educators/page.tsx` and any of its dedicated components, e.g. `components/sections/EducatorsSection.tsx`, `components/sections/EducatorHeroSection.tsx`) in any way — content, layout, or logic. It should remain exactly as it is today. The only thing you may touch related to it is its entry in shared nav/footer components, and only to the extent needed to keep it linked and visually consistent with the new nav — not to change what it says or does.
3. **Git branch:** work on `claude/houses-thought-prelogin-redesign-zrrx7r` (this file lives there already). Do not push to any other branch. Do not open a pull request unless the user explicitly asks for one.
4. **Ignore two sibling branches — both are dead ends, already investigated, do not reconcile with either:**
   - `claude/houses-thought-prelogin-redesign-w4407v` — an independent design-doc-only pass (11 docs + a mockup) from a separate session the user described as "horrible." Its claimed layer order/names (sourced from the `/framework` marketing page, not the pipeline code) is **wrong** — this prompt's ground-truth section below, sourced directly from `lib/ai/reasoning/steps.ts`/`standards.ts`, is correct. Do not open this branch's docs or mockup.
   - `claude/prelogin-ui-planning-43t6r1` — a partial, mostly-reverted implementation attempt (touches Hero/framework/site.ts, adds a `RationaleComparisonSection` component, leaves a benign 1-line renumbering diff on `EducatorsSection.tsx`). Explicitly abandoned. Do not inspect or cherry-pick from it.
5. **Follow this repo's `CLAUDE.md`** (it will load automatically) — small focused files, no unrelated refactors, ask before expanding scope, state assumptions explicitly, don't fold suggestions silently into the requested work.
6. **Survey before you build.** Read the actual current pre-login pages/components/design tokens first (see file pointers below) and match existing conventions (styling approach, component patterns, whatever design-token system is already there) rather than inventing a parallel system. This is a redesign of a real app, not a fresh prototype.
7. **First checkpoint — ask the user before writing any code:**
   - There is a `plans/active/pre-login-ux/` folder (`README.md`, `implementation-brief.md`, `components.md`, `page-examples.md`, `page-for-educators.md`, `page-home.md`) that looks like prior planning on this exact task. During design ideation it was deliberately left unread to keep the new design unbiased. **Ask the user whether you should now read and reconcile with it, or ignore it and treat this prompt as the sole spec.** Don't decide this yourself.
   - There are two existing routes that may overlap: `app/how-it-works/page.tsx` and `app/framework/page.tsx`. Investigate both, figure out whether they're duplicative or serve genuinely different purposes, and either reconcile them into the single "How It Works" page described below or ask the user how they should relate if it's unclear.
   - `app/try/page.tsx` and `components/try/MiniHouseResult.tsx` already exist. Investigate what they currently do. This spec calls for something much simpler (see "Try" page below — a static confirmation, no mock output, no AI). If what's already built does more than that (e.g. renders a real mock result), **surface that to the user before stripping it down** — don't silently delete more-developed functionality than expected.

## Ground truth: the real methodology (use this, not marketing fluff)

Source of truth is the code, not docs. Read `lib/ai/reasoning/steps.ts` and `lib/ai/reasoning/standards.ts` directly for full fidelity — a condensed version follows. **Note:** `context/framework/trapasso-model.md` describes a 12-layer version of the model and is a stale/aspirational summary of a PDF — it does **not** match what's actually implemented. Do not use it as a source for copy.

**Seven layers, in order:**

1. **Frame** — pins down the core question, definitions, purpose, and scope
2. **Breadth Scoping** — decides how many distinct perspectives the question deserves (no review panel — see below)
3. **Perspectives** — builds multiple independent stances, each with its own claims, sub-questions, assumptions, evidence, and a real counterargument against itself
4. **Global Assumptions** — assumptions sitting underneath the whole question, not just one stance
5. **Global Evidence** — evidence bearing on the question itself, not one side of it
6. **Conclusions** — the verdict(s) that actually follow from what was vetted
7. **Implications** — what follows if the conclusion is adopted: positive / negative / uncertain, who's affected, on what timeline

**The review mechanic:** six of the seven layers (everything except Breadth Scoping) are gated by a **nine-standard review panel** — nine independent reviewers, each grading exactly one standard, each blind to the others. The nine standards (Paul–Elder's Universal Intellectual Standards): **Clarity, Accuracy, Precision, Relevance, Depth, Breadth, Logic, Significance, Fairness.** Critically, what each standard *means* is redefined per layer (e.g. "depth" at Frame = how many considerations the framing accounts for; "depth" at Perspectives = whether the stance engages its strongest form) — this is real per-layer criteria in `standards.ts`'s `LAYER_STANDARD_CRITERIA`, not a single generic checklist reused six times. A layer that fails a standard loops and redoes the work. Frame, Global Assumptions, Global Evidence, Conclusions, and Implications hard-block the pipeline until they pass; Perspectives instead just drops the one failing stance, since the other stances provide redundancy.

When writing marketing/explainer copy, **paraphrase this in plain language for a general audience** — don't quote the internal reviewer-prompt text verbatim (it references internal field names like `core_question` / `supporting_chain` that mean nothing to a visitor). Pull nuance from the real per-layer criteria in `standards.ts` when writing the interactive "How It Works" panel, but rewrite it in plain English.

## Sitemap

**Visible, linked (header/footer nav):**
- **Home** (`/`) — hero + try-it box
- **How It Works** — the methodology explainer (reconcile with `/framework` per checkpoint above)
- **Examples** — hand-crafted sample runs; likely largely exists already at `app/examples/page.tsx` / `lib/examples/data.ts` — redesign in place rather than rebuilding
- **For Educators** — nav link only, page untouched (see constraints)
- **FAQ** — likely exists already at `app/faq/page.tsx` / `lib/faq/data.ts` — reskin, don't rebuild from scratch
- **Story** — origin narrative (parent + teacher + classroom + free-forever mission). Read the existing `app/story/page.tsx` and `components/sections/StoryIntroSection.tsx` / `StoryChaptersSection.tsx` first — adapt what's there into the new design rather than replacing wholesale, unless its actual content clearly doesn't match an origin-story purpose, in which case ask.
- **Contact**
- **Sign up / Login**
- **Terms / Privacy** — footer only, content unchanged, just re-skinned visually
- **Try** (`/try`) — destination of the Home hero box's submit

**Hidden — reachable only by direct URL or search/LLM discovery. Zero links from Home, How It Works, Examples, FAQ, Story, Contact, nav, or footer:**
- **`/compare`** — general overview, Houses of Thought vs. the field
- **`/compare/rationale`** — Rationale-specific, addresses the shutdown directly
- **`/compare/[competitor-slug]`** — same template, built to extend to more competitors later

**Decision (already made, not open):** `/compare` and its per-competitor pages **may link to each other** (hub → each spoke, each spoke → back to hub) — the "no links" rule is about the visible marketing pages not pointing *into* the compare section, not about the compare pages being unable to reference each other. Without that, the compare family would be an undiscoverable dead end even for the crawlers/direct visitors who do find one page.

`lib/site.ts` likely holds nav/site-metadata constants — check it before adding the new nav structure or the compare routes to `sitemap.xml`.

## Visual design system

**Direction:** a dusk-toned "constellation" system. The seven layers are nodes arranged as a *sequence* (order matters — this is not a scattered node cloud), connected by a path that lights up as reasoning would progress through it.

- Each of the **six review-gated nodes** (everything but Breadth Scoping) has a ring of **nine small marks** around it, one per standard.
- Marks light up **individually**, not all at once, mirroring nine independent reviewer calls resolving one by one.
- A failed standard's mark pulses (don't just show it gray/red and stop — show the node visibly redoing the work) before eventually turning green, visualizing the real loop-and-retry behavior.
- **Breadth Scoping** is visually smaller and has **no ring** — a single pulse instead of nine marks. This isn't just decoration: it's teaching the viewer, without a caption, that this step doesn't go through the panel.
- Palette: deep dusk gradient background; warm light for the nodes and connecting path; a distinct cooler accent color for the standards-marks, so "the system doing the work" reads as visually different from "the system checking its own work."
- **Motion must be diegetic** — every animation represents something real (a door/node opening = progress, a mark lighting = one specific reviewer resolving). No decorative motion that doesn't map to an actual mechanic.
- One consistent transition grammar reused everywhere so the meaning of "pass" vs. "loop-back" is legible without explanation by the second or third time the user sees it.
- Ship a real reduced-motion mode (respect `prefers-reduced-motion`, and ideally an explicit in-app toggle too).

## Page-by-page specs

**Home** — hero headline, the try-it text box front and center (rotating placeholder example questions), then a compressed, non-interactive version of the seven-node diagram as a teaser with a link into How It Works. State the "always free" positioning plainly. Do not name Rationale or any competitor on this page.

**Try (`/try`)** — the hero box's submit lands here. Show a short animated beat (a few seconds — lights sweeping across a few nodes) that communicates "something real is about to happen" without overpromising, then land on a **static confirmation only**: acknowledge the question the user typed, briefly explain in plain language what a full run would actually have done (frame it, build real independent perspectives, stress-test the assumptions and evidence, show what follows), then a CTA to sign up. **No mock/generated output. No email capture field.** This is explicitly a placeholder — the real pipeline gets wired in during a separate session.

**How It Works** — the full seven-node diagram, interactive this time: clicking a node reveals its plain-language job description, and for the six gated nodes, what each of the nine standards actually means at that specific layer (paraphrased from `standards.ts`, not quoted verbatim). This is the deepest methodology content on the site and should credit John Trapasso's model / the Paul–Elder framework it's built on.

**Examples** — 4–6 hand-picked, hand-authored sample questions with a shortened preview of what a full run looks like, each linking to a fuller read-only sample view. No AI dependency — this content can be entirely static/hand-written, now or ever.

**Compare (`/compare`)** — comparison table across: price (free vs. paid), layer count / methodology depth, review rigor (nine independent standards per layer vs. none), transparency (can a user see every layer and every verdict, or is it a black box), source framework (a named, real pedagogical model vs. proprietary), status (actively developed and free forever vs. shutting down). Cover Rationale plus a couple of generic categories (ad-hoc chatbot use for decisions, other paid decision tools) without over-indexing on any single name besides Rationale. Needs its own unique meta title/description, OpenGraph/Twitter card tags, and an entry in `sitemap.xml`; allowed in `robots.txt`; genuinely no incoming links from any visible marketing page.

**Compare/Rationale (`/compare/rationale`)** — leads directly with the shutdown ("Rationale is shutting down — here's where to take your decisions next"), a side-by-side feature table, migration-minded copy (this product's rigor — seven layers, nine independent standards each — may well exceed what Rationale offered), reinforces free-forever. Same SEO requirements as above. Build the page as a reusable template so more competitor pages can be added later without redesigning.

**Sign up / Login / Contact / FAQ / Terms / Privacy** — same visual skin (background ambience, typography, color system) as the rest of the site, but keep motion minimal here — these are utility pages where usability beats spectacle. Terms/Privacy content itself is unchanged, just re-wrapped visually.

**For Educators** — nav link only. Page itself: do not touch (see hard constraints).

## Useful existing files (found via targeted search — verify by reading, don't assume these are exhaustive)

- `lib/site.ts` — likely nav/site-metadata constants
- `lib/examples/data.ts`, `app/examples/page.tsx` — existing Examples content
- `lib/faq/data.ts`, `app/faq/page.tsx` — existing FAQ content
- `components/Header.tsx`, `components/sections/Footer.tsx` — shared nav/footer
- `components/sections/HeroSection.tsx`, `InteractiveHouseSection.tsx` — existing Home hero/diagram, likely a starting point for the new constellation diagram
- `components/sections/StoryIntroSection.tsx`, `StoryChaptersSection.tsx`, `app/story/page.tsx` — existing origin-story content
- `components/sections/EducatorsSection.tsx`, `EducatorHeroSection.tsx`, `app/educators/page.tsx` — do not touch
- `components/try/MiniHouseResult.tsx`, `app/try/page.tsx` — existing Try implementation, investigate per checkpoint above
- `app/how-it-works/page.tsx`, `app/framework/page.tsx` — investigate overlap per checkpoint above
- `app/terms/page.tsx`, `app/privacy/page.tsx`, `app/contact/page.tsx` — utility pages
- `app/layout.tsx`, `app/opengraph-image.tsx` — site-wide shell/metadata
- `audits/2026-07-19/*.md`, `audits/accessibility-audit.md`, `audits/code-quality-review.md`, `audits/content-consistency-review.md`, `audits/performance-audit.md`, `audits/ux-review.md` — recent audits of the current site; read these before designing so you don't reintroduce known issues (there's even an `audits/2026-07-19/01-ai-slop.md` — worth checking what that flags specifically)
- `decisions/001-founding-decisions.md`, `decisions/010-classroom-model.md` — architectural/product decision records that may carry relevant constraints

## Working process

1. Confirm you're on the branch (this file lives there already).
2. Resolve the three first-checkpoint questions with the user before writing code.
3. Read the audits and the existing pre-login files listed above; note the current styling/component conventions.
4. Implement incrementally, one page/section at a time, with clear commits.
5. Verify the app builds and runs cleanly; confirm `app/educators/page.tsx` and its dedicated components are byte-for-byte unchanged (diff should show zero changes there beyond nav wiring elsewhere).
6. Push to `claude/houses-thought-prelogin-redesign-zrrx7r`. Do not open a PR unless asked.
7. Summarize what you built and how to preview it.

If anything in this prompt conflicts with what you find in the actual codebase, or is genuinely ambiguous, ask the user — don't silently guess.
