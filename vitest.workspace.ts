import path from 'node:path'
import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  {
    test: {
      name: 'frontend',
      environment: 'jsdom',
      include: [
        'apps/web/src/**/*.test.{ts,tsx}',
        'libs/feature/**/src/**/*.test.tsx',
        'libs/ui/**/src/**/*.test.tsx'
      ],
      setupFiles: [path.resolve(__dirname, './tests/setup/frontend.ts')]
    }
  },
  {
    test: {
      name: 'node',
      environment: 'node',
      include: [
        'libs/util/**/src/**/*.test.ts',
        'libs/types/**/src/**/*.test.ts',
        'libs/data-access/**/src/**/*.test.ts',
        'tests/unit/**/*.test.ts',
        'tests/integration/**/*.test.ts'
      ],
      setupFiles: [path.resolve(__dirname, './tests/setup/node.ts')]
    }
  }
])
