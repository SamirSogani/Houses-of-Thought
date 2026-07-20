# Operations & Delivery Audit — Houses of Thought

**Date:** 2026-07-16. **Scope:** delivery pipeline, observability, env/config, backup/DR,
dependency health, release safety. Security, performance, and code quality are covered by
existing audits in `audits/` and are not repeated here. Repo: `/Users/samir/code/Houses of Thought`
(~19,092 LOC TS/TSX across `app/`, `lib/`, `components/`; 62 commits on `main`, 2026-06-28 → 2026-07-16).

**Posture in one sentence:** every push to `main` auto-deploys to production with no CI gate,
errors vanish into short-retention Vercel logs with no alerting, the database has no backups
and is migrated by hand-pasting SQL — for a product whose data is other people's classrooms.

---

## CRITICAL

### C1 — No database backups, no restore procedure
- Supabase **free tier has no automated backups** — no daily backups, no PITR (those start
  at Pro, ~$25/mo). A destructive migration paste, a fat-fingered SQL-editor query, RLS
  policy mistake, or project suspension = permanent loss of every house, class, assignment,
  and grade (`submission_feedback`) ever created.
- There is no restore runbook anywhere in `docs/`, `decisions/`, or `supabase/`. Schema is
  recoverable from `supabase/migrations/` (22 files, good discipline); **data is not**.
- For a schools-first product, classroom data loss is close to unrecoverable trust damage —
  a teacher whose semester of student work disappears does not come back.
- **Fix:** nightly `pg_dump` via GitHub Actions (see plan), or Supabase Pro when the first
  real classroom onboards. Either way: write and *test* a restore procedure once.

### C2 — No CI gate: push-to-main is push-to-production
- No `.github/` directory exists. `package.json` scripts are only `preinstall/dev/build/start`
  — **no `lint`, no `typecheck`, no `test` script**. No ESLint config exists at all; no test
  runner exists (already documented in `audits/code-quality-review.md` §7).
- Vercel auto-deploys every push to `main`. The only thing standing between a typo and
  production is Vercel's `next build` failing — type errors that build past, runtime-only
  bugs, and broken flows ship directly to users.
- All 62 commits are on `main`; no branch/PR discipline, so Vercel's preview-deploy
  machinery (free, already available) is entirely unused.
- **Fix:** minimal GitHub Actions gate (typecheck + lint + build) + branch protection +
  PR/preview flow. Full design in `operations-and-delivery-plan.md`.

---

## HIGH

### H1 — Production breakage is invisible: no error tracking, no uptime check, no alerting
- The only third-party instrumentation is `@vercel/analytics` (page views — confirmed: no
  Sentry, no logging SDK, nothing else in `package.json` or imports).
- Server-side errors surface as exactly **9 `console.error` calls** (zero `console.log`/`warn`
  — commendably clean) in 5 files: `lib/ai/router.ts` (3: missing key, daily blackout,
  provider errors), `lib/ai/limits.ts` (2: rate-limit "failing open"), `app/dashboard/page.tsx`
  (2), `app/build/page.tsx` (1), `app/api/ai/mini-house/route.ts` (1). Two of these are
  *client-side* — they land in end users' browser consoles and are never seen by anyone.
- Server logs go to Vercel runtime logs, retained on the Hobby plan for **on the order of an
  hour**. An error that happens overnight is gone before morning.
- The admin AI monitor (`components/admin/AiMonitor.tsx`, `app/api/admin/ai-status/route.ts`)
  is well built but **pull-based and per-serverless-instance** (already flagged as B5 in the
  code-quality review): it only reports when the founder visits `/admin`, and only for the
  instance that answers. It is a dashboard, not alerting.
- There is no `/api/health` endpoint and no external uptime monitor. If Vercel, Supabase, or
  a bad deploy takes the site down, the founder learns from a teacher's email.
- Related availability note: `middleware.ts` calls `supabase.auth.getUser()` on essentially
  every route (perf audit H1) — a Supabase auth outage degrades the *entire site*, including
  marketing pages, and today nothing would report it.
- **Fix (~$0):** Sentry free tier (client+server errors, alert email), a trivial `/api/health`
  route checked by UptimeRobot free (5-min interval), and a tiny structured-log wrapper so the
  9 call sites emit one JSON shape. Details in the plan.

### H2 — Deploy/migrate decoupling: code and schema ship on different clocks
- Migrations are applied by **hand-pasting SQL into the Supabase SQL editor**
  (`supabase/migrations/README.md` says so explicitly). There is no Supabase CLI setup
  (no `supabase/config.toml`), no migration tracking table, no script, no record of which
  files have actually been run against prod.
- Meanwhile code deploys automatically on push. So every schema-coupled change has a manual
  ordering step with a human in the loop and **no guard if the human forgets**: push first →
  prod code queries columns that don't exist; migrate first with a breaking change → old code
  breaks until the push lands. Migration `0020` (a *regression fix* re-applying `0006`) shows
  schema drift has already bitten once.
- Mitigating credit: migrations are written idempotently and the README is a genuine source
  of truth — the discipline exists, only the tooling and sequencing rule are missing.
- **Fix:** adopt `supabase` CLI (`supabase db push` / `migration list`) or at minimum a
  documented "expand → deploy → contract" rule: migrations must be applied *before* the code
  that needs them is pushed, and must be backward-compatible with the running code.

### H3 — Rollback story is half of a story
- Vercel gives instant rollback / redeploy-previous for the app itself — good, and currently
  the *only* safety net. But it rolls back **code only**: an applied migration stays applied,
  and with no backups (C1) a bad migration cannot be undone at all. Rollback ≠ recovery.
- No release tags, no changelog; identifying "the last good commit" means reading
  `git log` under stress.

---

## MEDIUM

### M1 — Environment config drift (repo ↔ .env ↔ Vercel dashboard)
- Keys compared by name only (values not read). `.env` contains **3 keys absent from
  `.env.example`**: `GROQ_API_KEY`, `MISTRAL_MINISTRAL_14B_API_KEY`,
  `MISTRAL_MINISTRAL_3B_API_KEY` — none referenced anywhere in code (the router reads keys
  via its `*_KEY_ENV` indirection, defaulting to the names documented in `.env.example`).
  These look like leftovers from earlier router iterations; prune to avoid confusion about
  which keys production actually needs.
- `.env.example` is otherwise excellent — it documents all used vars including
  `ADMIN_EMAIL_001` and the full optional-override matrix (`*_MODEL`, `*_BASE_URL`,
  `*_KEY_ENV`, `*_CONTEXT`). No used-but-undocumented vars were found (26 distinct
  `process.env.*` reads checked).
- The **Vercel dashboard is a second, unversioned copy** of ~13 required vars with no
  sync check. Failure mode is silent by design: a missing provider key just logs
  `[ai] no API key … skipping` and the router drops that lane — a misconfigured deploy
  quietly runs with fewer failover lanes. Consider a startup assertion (or a line on the
  admin monitor, which already computes `configured` per target) that counts configured
  lanes and screams below a threshold.
- `.gitignore` misses `.env.production` (pattern is `.env.*.local`); add a bare `.env*`
  with `!.env.example`.

### M2 — Dependency hygiene (full detail below): unused `groq-sdk`, caret ranges without a CI lockfile check
- `groq-sdk ^1.3.0` is a **dead dependency** — never imported. All providers (Groq included)
  go through the `openai` SDK against OpenAI-compatible base URLs (`lib/ai/router.ts:55,87-93`);
  `lib/ai/groq.ts` is a re-export shim of `router.ts`. Remove the package.
- All deps use caret ranges and there is no CI running `pnpm install --frozen-lockfile`,
  so nothing continuously proves the lockfile matches the manifest (Vercel does install
  frozen, which masks drift until a local/prod mismatch surfaces). The CI gate in the plan
  closes this for free.

### M3 — AI rate limiting fails open (cost exposure, not security)
- `lib/ai/limits.ts:112,120`: if the Supabase usage counter can't be read/incremented, the
  limiter **fails open** by design. Combined with H1 (nobody watching logs), a Supabase
  degradation means unmetered paid-API usage with no alert. Reasonable UX choice; it just
  needs eyes on it — Sentry capture at those two call sites is the cheap fix.

---

## LOW

### L1 — Corrections to the commission's assumptions (verified against git)
- **`.DS_Store` is NOT committed** (`git ls-files` shows zero; `.gitignore` covers it). A
  `.DS_Store` exists on disk at repo root but is untracked. No action needed.
- **`tsconfig.tsbuildinfo` is NOT committed** — on disk but gitignored. No action needed.
- `openai` manifest says `^6.46.0` with 6.46.0 installed; registry latest is 6.47.0 — trivial.

### L2 — `pnpm-workspace.yaml` in a single-package repo: intentional, keep it
- It contains no `packages:` field — it is used purely as pnpm 10+'s settings file
  (`allowBuilds: sharp`, needed so `pnpm install` doesn't fail on sharp's build script),
  documented in-file and in `decisions/013-standardize-on-pnpm.md`. Correct usage; not a
  stray monorepo artifact.

### L3 — `.claude/launch.json` runs `npm run dev` in a pnpm-standardized repo
- Works (run-scripts don't trigger the pnpm-only preinstall guard) but contradicts decision
  013; change `runtimeExecutable` to `pnpm`.

### L4 — No `engines` field
- `package.json` pins `packageManager: pnpm@11.11.0` (good) but not Node. Add
  `"engines": { "node": ">=22" }` to keep local, CI, and Vercel on the same major.

---

## Dependency health snapshot (2026-07-16)

| Package | Manifest | Installed | Latest | Assessment |
|---|---|---|---|---|
| next | ^16.2.9 | 16.2.10 | 16.2.10 | Current. Well-staffed (Vercel). |
| react / react-dom | ^19.0.0 | 19.2.7 | 19.2.7 | Current. |
| zod | ^4.4.3 | 4.4.3 | 4.4.3 | Current. (Perf audit flags its bundle cost on `/try`.) |
| openai | ^6.46.0 | 6.46.0 | 6.47.0 | 1 patch behind. Load-bearing for *all* AI providers. |
| groq-sdk | ^1.3.0 | 1.3.0 | 1.3.0 | **Unused — remove** (M2). |
| @supabase/ssr | ^0.12.0 | 0.12.x | 0.12.3 | Current line; pre-1.0, so minor bumps can break — watch release notes. |
| @supabase/supabase-js | ^2.108.2 | 2.108.x | 2.110.7 | Slightly behind, same major. |
| @vercel/analytics | ^2.0.1 | 2.0.1 | 2.0.1 | Current. |
| typescript | ^5.7.0 | 5.9.3 | **7.0.2** | Two majors behind latest, deliberately fine: 5.9 is stable and supported; TS 7 (native compiler) is a separate migration to schedule, not urgent. Caret keeps you inside 5.x. |
| @types/node | ^22.0.0 | 22.x | 26.x | Correct to pin to your Node major, not latest. |

No deprecated packages; no single-maintainer risk (all vendors are Vercel, Supabase, OpenAI,
Groq, Colinhacks/zod — healthy). All licenses MIT/Apache-2.0. Overall: an unusually *fresh and
small* dependency tree (9 runtime deps) — the risk is process (M2), not the packages.
