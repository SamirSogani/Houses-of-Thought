# Decision 013 — Standardize on pnpm (drop package-lock.json)

**Date:** 2026-07-10
**Status:** Implemented — `package-lock.json` removed, `pnpm-lock.yaml` is the sole
lockfile, and `package.json` pins `"packageManager": "pnpm@11.11.0"` (corepack).

## Context

The repo carried **two** lockfiles: `package-lock.json` (npm) and `pnpm-lock.yaml`
(pnpm). Vercel deploys with pnpm, so the Vercel Web Analytics integration (PR #2)
added `@vercel/analytics` to `package.json` **and `pnpm-lock.yaml` only**. The npm
lockfile was never updated, so an npm-based local `node_modules` was missing the
package and `app/layout.tsx` failed to resolve `@vercel/analytics/next` — a build
break that existed **locally but not on Vercel**. That drift is the failure mode of
keeping two lockfiles: they silently disagree, and whichever one a given
environment uses decides whether the build works.

An interim fix reconciled `package-lock.json` (commit adding the missing dep), but
two lockfiles will drift again. The durable fix is to keep one.

## Decision

Standardize on **pnpm**, matching the deployment platform (Vercel).

- **Delete `package-lock.json`.** `pnpm-lock.yaml` is the single source of truth;
  it already resolves every dependency incl. `@vercel/analytics`.
- **Pin the toolchain**: `"packageManager": "pnpm@11.11.0"` in `package.json`.
  With corepack this makes the pnpm version deterministic across machines and CI.
- **Local usage**: `corepack pnpm <cmd>` (or `corepack enable` once, then `pnpm`).
  Use `pnpm install` / `pnpm run build` / `pnpm run dev` — not npm.

## Why pnpm over npm

- **Parity with production** — Vercel already builds with pnpm; a single lockfile
  shared with CI/deploy eliminates the "works locally, breaks on deploy" class of
  bug (and its inverse, which is what bit us here).
- **One source of truth** — no dual-lockfile drift.
- Strict, content-addressed `node_modules` (no phantom deps) and faster installs
  are a bonus, not the driver.

## Consequences / follow-ups

- Contributors must use pnpm. A fresh clone: `corepack enable` then `pnpm install`.
  `corepack enable` writes a `pnpm` shim to the Node bin dir; on this machine that
  is `/usr/local/bin`, which needs `sudo corepack enable`. Until the shim exists,
  `corepack pnpm <cmd>` works for install, but `pnpm run <script>` fails its
  pre-run deps check (it spawns a bare `pnpm`) — so the one-time `corepack enable`
  is required for the normal `pnpm build` / `pnpm dev` workflow.
- Verified after the switch: `pnpm install` (exit 0, `pnpm-lock.yaml` already in
  sync) and a production build against the pnpm `node_modules` compiles clean.
- Doc command references that still say `npm install` / `npm run build` (e.g. in
  `plans/active/ai/*`) are historical phase records; the equivalent pnpm command
  applies. Not rewritten here to avoid churn in completed plans.
- Hardening (done): a `preinstall` guard (`scripts/ensure-pnpm.cjs`) fails fast if
  the install isn't pnpm — it reads `npm_config_user_agent`, so it is dependency-
  free and offline-safe (no `npx only-allow` fetch). Verified: `npm`/`yarn` are
  blocked with a pointer to this doc; `pnpm` passes silently.
- `sharp` build approval: pnpm 10+ blocks `sharp`'s native build script by
  default, which made `pnpm install` exit non-zero (`ERR_PNPM_IGNORED_BUILDS`).
  Fixed by allowlisting it in `pnpm-workspace.yaml` (`allowBuilds: { sharp: true }`)
  — note pnpm 11 no longer reads the `"pnpm"` field in `package.json`, and the
  setting is `allowBuilds`, not `onlyBuiltDependencies`. `pnpm install` now exits 0
  and builds sharp.
