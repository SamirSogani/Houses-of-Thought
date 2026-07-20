# AI-Slop Audit — Houses of Thought

**Auditor:** ai-slop reviewer (subagent, model: Opus) · read-only · 2026-07-19

Full-repo review (marketing copy, product UI, AI plumbing, data fixtures).
Overall verdict up front: **the prose itself is unusually good** — no
"revolutionary/seamless" filler, no empty rule-of-three padding, prompts and
comments are careful. The slop here is a different genus: **fabricated evidence,
feature theater, and dead links** — exactly the failure modes this product claims
to exist to prevent. That irony is the biggest brand risk.

---

## CRITICAL — actively erodes credibility

### 1. Fabricated statistics and citations shipped as the product's "proof"
The product's core pitch is *"Research Mode cites real sources, so the reasoning rests on facts you can check instead of on hallucination"* (`components/sections/DifferentiatorSection.tsx:14`). Yet the demo house, the /examples gallery, and the marketing pages are salted with invented sources:

- `lib/build/content.ts:127-131` — *"Average effect size of AI tutoring on learning outcomes: d = 0.34 (moderate)." — "Stanford GSE Meta-Analysis (2024)"* — no such publication; the effect size is invented.
- `lib/build/content.ts:159-161` — *"Teacher-supervised AI use correlated with a 19% drop in low-level student errors." — "RAND Education (2024)"* — invented.
- `lib/build/content.ts:183-185` — *"76% of OECD countries now have a national AI-in-schools policy or draft framework." — "OECD Education Digest (2025)"* — there is no "OECD Education Digest"; the 76% is invented. **This exact fake stat is the marquee marketing exhibit**: it appears on the How-it-works page twice, once tagged *"Evidence · sourced"* (`components/sections/HowAiRoleSection.tsx:108`) and once tagged *"via Research Mode"* with a source chip (`components/sections/HowCollaborationSection.tsx:107-111`). The anti-hallucination showcase is itself a hallucination.
- `lib/build/content.ts:207` — *"Global K-12 AI-in-education market projected to reach $32B by 2027." — "HolonIQ Global Education Outlook (2025)"* — invented title and figure.
- `lib/build/content.ts:248-250` — *"Compliance and procurement complexity flagged as a top adoption barrier." — "FTC COPPA Guidance (2025)"* — FTC guidance would never "flag adoption barriers"; a citation mismatched to its claim, the classic hallucination shape.
- `lib/examples/data.ts` (the public /examples "proof to visitors" pages): *"Journal of Sports Economics (2022)"* with fabricated correlations *"(r ≈ 0.2) … (r ≈ 0.45)"* (line 111); *"MLBPA / NFLPA CBA filings (2023)"* "5 to 8 percent" (112); *"Carta equity report (2025)"* "median tenure before the equity cliff is 2.1 years" (157 — also internally incoherent vs. a 1-year cliff); *"Levels.fyi cohort data (2025)"* "30 to 40 percent faster promotion" (158 — Levels.fyi publishes no such cohort study); *"Migration retrospectives survey (2024)"* "20 to 40 percent CI-time regressions" (296 — no such survey exists); *"Nx / Turborepo case studies (2025)"* (297).
- Compounding it: **none of these example evidence items has a `url`**, so the /examples page renders dead source chips (`app/examples/[slug]/page.tsx:341`) while the page header invites visitors to *"check the cited evidence"* (`app/examples/page.tsx`) and the FAQ promises *"every citation links to the original so you can read it yourself"* (`components/sections/FaqGroupsSection.tsx:61`).

**Fix:** replace every invented citation with a real, linkable source (several in the set are real and verifiable — FAO 14.5%, Potvin & Levenberg CACM 2016, 4 Day Week Global 71%/61%, Autonomy/ALDA Iceland — proving it's doable), or visibly label the demo evidence as illustrative ("Sample evidence — not a real citation"). Anything a discerning teacher can Google and fail to find should not ship on an epistemic-rigor product.

### 2. Fake collaborators and fake collaboration in the real, logged-in product
- `lib/build/people.ts:5-13` defines fictional teammates **"Maya R. (Teacher)"** and **"Devan K. (Co-builder)"**, and `components/build/ContextBar.tsx:11,158-169` renders their avatars in the presence stack **on every real, persisted house** (`/build/[id]`), with hover titles like "Maya R. · Teacher".
- The Invite modal is theater: Send dispatches `SEND_INVITE`, whose entire implementation is a toast — `lib/build/state.ts:376-383`: `toast: name ? 'Invite sent to ${name}' : 'Invite sent'`. Nothing is sent.
- "Copy link" never touches the clipboard — `state.ts:385-386` just sets `copied: true, toast: 'Invite link copied'`. (Meanwhile `components/dashboard/HouseCard.tsx:52` copies correctly with `navigator.clipboard` — two provenances for the same task, one real, one fake.)
- The team tab itself admits the truth in a comment: *"Collaboration isn't wired yet, so the Team tab is a single centered invite prompt. The button is intentionally inert"* (`components/build/BuildHousePage.tsx:219-221`) — an "Invite people" button with **no onClick at all** (line 227).
- Marketing sells the unbuilt feature as present tense: *"Invite co-builders, assign perspectives, see live presence"* (`lib/build/content.ts:291`, shown in-app via the What's-new drawer), and the demo house attributes content to Maya/Devan via `owner: 'maya'` seeds.

**Fix:** remove Maya/Devan from `ContextBar`'s presence stack and the invite modal until invites exist; make "Copy link" actually copy; change collaboration copy to future tense or cut it.

### 3. Publish and Export buttons do nothing
`lib/build/state.ts:394-398`:
```ts
case 'PUBLISH': return { ...state, toast: `House published · strength ${...}` }
case 'EXPORT':  return { ...state, toast: 'Exported as PDF' }
```
Both buttons are prominent in the Review layer, under a panel reading *"Publishing shares this house with its current strength"* (`components/build/layers/ReviewLayer.tsx:120-147`), and Publish is also in the ContextBar of every house. No PDF is generated; nothing is shared. Marketing repeats the claim: *"From there you can publish it, export it, or hand it in"* (`components/sections/HowOutcomeSection.tsx`). A user who clicks "Export" and gets a cheerful *"Exported as PDF"* toast with no file has caught the product lying.

**Fix:** remove or disable the buttons ("Coming soon"), or wire them. A false success toast is worse than a missing feature.

### 4. FAQ promises a local-work carryover that does not exist
- `components/sections/FaqGroupsSection.tsx:26`: *"your work saves locally in your browser. When you create an account, that work carries over."*
- `FaqGroupsSection.tsx:99-101`: *"It carries into your new account. Any house you built before signing up comes with you, so creating an account never costs you work."*
- `components/sections/FinalCtaSection.tsx:52-53`: *"Your work is saved locally until you create an account."*

There is **no migration code anywhere**: `LOCAL_HOUSE_KEY` is written/read only by the orphaned `/house` route (grep confirms `loadLocalHouse`/`saveLocalHouse` have no other consumers), signup (`app/login/page.tsx:40-71`) never reads localStorage, and `/build` creates a blank house. Related: `components/try/MiniHouseResult.tsx:294` sends users to `/login?mode=signup&q=<question>` — the `q` param is silently dropped by the login page. And `/house`, the only local-draft surface the FAQ describes, is **linked from nowhere**.

**Fix:** either implement the localStorage→Supabase import on first login, or rewrite the two FAQ answers and the CTA footnote now. This is a concrete, testable promise that fails.

### 5. Dead links throughout nav, footer, and CTAs (7 distinct 404 targets)
No route exists for any of these (app/ contains no framework, terms, privacy, contact, signup, or forgot-password):
- `/signup` — `components/sections/FinalCtaSection.tsx:39` ("Create free account" on the homepage's final CTA).
- `/signup?role=educator` — `components/sections/EducatorHeroSection.tsx:55` and `app/educators/page.tsx:30` ("Create a classroom", the educators page's primary CTA). Meanwhile `MiniHouseResult.tsx:294` correctly uses `/login?mode=signup` — two conventions, one 404s.
- `/framework` — `components/Header.tsx:280` (mobile menu), `components/dashboard/DashboardHeader.tsx:83` (logged-in nav!), Footer.
- `/contact` — `components/Header.tsx:282`, Footer.
- `/terms`, `/privacy` — Footer and `components/sections/EducatorTrustSection.tsx:64-65`, directly under the claim *"We don't sell data or train public models on it"*; FAQ also says *"Our Privacy and Terms cover the full detail"*. **(Note: the content exists at `legal/TERMS_OF_SERVICE.md` and `legal/PRIVACY_POLICY.md` — it just isn't routed.)**
- `/forgot-password` — `app/login/page.tsx:256`. A user who forgets their password hits a 404 at the worst possible moment.

**Fix:** point signup CTAs at `/login?mode=signup`; remove Framework/Contact links until pages exist; wire minimal Terms/Privacy pages from the existing `legal/` docs; either build password reset (Supabase supports it out of the box) or drop the link.

### 6. Shipped placeholders visible to users
- `app/welcome/page.tsx:17` — the eyebrow label literally renders the word **"Placeholder"** above "Account created." (The page is also unreachable — nothing links or redirects to `/welcome` — making it a dead route wearing a placeholder badge.)
- `components/sections/EducatorTrustSection.tsx` — visible on the live educators page: *"COPPA / FERPA review pending. Copy here will be finalized against policy before launch."* Honest, but it sits directly under trust claims aimed at teachers, next to dead Privacy/Terms links. For a schools-first wedge, this is the page that must not look provisional.

---

## HIGH — misleading claims / internal artifacts shipped

### 7. "What's new" drawer is an internal handoff artifact
Every user's builder app bar has a dashed **"What's new"** button titled *"What changed vs the old flow"* (`components/build/AppBar.tsx:57-70`), opening "Design rationale — What changed, and why" cards (`lib/build/content.ts:280-306`) comparing against a prototype no user ever saw: *"Strength was a static 72 pinned to the bottom of the page, tucked under implications."* This is migration documentation for the developer, not product UI. **Fix:** remove the button and `changeCards`.

### 8. House Strength is a count heuristic marketed as analysis
`lib/build/strength.ts:12-23`: Evidence = `evidence.length * 18 + 14`, Logic = `assumptions.length * 7 + implications * 2 + 22`, Coverage = `perspectives.length * 11 + 4`. Note the variable `const withSrc = s.evidence.length` — the name says "with source" but it counts **all** evidence rows, sourced or empty; five blank evidence entries max the Evidence axis. Meanwhile:
- FAQ: *"A score that reads your reasoning across three axes"* (`FaqGroupsSection.tsx:41`).
- `lib/build/content.ts:94`: Evidence axis *"How well each claim is backed by a cited, checkable source"*; Logic: *"Whether assumptions are surfaced and the conclusion follows from them."*
Nothing reads the text, the sources, or the logic. Also FAQ (`FaqGroupsSection.tsx:61`): *"When the AI is unsure, it flags that rather than stating it as fact"* — no such uncertainty-flagging exists in any prompt or schema (`lib/ai/prompts.ts`, `lib/ai/findings.ts`). **Fix:** either soften the copy ("a structural completeness score") or make the heuristic at least check `e.source`/`e.url` before crediting the Evidence axis.

### 9. Dead code carrying more fake content
- `components/build/rail/TeamPanel.tsx` — the **only unused component in the repo** (verified by import sweep), containing fake presence (*"Maya R. — In Evidence"*) and a fabricated activity feed (*"Maya R. added evidence from Stanford GSE. 2m"*, `lib/build/people.ts:23-27`). Delete it and `seededPresence`/`activityFeed`.
- `lib/build/suggestions.ts` — 223 lines self-labeled *"DEPRECATED … do not extend"*, containing more canned fake citations (*"EdWeek Research Center (2025)"*, line 195). Its `ACCEPT_SUGGESTION` reducer case is **never dispatched by any component**, yet the vestigial `accepted` field is still persisted to the DB on every save (`persistence.ts:255`). Delete the bank, the action, and the column write.
- `lib/build/content.ts` unused exports: `conceptRotation` (81), `genericDetail` (258), `emptyEvidenceLine`/`emptyCountersLine` (274-277).
- `lib/profile/data.ts:77-85` — unused `initialProfile` hardcoding the founder's own username `'Samir_sogani'` as the default profile; header comment *"No backend yet; edits live in local component state"* (line 1) is stale and contradicted by the DB mapping functions in the same file.
- `package.json:16` — `groq-sdk` dependency is imported nowhere (the router uses the `openai` SDK for all providers, Groq included).
- `lib/ai/router.ts:828-836` — `__resetRouterState()` is a *"test-only hook"* in a repo with **no test files and no test runner** in package.json.

### 10. Builder navigation dead-ends and inert chrome
`components/build/AppBar.tsx:35-53`: "Framework" and "Collab" are non-interactive `<span>`s styled to look like nav tabs; "Profile" (line 72) is plain text, not a link to the existing `/profile`; the logo isn't a link, so there is **no way back to /dashboard** from inside the builder except the browser back button. Cosmetic-looking, but functionally it reads as unfinished scaffolding to any user who clicks.

---

## MODERATE — consistency and provenance

11. **Inconsistent product vocabulary (mixed generation sessions):** *"Logic Strength & Stress Test"* (`components/sections/EducatorDifferenceSection.tsx:6`) vs. "House Strength" everywhere else; the unexplained brand-noun **"Collab"** (*"Collab means you reason with the AI"* `DifferentiatorSection.tsx:4`; *"Your Collab workspace is ready"* `welcome/page.tsx:43`; the inert "Collab" tab in AppBar) never defined on any page a user reads first.
12. **Near-duplicate components:** `FinalCtaSection.tsx` is a hardcoded copy of the parameterized `CTASection.tsx` used by five other pages — and it's the copy holding the dead `/signup` link. `docs/repository/file-structure.md` even instructs *"reuse CTASection … rather than writing a new one."* Similarly, the mock class roster is duplicated with drift between `EducatorsSection.tsx:3-7` and `EducatorHeroSection.tsx:4-9`.
13. **Stale docs:** `docs/repository/file-structure.md` "Current routes" omits `/try`, `/examples`, `/dashboard`, `/build`, `/classroom` etc., and still describes `/welcome` as the post-auth landing (nothing routes there). `lib/examples/data.ts:48` authors a `questions` count on every seed perspective that a comment admits *"is ignored."*

---

## MINOR / COSMETIC

14. `components/sections/Footer.tsx:141` — *"© 2026 Houses of Thought · Intellectual Blueprint · Est. 2026"*: "Est. 2026" on a 2026 site plus the decorative "Intellectual Blueprint" tag is the one line of pure filler on the site.
15. `components/sections/StoryChaptersSection.tsx` — the pull-quote *"Not a lack of intelligence. Not a lack of information. A lack of structure."* restates the immediately preceding sentence (*"It wasn't intelligence they were short on, and it wasn't information. It was structure."*) — the same idea twice in ~40 words, the classic anaphora tic.
16. `app/login/page.tsx:107` — `'Log in to your\nhouse.'`: the `\n` in a JSX string renders as a space (no `white-space: pre-line`), so the intended line break never happens.
17. Hero tagline *"Build the reasoning, not just the answer"* + OriginQuote *"Not another AI wrapper. A real method"* — two instances of the "not X, but Y" pattern on one homepage; fine individually, noticeable together.
18. Stale comment: `components/build/rail/CopilotPanel.tsx:4` says "powered by POST /api/ai/suggest (Groq)" — it's multi-provider now.

---

## What's genuinely good (for calibration)
`lib/ai/router.ts`, `limits.ts`, `brave.ts`, `prompts.ts`, `findings.ts`, `capabilities.ts`, and the API routes are careful, well-commented, and honest (e.g., the router even documents that a spec'd OpenRouter model id "is not a real model id (it 400s)" and corrects it). The Research Mode invariant — evidence only from Brave results in the same request, URLs copied exactly — is real and enforced server-side. The marketing prose is concrete and voice-consistent. The problem isn't writing quality; it's that **the shipped product currently demonstrates the exact behaviors (invented citations, confident claims with nothing underneath) it was built to eliminate**. Fixing items 1–6 would close that gap.
