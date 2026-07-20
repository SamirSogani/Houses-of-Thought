# Full Site Audit — 2026-07-19

An eight-domain audit sweep of Houses of Thought, run as parallel read-only
subagents. This README is the **execution guide**: a new Claude session should
start here, then work the domain reports in the priority order below.

> **Nothing in this run modified any files.** These are findings only. Treat
> each fix as a scoped task requiring the usual care (read the target, preserve
> behavior, confirm ambiguous scope) per the repo constitution in `CLAUDE.md`.

## What's in this folder

| File | Domain | Model |
|---|---|---|
| [01-ai-slop.md](01-ai-slop.md) | Fabricated content, feature theater, dead scaffolding | Opus |
| [02-performance-scalability.md](02-performance-scalability.md) | Runtime perf + behavior as load/data grows | Opus |
| [03-ux.md](03-ux.md) | Flows, IA, UI states, CTAs, mobile | Fable |
| [04-accessibility.md](04-accessibility.md) | WCAG 2.2 AA | Fable |
| [05-code-quality.md](05-code-quality.md) | Structure, error handling, types, dead code, tests | Fable |
| [06-security.md](06-security.md) | RLS/authz, auth, injection, headers, minors' PII | Opus |
| [07-seo.md](07-seo.md) | Metadata, indexing, structured data, rendering | Fable |
| [08-aeo.md](08-aeo.md) | Answer-engine extractability & citation-worthiness | Fable |

There is also an **earlier audit run (2026-07-15)** in the parent `audits/`
folder (accessibility, code-quality, content-consistency, performance, ux).
That run is preserved, not superseded — its `content-consistency-review.md` in
particular covers the `legal/` docs and age/consent copy in depth and is not
duplicated here.

## Important context corrections surfaced this run

- **`legal/TERMS_OF_SERVICE.md` and `legal/PRIVACY_POLICY.md` exist** as markdown
  but are **not wired to `/terms` or `/privacy` routes**. Several findings across
  domains say those pages "don't exist" — precisely, the *content* exists and
  needs routing (plus the placeholder cleanup the 2026-07-15 content review
  details). Wiring two routes resolves a large share of the recurring dead-link
  findings.
- **`'use client'` marketing pages are still server-rendered to HTML** in the App
  Router. The SEO and AEO auditors verified real text is in the initial payload,
  so `/try` and `/examples` are **not** empty shells for crawlers. Their real cost
  is metadata lock-out and bundle weight, not invisibility.
- **The migrations are reconstructed, not dumped from the live DB**
  (`supabase/migrations/0001_profiles.sql` says so). Every RLS finding assumes
  the files match production — **diff against the live schema before trusting
  any authz conclusion.**

## The cross-cutting picture

The engineering fundamentals are strong (clean types, real injection/SSRF/secrets
defenses, careful AI plumbing, honest architecture docs). The damage is a thin
layer of **unfinished or dishonest surface material** that undermines the
product's central promise and blocks growth. The same issues surfaced
independently across many lenses — the clearest signal of where to start.

| Recurring issue | Flagged by |
|---|---|
| **Fabricated citations** shipped as the product's "proof" | ai-slop, aeo |
| **Dead routes** (`/framework`, `/terms`, `/privacy`, `/contact`, `/signup`, `/forgot-password`) | ai-slop, ux, accessibility, security, seo, aeo |
| **Fake collaboration / publish / export toasts** for no-ops | ai-slop, ux, code-quality, accessibility |
| **`account_type` self-escalation** (student → teacher) | code-quality (B4), security (C1 — confirmed exploitable via one API call) |
| **Delete-then-reinsert autosave** that can lose data | performance (H3), code-quality (B1/B2) |
| **Bypassable + fail-open anonymous AI rate limit** | performance (H1), security (H2) |
| **Middleware auth round-trip on every request** | performance, code-quality, seo, aeo |
| **No `:focus-visible` / tiny touch targets / hover-only info** | ux, accessibility |

## Execution order (by leverage)

Work these clusters top-down. Each links to the specific findings.

### Cluster 1 — Trust & honesty (cheapest, highest brand risk)
The product currently demonstrates the exact behaviors it exists to prevent.
- Replace or explicitly label the fabricated citations — ai-slop §1, aeo C1.
- Remove fake collaborators + no-op success toasts (invite/publish/export/copy) — ai-slop §2–3, ux C3, code-quality B10.
- Retarget dead conversion links; wire `/terms` + `/privacy` from existing `legal/` docs; add `not-found.tsx` — ux C1–C2, seo #4.
- Fix the FAQ's nonexistent local-work carryover promise — ai-slop §4, ux M3.

### Cluster 2 — Access control (security-critical; minors' data)
- Block client-controlled `account_type` writes — security C1.
- Gate `classes_insert` on a DB-level `is_teacher()` check — security H1.
- Add an IP ceiling to the anonymous AI limiter; reconsider fail-open — security H2, performance H1.
- Add security headers (CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy) — security H3.
- Apply the student Learn-mode clamp across all AI routes, not just `/suggest` — security M2.

### Cluster 3 — Data integrity
- One transactional `save_house` RPC + error surfacing fixes the whole autosave cluster — performance H3, code-quality B1/B2. Also fixes B3 (lazy-thenable flush) and B9 (blank-over-existing feedback).

### Cluster 4 — Discoverability (cheap, compounding; do SEO/AEO overlap once)
- `robots.ts`, `sitemap.ts`, favicon into `app/`, `metadataBase` + per-page metadata, canonical — seo #1–3, aeo C2–C3.
- FAQPage + Organization JSON-LD from the existing data arrays — seo #9, aeo H2.
- Flip `data-reveal` to progressive enhancement — seo #7, aeo M1.
- `llms.txt` + a `/framework` definitional hub — aeo C2, H1.

### Cluster 5 — Foundations the codebase was built for but lacks
- Add a test harness (vitest) against the pure core: reducer, strength, serializer, persistence mappers, router failover (`__resetRouterState()` hook already exists) — code-quality.
- Install ESLint + Prettier + lint/typecheck scripts (disable comments already assume it) — code-quality.
- Global `:focus-visible` rule + shared focus-trap hook + text-safe color tokens — accessibility C1–C3.
- Delete dead code (`TeamPanel.tsx`, `suggestions.ts` + `ACCEPT_SUGGESTION` plumbing) — code-quality, ai-slop §9.

## How a new session should use this

1. Read this README, then the relevant domain file(s) for the cluster you're
   assigned.
2. Re-verify before fixing — findings reflect the repo at 2026-07-19 and the
   reconstructed-migrations caveat above. Confirm each file:line still matches.
3. Keep fixes scoped to one cluster/PR; don't fold unrelated cleanups in.
4. Many items are one-line or deletion fixes; a few (transactional save RPC,
   responsive build workspace, `/framework` hub) are small projects — call those
   out before starting.
