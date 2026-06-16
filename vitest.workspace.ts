import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, defineWorkspace } from 'vitest/config'

const testsAlias = {
  '~tests': path.resolve(__dirname, './tests')
}

export default defineWorkspace([
  {
    plugins: [react()],
    resolve: {
      dedupe: ['react', 'react-dom', 'react-router', 'react-router-dom'],
      alias: {
        '@': path.resolve(__dirname, 'apps/web/src'),
        ...testsAlias,
        '@ulasim20/feature-routes': path.resolve(__dirname, 'libs/feature/routes/src/index.ts')
      }
    },
    test: {
      name: 'frontend',
      environment: 'jsdom',
      include: [
        'apps/web/src/**/*.test.{ts,tsx}',
        'libs/feature/**/src/**/*.test.tsx',
        'libs/ui/**/src/**/*.test.tsx',
        'libs/util/hooks/src/**/*.test.{ts,tsx}'
      ],
      setupFiles: [path.resolve(__dirname, './tests/setup/frontend.ts')]
    }
  },
  {
    resolve: {
      alias: {
        ...testsAlias
      }
    },
    test: {
      name: 'node',
      environment: 'node',
      include: [
        'libs/util/**/src/**/*.test.ts',
        'libs/util/**/src/__tests__/**/*.test.ts',
        'libs/types/**/src/**/*.test.ts',
        'libs/feature/**/src/**/*.test.ts',
        'libs/feature/**/src/__tests__/**/*.test.ts',
        'tests/unit/**/*.test.ts',
        'tests/integration/**/*.test.ts'
      ],
      setupFiles: [path.resolve(__dirname, './tests/setup/node.ts')]
    }
  }
])
