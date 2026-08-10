# Decision 001 — Founding Architectural & Product Decisions

**Date:** 2026-06-27
**Status:** Decided

## Decisions made

### 1. Primary audience: education-led (teacher→student)
- **Choice:** Educators as primary, individual users as secondary.
- **Alternatives:** Consumer-first, professional/analyst-first.
- **Reasoning:** The product's unique value (AI that guides but refuses to answer)
  is most defensible in education. Viral distribution (teacher → class →
  colleagues) beats consumer CAC. The Trapasso/Paul–Elder lineage is credibility
  educators care about.

### 2. Collab = human + AI co-reasoning (not multi-user)
- **Choice:** "Collab" means the AI Workspace + House Workspace split-view builder
  where a single user reasons with AI assistance.
- **Multi-user:** lives exclusively in classrooms (teacher↔student, peer review).
- **Implication:** public copy says "reason *with* AI"; "work together" language is
  reserved for the For Educators page.

### 3. Draft Full House — removed
- **Choice:** Feature is dead. Remove entirely, not just hidden.
- **Reasoning:** It was a stale Lovable artifact. Contradicted the core philosophy
  ("AI guides, not decides"). Its removal makes the differentiator sharper.

### 4. Guides — replaced by Examples gallery
- **Choice:** "Guides" nav item removed (was an empty placeholder). Replaced by
  an Examples gallery showing curated, real published houses.
- **Reasoning:** proof-by-example is stronger than documentation; matches the
  "show, don't tell" UX principle.

### 5. Visual identity: "Architectural Blueprint × Editorial"
- **Choice:** Systematize the existing brand cues (INTELLECTUAL BLUEPRINT, sheet
  marks, serif + mono + navy/amber/paper) rather than inventing a new look.
- **Anti-vibecoded rules:** no gradient blobs, no glassmorphism, no emoji
  iconography, no default component-library look, no five accent colors. Type does
  the work; one accent color (amber); line and grid over shadow and blur.
- **Full rationale:** `plans/active/pre-login-ux/design-language.md`.

### 6. No-login builder as the front door
- **Choice:** `/try` drops users into the real Collab builder with no account
  required. Work persists to localStorage and imports on signup.
- **Reasoning:** removes signup friction; lets teachers evaluate honestly. The
  conversion event is "save your work → create an account."

### 7. Tech stack: React/Next.js + Supabase
- **Choice:** Next.js for SSR marketing + SPA builder. Supabase for auth, database,
  storage.
- **Configuration:** env vars in `.env` (gitignored); `.env.example` committed.

### 8. Repository structure
- **Choice:** modular knowledge base optimized for Claude Code workflows.
- **Directories:** `context/` (stable knowledge), `decisions/` (this),
  `plans/` (lifecycle), `references/` (raw source), `docs/` (repo docs),
  `assets/` (static).
- **Constitution:** `CLAUDE.md` — read only requested files, never scan, ask
  before expanding scope.

### 9. PDF migration classification
- **Framework PDF** → `references/trapasso/` (the method, not marketing).
- **Homepage, Our Story, FAQ** → `references/marketing/` (public-site copy).
- **Dashboard, Profile, Contact, Collab 01/002/003** → `references/ux/` (app screens).
- **Privacy, Terms** → `references/legal/` (new category, approved by user).
- **favicon.svg** → `assets/branding/`.
- Original migration folder deleted (empty after moves, approved by user).

### 10. Canonical brand name: "Houses of Thought"
- **Choice:** "Houses of Thought" is the product's only name, for the product
  and for Trapasso's model alike.
- **Correction (2026-08-10):** this entry originally read "retire 'House of
  Reason' except as a historical reference to Trapasso's originating
  framework" — i.e. it treated "House of Reason" as a real prior name being
  phased out. It never was one. "House of Reason" does not appear in
  Trapasso's actual material; it was a hallucination introduced by an
  earlier migration tool (Lovable) that made it into this project's own docs
  and was then taken as fact by later sessions, including a Claude session
  that wrote it into pre-login marketing copy, until the product owner
  caught it. If you find "House of Reason" anywhere in this repo, it is
  wrong — correct it, do not cite it as historical fact.
