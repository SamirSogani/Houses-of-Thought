// preinstall guard — this repo standardizes on pnpm (decision 013). Fail a
// non-pnpm install immediately, before it re-creates lockfile drift, instead of
// letting `npm install` / `yarn` silently succeed. Dependency-free and offline-
// safe: it only reads the user-agent every package manager sets during install.
const ua = process.env.npm_config_user_agent || ''

if (!ua.startsWith('pnpm')) {
  console.error(
    [
      '',
      'This repository uses pnpm — run `pnpm install` instead.',
      'One-time setup: `corepack enable`.',
      'See decisions/013-standardize-on-pnpm.md.',
      '',
    ].join('\n')
  )
  process.exit(1)
}
