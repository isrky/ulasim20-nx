# Testing

This project uses a single **Vitest workspace** with three cooperating
projects, plus **Playwright** for end-to-end tests. The test commands live in
[`package.json`](../package.json) and are mirrored in
[`devbox.json`](../devbox.json).

## Quick reference

| Command                                    | What it runs                                                            |
| ------------------------------------------ | ----------------------------------------------------------------------- |
| `npm test`                                 | Every Vitest project: frontend (jsdom) + node + backend (workerd)       |
| `npm run test:watch`                       | Vitest in watch mode — use this for TDD                                 |
| `npm run test:ui`                          | Vitest UI at `http://localhost:51204/__vitest__/`                       |
| `npm run test:coverage`                    | Vitest frontend + node **with V8 coverage** (HTML + lcov + JSON)        |
| `npm run test:frontend`                    | Only the jsdom project                                                  |
| `npm run test:node`                        | Only the pure-Node project (analytics, validation, helpers)             |
| `npm run test:backend`                     | Only the Cloudflare Workers pool (Hono routes + services)               |
| `npm run test:e2e`                         | Playwright against `vite preview` (+ stubbed API)                       |
| `npm run test:e2e:ui`                      | Playwright UI runner                                                    |
| `npm run typecheck`                        | `tsc --noEmit` for frontend **and** backend                             |

## Workspace layout

```
├── vitest.config.ts            # shared config: aliases, coverage defaults
├── vitest.workspace.ts         # wires up three projects
├── playwright.config.ts        # webServer launches vite preview
├── tests/
│   ├── setup/
│   │   ├── frontend.ts         # jsdom polyfills, jest-dom matchers
│   │   ├── node.ts             # global cleanup hooks
│   │   └── vitest.d.ts         # merges jest-dom matcher types
│   ├── helpers/
│   │   ├── renderWithProviders.tsx
│   │   ├── mockStorage.ts
│   │   └── mockWindow.ts
│   ├── unit/                   # pure-Node unit tests
│   └── integration/            # (reserved) cross-module integration
├── e2e/                        # Playwright specs
│   ├── fixtures.ts             # stubBackend() intercepts /api/* and upstream
│   ├── smoke.spec.ts
│   ├── feedback.spec.ts
│   └── harita.spec.ts
└── backend/
    ├── vitest.config.ts        # defineWorkersProject — real workerd runtime
    ├── tests/setup.ts
    └── src/**/*.test.ts        # co-located service/route tests
```

### Where does a new test live?

| What you're testing                                    | Put the test here                     | Environment |
| ------------------------------------------------------ | ------------------------------------- | ----------- |
| A React component or page                              | `src/**/*.test.tsx` next to the file  | jsdom       |
| A frontend utility (`src/lib/*`, `src/utils/*`)        | `src/**/*.test.ts` next to the file   | jsdom       |
| A pure Node helper or shared logic                     | `tests/unit/*.test.ts`                | Node        |
| A Hono route / backend service                         | `backend/src/**/*.test.ts` co-located | workerd     |
| An end-to-end journey through the real app             | `e2e/*.spec.ts`                       | chromium    |

## TDD workflow

This repo follows the [test-driven-development skill](../.codex/skills/test-driven-development/SKILL.md)
RED → GREEN → REFACTOR loop.

1. **RED** — write one failing test that expresses the behavior you want.
   ```bash
   npm run test:watch -- path/to/new.test.ts
   ```
2. **Verify RED** — the test **must** fail for the right reason. If it passes
   immediately or errors out on a typo, fix it before moving on.
3. **GREEN** — write the smallest amount of production code to make it pass.
4. **Verify GREEN** — confirm the new test and all other tests still pass.
5. **REFACTOR** — clean up. Tests stay green.

Run one file with focus:

```bash
npx vitest run src/lib/utils.test.ts
```

Run a single test by name:

```bash
npx vitest run -t "retains only PocketBase-shaped IDs"
```

## Conventions

- Use `describe` to group related cases and `it` for each behavior. One
  behavior per test (no `and` in the name).
- Prefer real code to mocks. When the unit under test pulls in browser or
  Capacitor APIs that don't exist in jsdom, mock at the module boundary with
  `vi.mock('@/lib/capacitor', () => …)`.
- For tests that need routing + `TransitProvider`, use
  [`tests/helpers/renderWithProviders.tsx`](./helpers/renderWithProviders.tsx)
  instead of bare `render()`.
- For tests that probe analytics or storage in Node, use
  [`tests/helpers/mockWindow.ts`](./helpers/mockWindow.ts) so the global
  shims are consistent and cleaned up by the setup file.
- **Never commit** `.only` or `.skip`.
- Follow the project-wide rule: code and test identifiers are English; UI
  copy in assertions may be Turkish.

## Coverage

Coverage is **report-only** — CI never fails on thresholds. Output lives in
`coverage/` with HTML, lcov, and `coverage-summary.json`. The Workers pool
(backend project) cannot be instrumented by V8 coverage because workerd has
no `node:inspector`; backend coverage is exercised through direct assertions
instead.

## CI

[`.github/workflows/test.yml`](../.github/workflows/test.yml) runs three jobs
on every PR and push to `main`:

1. `typecheck` — frontend + backend `tsc --noEmit`.
2. `unit` — Vitest frontend + node with coverage, plus backend workers pool.
   Uploads `coverage/` as an artifact and posts a summary to the job page.
3. `e2e` — `npx playwright install --with-deps chromium`, build, then
   Playwright. Uploads `playwright-report/` on failure.

## Gotchas

- **`vi.useFakeTimers()` in the Workers pool** breaks the isolated-storage
  snapshotting. Use real time or inject dependencies instead.
- **jsdom + Radix UI** requires the polyfills in
  [`tests/setup/frontend.ts`](./setup/frontend.ts) (matchMedia,
  IntersectionObserver, ResizeObserver, scrollTo). Don't remove them.
- **Outbound `fetch` in backend tests** is intercepted via
  `fetchMock` from `cloudflare:test`. Call
  `fetchMock.disableNetConnect()` once per file (`beforeAll`) and
  `assertNoPendingInterceptors()` around each test to surface leaks.
- **Trailing slashes in Hono routes** matter. `POST /api/feedback` works;
  `POST /api/feedback/` returns 404 because routes are mounted with
  `app.route('/api/feedback', ...)` and the handler is at `/`.
