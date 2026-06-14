import path from 'node:path'
import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  {
    extends: './vitest.config.ts',
    test: {
      name: 'frontend',
      environment: 'jsdom',
      include: ['src/**/*.test.{ts,tsx}'],
      setupFiles: [path.resolve(__dirname, './tests/setup/frontend.ts')],
    },
  },
  {
    extends: './vitest.config.ts',
    test: {
      name: 'node',
      environment: 'node',
      include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
      setupFiles: [path.resolve(__dirname, './tests/setup/node.ts')],
    },
  },
  './backend/vitest.config.ts',
])
