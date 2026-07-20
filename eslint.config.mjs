// Flat ESLint config (Next 16 dropped `next lint` — the eslint CLI runs this
// directly; analysis/operations-and-delivery-plan.md item 1).
import { defineConfig, globalIgnores } from 'eslint/config'
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

export default defineConfig([
  globalIgnores(['.next/**', 'node_modules/**', 'next-env.d.ts']),
  nextCoreWebVitals,
  nextTypescript,
  {
    // Scoped to the files the Next presets cover — an unscoped object would
    // also apply to this config file, where the react-hooks plugin isn't loaded.
    files: ['**/*.{js,jsx,ts,tsx}'],
    // Debt, not disagreement: these two react-hooks v7 (React Compiler era)
    // rules flag the codebase's established load-in-effect and latest-value-ref
    // patterns (~30 sites). Refactoring them is a behavioral change to the save
    // and data-loading paths — tracked in analysis/frontend-architecture.md's
    // debt register, not something to bulk-edit for lint. Warn keeps them
    // visible in new code without blocking CI.
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
    },
  },
])
