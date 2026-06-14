import { vi } from 'vitest'

export interface TrackedEvent {
  name?: string
  payload?: Record<string, unknown>
}

export interface MockUmamiWindow {
  window: {
    umami: {
      track: ReturnType<typeof vi.fn>
    }
    Capacitor?: { isNativePlatform: () => boolean }
  }
  tracked: TrackedEvent[]
}

/**
 * Install a minimal `window.umami.track` onto `globalThis` and return a
 * handle to inspect calls. Intended for Node-environment tests that exercise
 * analytics helpers without pulling in jsdom.
 */
export function installUmamiWindow({ native = false } = {}): MockUmamiWindow {
  const tracked: TrackedEvent[] = []
  const track = vi.fn((name: string, payload: Record<string, unknown>) => {
    tracked.push({ name, payload })
  })
  const mock: MockUmamiWindow['window'] = {
    umami: { track },
    ...(native ? { Capacitor: { isNativePlatform: () => true } } : {}),
  }
  ;(globalThis as Record<string, unknown>).window = mock
  return { window: mock, tracked }
}

/** Install a minimal `globalThis.localStorage` backed by a plain JSON string. */
export function installLocalStorageWith(raw: string | null) {
  ;(globalThis as Record<string, unknown>).localStorage = {
    getItem: () => raw,
  } satisfies Pick<Storage, 'getItem'>
}
