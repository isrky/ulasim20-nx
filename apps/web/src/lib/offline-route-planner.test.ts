import { describe, expect, it, vi } from 'vitest'

// The module imports Capacitor + backend helpers at load time. Mock them
// to keep this pure-logic test hermetic.
vi.mock('@/lib/capacitor', () => ({
  getCurrentPosition: vi.fn(),
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => false },
  CapacitorHttp: { get: vi.fn() },
}))

vi.mock('@/api/denizli', () => ({
  backendOrigin: () => 'https://backend.test',
  resolveBackendUrl: (p: string) => `https://backend.test${p}`,
  resolveRuntimeUrl: (p: string) => `https://runtime.test${p}`,
}))

import { toRouteLocationFromStation } from './offline-route-planner'

describe('toRouteLocationFromStation', () => {
  it('maps a RouteApiStation to a station-kind RouteLocation with a stable id', () => {
    const location = toRouteLocationFromStation({
      stationId: 42,
      stationName: 'Pamukkale Üniversitesi',
      lat: 37.77,
      lng: 29.08,
      routes: ['120', '220'],
    })

    expect(location).toEqual({
      id: 'station:42',
      kind: 'station',
      label: 'Pamukkale Üniversitesi',
      lat: 37.77,
      lng: 29.08,
      stationId: 42,
      routes: ['120', '220'],
    })
  })

  it('propagates empty routes array', () => {
    const location = toRouteLocationFromStation({
      stationId: 1,
      stationName: 'Test',
      lat: 0,
      lng: 0,
      routes: [],
    })
    expect(location.routes).toEqual([])
    expect(location.kind).toBe('station')
  })
})
