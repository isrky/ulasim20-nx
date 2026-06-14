import { afterEach } from 'vitest'

// Pure-Node setup: keep global state isolated between tests
afterEach(() => {
  // Drop any globals tests assigned onto globalThis
  // biome-ignore lint/performance/noDelete: clean removal from globalThis in test teardown
  delete (globalThis as Record<string, unknown>).window
  // biome-ignore lint/performance/noDelete: clean removal from globalThis in test teardown
  delete (globalThis as Record<string, unknown>).localStorage
  // biome-ignore lint/performance/noDelete: clean removal from globalThis in test teardown
  delete (globalThis as Record<string, unknown>).navigator
})
