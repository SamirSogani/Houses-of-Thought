// Vitest config. First wave of tests covers pure server modules only (node
// environment, no DOM, no Next plugin needed). The '@' alias mirrors
// tsconfig.json's paths entry.

import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname) },
  },
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/.next/**'],
  },
})
