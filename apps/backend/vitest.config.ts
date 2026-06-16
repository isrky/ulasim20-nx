import path from 'node:path'
import { defineWorkersProject } from '@cloudflare/vitest-pool-workers/config'

export default defineWorkersProject({
  test: {
    name: 'backend',
    include: [path.resolve(__dirname, 'src/**/*.test.ts')],
    setupFiles: [path.resolve(__dirname, 'tests/setup.ts')],
    poolOptions: {
      workers: {
        singleWorker: true,
        main: path.resolve(__dirname, 'src/index.ts'),
        miniflare: {
          compatibilityDate: '2024-12-30',
          compatibilityFlags: ['nodejs_compat'],
          bindings: {
            UPSTREAM_API: 'https://upstream.test',
            CACHE_TTL_STATIONS: '86400',
            CACHE_TTL_ROUTES: '86400',
            CACHE_TTL_ROUTE_STATIONS: '43200',
            CACHE_TTL_GRAPH: '21600',
            CACHE_TTL_GEOMETRY: '2592000',
            CACHE_TTL_PLANNER_INDEX: '21600',
            CACHE_TTL_REALTIME: '10',
          },
          kvNamespaces: ['CACHE'],
          r2Buckets: ['DATASETS'],
        },
      },
    },
  },
})
