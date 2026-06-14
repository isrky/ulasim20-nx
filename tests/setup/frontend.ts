import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'

// Ensure DOM cleanup between tests
afterEach(() => {
  cleanup()
})

// Polyfills for jsdom gaps that shadcn/ui / Radix rely on
beforeEach(() => {
  if (!window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
  }

  if (!window.IntersectionObserver) {
    window.IntersectionObserver = class IntersectionObserverMock {
      observe = vi.fn()
      unobserve = vi.fn()
      disconnect = vi.fn()
      takeRecords = vi.fn().mockReturnValue([])
      root = null
      rootMargin = ''
      thresholds: ReadonlyArray<number> = []
    } as unknown as typeof IntersectionObserver
  }

  if (!window.ResizeObserver) {
    window.ResizeObserver = class ResizeObserverMock {
      observe = vi.fn()
      unobserve = vi.fn()
      disconnect = vi.fn()
    } as unknown as typeof ResizeObserver
  }

  if (!('scrollTo' in window)) {
    Object.defineProperty(window, 'scrollTo', {
      writable: true,
      value: vi.fn(),
    })
  }
})
