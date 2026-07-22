# Remediation Log — 2026-07-19 Audit

Full record of the remediation pass completed **2026-07-20**. The findings live
in the domain reports in this folder; this file records what was actually
changed, commit by commit, and what a deploy needs.

Gate status at completion: `tsc --noEmit` clean, `eslint` 0 errors, 64 tests
passing, `next build` green.

## Deploy checklist

1. **Apply migrations `0026` and `0027` before the code goes live** — both are
   expand-then-deploy. `0025` is a pure perf index and order-independent.
   - Status on production: **applied 2026-07-20** (`0024` was already present;
     `0025`/`0026`/`0027` applied together in one transaction).
2. **Deploy the code.** The app calls `reconcile_signup_role()` at signup and
   `save_house()` on every autosave; both now exist in the DB.
3. **Replace the interim `/contact` address** (`app/contact/page.tsx` uses the
   founder's personal Gmail; both legal docs route deletion requests there).
4. **Set `NEXT_PUBLIC_SITE_URL`** once a custom domain exists — until then
   `lib/site.ts` falls back to Vercel's injected production URL.

## Commits (oldest first)

| Commit | What |
|---|---|
| `f32bb6f` | Rename `middleware.ts` → `proxy.ts` (Next 16 convention). Mechanical. |
| `2f3e1ac` | Add the eight 2026-07-19 audit reports. |
| `23dec2f` | **Fabricated citations replaced with verified sources** (C1 / ai-slop §1). |
| `1c49db6` | **Remove fake collaboration & no-op success theater** (C3 / ai-slop §2–3). |
| `c63ba42` | **Honest-copy pass** across marketing/FAQ (ai-slop §4–8, content C3–C5/H1–H5). |
| `0ebd697` | **Ship `/terms`, `/privacy`, `/contact`, `/framework`, `not-found`; retarget dead CTAs** (ux C1–C2, seo #4). |
| `4d21a07` | **Role-integrity migration `0026` + security headers + AI clamp** (C1/H1/H3/M2). |
| `92b2374` | **Transactional `save_house` RPC, migration `0027`** (H3 / code-quality B2, B9). |
| `8b26518` | **SEO/AEO plumbing**: robots, sitemap, llms.txt, icon, OG, metadata, JSON-LD (seo/aeo). |
| `dd8d80a` | **Accessibility**: focus-visible, contrast tokens, focus traps, skip link, ARIA (a11y C1–C4, S2–S7, M1). |
| `5f8e5ce` | **Remaining bug fixes + dead-code deletion** (ai-slop §8–9, ux H4/M5/M6). |
| `9bd1513` | Keep the blueprint rail consistent with the not-scored state. |
| `1b8d82e` | Update the audit README + route inventory. |

## Cluster 1 — Trust & honesty

- **Citations**: every invented statistic/source in the demo house, the
  How-it-works exhibits, and the public examples is now either a real,
  web-verified citation with a working URL, or explicitly labeled
  `"Illustrative demo evidence, not a citation"`. Example pages render source
  chips as real links (`safeHttpUrl`-gated).
- **Theater removed**: fake collaborators (Maya/Devan) off the presence stack;
  invite modal, `SEND_INVITE`/`COPY_LINK` toasts, `PUBLISH`/`EXPORT`, the Team
  tab, and the "What's new" drawer all deleted. State/actions removed:
  `rightTab`/`SET_TAB`, invite/notes fields+actions, `PUBLISH`, `EXPORT`,
  `CYCLE_OWNER`. Builder AppBar logo links to `/dashboard`; dashboard Share
  (bounced-link) removed.
- **Copy**: local-work-carryover promise, AI uncertainty-flagging claim, and
  "students land straight in" overclaim rewritten; age floor unified at 13;
  data claim softened to the privacy policy's verified language; "COPPA/FERPA
  review pending" placeholder replaced.
- **Routes**: `/terms` + `/privacy` render `legal/*.md` through
  `components/legal/LegalArticle` (single source of truth; counsel TODO
  comments stripped, safe placeholders resolved). `/contact` is direct-email,
  no fake form. `/framework` is the definitional hub with `DefinedTermSet`
  JSON-LD. Branded `not-found`. Educator CTAs → `/login?mode=signup&role=…`,
  and the login page preselects Teacher from `role` + shows a "check your
  email" state when confirmation is on (B8).

## Cluster 2 — Access control (migration `0026`)

- `account_type` is **immutable after signup**: the `profiles` UPDATE policy
  gains a `WITH CHECK` pinning the column via `current_account_type()`. The
  self-service role switcher is gone from `/profile` (now read-only). This is a
  deliberate product change — it was the only way to close the student→teacher
  escalation (C1, confirmed exploitable in one PATCH).
- `classes_insert` additionally requires `public.is_teacher()` (H1).
- `reconcile_signup_role()` replaces the client's post-signup `account_type`
  write: promotes only a just-created account still on the trigger's `standard`
  fallback, only within 10 minutes — fixes the GoTrue metadata-timing gap
  without opening an escalation path.
- Security headers (CSP/HSTS/X-Frame-Options/nosniff/Referrer-Policy/
  Permissions-Policy) in `next.config.ts`; `unsafe-eval` dev-only.
- Student posture clamp applied to `/api/ai/critique` (M2).
- Also fixed B3: the profile unmount flush was a lazy-thenable that never fired.

## Cluster 3 — Data integrity (migration `0027`)

- `save_house(uuid, timestamptz, jsonb)` does the whole-house replace in one
  transaction / one round trip, replacing up to nine sequential client
  statements that could leave a layer permanently empty on partial failure.
  `SECURITY INVOKER`, so existing owner-only RLS still governs the write.
  Optimistic-concurrency token preserved (`stale-write`).
- B9: `SubmissionFeedback` now tracks its read error and blocks saving, instead
  of upserting blanks over feedback that failed to load.

## Cluster 4 — SEO/AEO

- `app/robots.ts`, `app/sitemap.ts`, `app/llms.txt/route.ts`, `app/icon.svg`,
  `app/opengraph-image.tsx`, `app/not-found.tsx`.
- `lib/site.ts` centralizes site identity + domain resolution;
  `metadataBase` + title template + `pageMetadata()` give every marketing page a
  unique title/description/canonical/OG. `generateMetadata` on
  `/examples/[slug]`. `noindex` layouts on the app/auth routes.
- Structured data: Organization + WebSite + founder Person (layout), FAQPage
  (from the shared `lib/faq/data.ts` array), BreadcrumbList (examples),
  DefinedTermSet (framework).
- `data-reveal` is now progressive enhancement (visible without JS). `/examples`
  is a server component again with only the filter as a client child.

## Cluster 5 — Accessibility & remaining bugs

- One global `:focus-visible` rule restores keyboard focus across the ~19
  components that set `outline: none` (verified in-browser). Text-safe
  `--amber-text`/`--warning-text`/`--green-text` tokens (computed AA ratios)
  swapped into every text usage; `strengthColor`/`color` darkened at source.
- Shared `useFocusTrap` on the three overlays; skip link → `#main`; ARIA state
  on the kebab menu, login tabs, blueprint rail, nav; live regions on auth
  error / save indicator; form label associations; 24px hit areas; interactive
  house diagram `aria-pressed`/`aria-label`/`aria-live`.
- House Strength Evidence axis now credits **sourced** evidence fully and
  unsourced half (was counting all rows); empty houses read "not scored yet"
  instead of a red 0; joining a class lands on `/classes` with a confirmation;
  removed the nonexistent onboarding-tour control and dead exports
  (`initialProfile` et al).

## Deliberately deferred (still open)

- Perf H2/H4 (AI failover deadline budget, per-instance router state), M1–M6.
- Code-quality: shared AI-route handler, `router.ts` 836-LOC split, zod at the
  Supabase row boundary, the `@/lib/ai/groq` shim migration.
- UX H1 (full responsive rework of the build workspace — a mobile drawer exists
  from earlier work, but not the full pass).
- AEO M4 (permalinked Mini Houses).
