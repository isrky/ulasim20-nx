import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    reporters: process.env.CI ? ['default', 'github-actions'] : ['default'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json-summary'],
      reportsDirectory: 'coverage',
      // Backend files are covered by the Workers pool, which does not
      // support V8 coverage instrumentation (no `node:inspector` in
      // workerd). Their coverage is demonstrated by the backend test
      // project's assertions but excluded from the unified report.
      include: ['src/lib/**/*.{ts,tsx}', 'src/pages/**/*.{ts,tsx}', 'src/components/**/*.{ts,tsx}'],
      exclude: [
        '**/*.d.ts',
        '**/*.test.{ts,tsx}',
        '**/__mocks__/**',
        'src/components/ui/**',
        'src/main.tsx',
        'src/App.tsx',
        'src/types/**',
        'src/api/**',
        'src/hooks/**',
      ],
    },
  },
})
