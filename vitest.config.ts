import path from 'node:path'
import { defineConfig } from 'vitest/config'

// This root vitest.config.ts is a marker so vitest's auto-discovery
// stops at the worktree root instead of walking up to the parent repo.
// The actual test projects are defined in vitest.workspace.ts.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'apps/web/src')
    }
  }
})
