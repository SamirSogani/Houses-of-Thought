# Operations & Delivery Plan — Week One / Month One

Companion to [operations-and-delivery.md](operations-and-delivery.md). Sized for a solo
founder with no revenue until ~2028: everything below totals **$0/month** until the first
real classroom onboards (one deliberate $25/mo decision at that point).

Effort: **S** ≤ 1 hour · **M** = half a day · **L** = 1–2 days.

---

## Day one (the quick wins — ~2 hours total)

| # | Action | Effort | $ |
|---|---|---|---|
| 1 | Add `"typecheck": "tsc --noEmit"` and `"lint": "eslint ."` scripts; `pnpm add -D eslint eslint-config-next` with a flat `eslint.config.mjs` (Next 16 dropped `next lint` — use the ESLint CLI directly) | S | 0 |
| 2 | `pnpm remove groq-sdk` (never imported; router uses the `openai` SDK for every provider) | S | 0 |
| 3 | Take one manual `pg_dump` of production **today** and store it encrypted off-machine — you currently have zero copies of classroom data | S | 0 |
| 4 | Create UptimeRobot free account; add an HTTPS monitor on the production URL (upgrade it to `/api/health` in week one) | S | 0 |
| 5 | Prune stale `.env` keys (`GROQ_API_KEY`, `MISTRAL_MINISTRAL_14B/3B_API_KEY`); change `.gitignore` env pattern to `.env*` + `!.env.example`; fix `.claude/launch.json` to `pnpm` | S | 0 |
| 6 | Add `"engines": { "node": ">=22" }` to package.json | S | 0 |

## Week one

| # | Action | Effort | $ |
|---|---|---|---|
| 7 | **CI gate**: add the workflow below at `.github/workflows/ci.yml` | S | 0 (public/free-tier minutes) |
| 8 | **Branch protection** on `main`: require the `ci` check to pass; work moves to short-lived branches + PRs (solo: no review requirement, just the check). Every PR now gets a free Vercel **preview deploy** — click it before merging | S | 0 |
| 9 | **Error tracking**: `pnpm add @sentry/nextjs`, run the wizard; free Developer tier (~5k events/mo, email alerts). Wrap the 9 existing `console.error` sites with `Sentry.captureException` — especially `lib/ai/limits.ts` fail-open and `lib/ai/router.ts` provider errors | M | 0 |
| 10 | **`/api/health` route**: returns 200 after a trivial Supabase query (e.g. `select 1`) and a router `configured`-lane count; point UptimeRobot at it (5-min checks, free) | S | 0 |
| 11 | **Nightly backup**: scheduled GitHub Action running `pg_dump` against the Supabase connection string (repo secret), encrypt with `age`, upload as a workflow artifact (90-day retention) — sketch below | M | 0 |
| 12 | **Migration rule** written into `supabase/migrations/README.md`: (a) migrations are applied *before* pushing code that depends on them; (b) every migration must be backward-compatible with currently-deployed code (expand → deploy → contract); (c) keep an "applied through: NNNN" line in the README updated at apply time | S | 0 |

## Month one

| # | Action | Effort | $ |
|---|---|---|---|
| 13 | **Supabase CLI adoption**: `supabase init` + `supabase link`; apply future migrations with `supabase db push` so prod has a real migration-history table instead of hand-pasting; verify existing 0001–0022 are recorded (`supabase migration list`) | M | 0 |
| 14 | **First tests** (vitest): the code-quality review §7 already ranked them — router failover state machine first (`__resetRouterState` is waiting), then `reducer`/`applyAiAction`, then persistence round-trip. Add `pnpm test` to the CI workflow | L | 0 |
| 15 | **Structured logging helper**: one `lib/log.ts` emitting single-line JSON (`{level, scope, msg, meta}`); migrate the console.error sites. Makes Vercel log search usable and future log-drain trivial | S | 0 |
| 16 | **Restore drill**: restore a nightly dump into a scratch Supabase project, run the app against it, write the steps into `docs/` as the DR runbook. A backup that has never been restored is a hope, not a backup | M | 0 |
| 17 | **Staging Supabase**: second free-tier project; preview deploys read staging env vars (Vercel lets Preview/Production envs differ) so schema experiments never touch classroom data | M | 0 |
| 18 | **Config-drift guard**: startup (or `/api/health`) assertion comparing configured AI lanes against expected count; admin monitor already computes `configured` per target — surface "N of 6 lanes configured" | S | 0 |
| 19 | Decide the **$25/mo trigger**: the day a real school signs up, either upgrade Supabase to Pro (daily backups, 7-day retention, log retention) or accept the pg_dump regime as permanent — write it as a decision record | S | 0 → 25/mo later |

Deliberately deferred: log drains (needs Vercel Pro), APM/tracing, Dependabot auto-merge
(noise > value at this velocity), TS 7 migration (revisit ~Q4 2026), E2E tests.

---

## CI workflow sketch (`.github/workflows/ci.yml`)

```yaml
name: ci
on:
  push:
    branches: [main]
  pull_request:

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4          # reads packageManager: pnpm@11.11.0
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile  # also proves lockfile/manifest agree
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm build                      # same gate Vercel applies, but *before* merge
        env:                                 # dummy values so build doesn't need real secrets
          NEXT_PUBLIC_SUPABASE_URL: https://example.supabase.co
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ci-placeholder
      # month one: - run: pnpm test
```

Then in GitHub → Settings → Branches → protect `main`: require status check `ci`,
require branches to be up to date. Vercel keeps auto-deploying `main`; the difference is
nothing reaches `main` without passing the gate.

## Backup workflow sketch (`.github/workflows/backup.yml`)

```yaml
name: nightly-backup
on:
  schedule: [{ cron: "17 9 * * *" }]   # 09:17 UTC nightly
  workflow_dispatch:

jobs:
  dump:
    runs-on: ubuntu-latest
    steps:
      - run: |
          sudo apt-get -y install postgresql-client age
          pg_dump "$SUPABASE_DB_URL" --no-owner --format=custom -f dump.pgc
          age -r "$AGE_PUBLIC_KEY" -o dump.pgc.age dump.pgc && rm dump.pgc
        env:
          SUPABASE_DB_URL: ${{ secrets.SUPABASE_DB_URL }}   # session-pooler conn string
          AGE_PUBLIC_KEY: ${{ vars.AGE_PUBLIC_KEY }}
      - uses: actions/upload-artifact@v4
        with: { name: "db-${{ github.run_id }}", path: dump.pgc.age, retention-days: 90 }
```

Keep the `age` private key in your password manager, **not** in the repo or GitHub.
Restore: `age -d dump.pgc.age | pg_restore -d <scratch-db-url> --no-owner`.

---

## What this buys, concretely

- A broken push is caught in CI or seen on a preview URL — not by a teacher mid-lesson.
- When production *does* break: Sentry emails you the stack trace within a minute;
  UptimeRobot emails you if the site is down at all; logs stop evaporating unread.
- The worst realistic day (bad migration destroys the `houses` table) goes from
  "irrecoverable, product-ending" to "restore last night's dump, lose ≤ 24h".
- Total new spend: **$0/mo now**; one planned $25/mo decision gated on real users.
