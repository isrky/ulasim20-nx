// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@ulasim20/data-access-transport-api', () => ({
  apiGet: vi.fn(),
  getAllStations: vi.fn(),
  getBusDataForStation: vi.fn(),
  getRouteGeometryResult: vi.fn(),
  triggerRouteGeometryGeneration: vi.fn(),
}))
vi.mock('@ulasim20/feature-planner', () => ({
  fetchDirectKmzRouteGeometry: vi.fn(),
}))
vi.mock('@ulasim20/util-analytics', () => ({
  trackLineLookup: vi.fn(),
  trackRouteMapOpen: vi.fn(),
  trackStopLookup: vi.fn(),
}))

import { getAllStations } from '@ulasim20/data-access-transport-api'
import { useTransitMap } from './use-transit-map'

const mockedGetAllStations = vi.mocked(getAllStations)

beforeEach(() => {
  vi.clearAllMocks()
  mockedGetAllStations.mockResolvedValue([
    { stationId: 1, stationName: 'A', latitude: '37,77', longitude: '29,08' },
    { stationId: 2, stationName: 'B', latitude: '37,78', longitude: '29,09' },
  ])
})

describe('useTransitMap — stations bootstrap', () => {
  it('loads and processes stations on mount', async () => {
    const { result } = renderHook(() => useTransitMap())
    await waitFor(() => expect(result.current.processedStations).toHaveLength(2))
    expect(result.current.processedStations[0]).toMatchObject({ stationId: 1, lat: 37.77, lng: 29.08 })
    expect(result.current.stationIdx.length).toBeGreaterThan(0)
  })

  it('skips stations with invalid coordinates', async () => {
    mockedGetAllStations.mockResolvedValueOnce([
      { stationId: 1, stationName: 'Bad', latitude: 'NaN', longitude: 'x' },
      { stationId: 2, stationName: 'Good', latitude: '37,78', longitude: '29,09' },
    ])
    const { result } = renderHook(() => useTransitMap())
    await waitFor(() => expect(result.current.processedStations).toHaveLength(1))
    expect(result.current.processedStations[0].stationId).toBe(2)
  })

  it('exposes flyTarget when lat/lng URL params are present', async () => {
    const { result } = renderHook(() =>
      useTransitMap({ searchParams: new URLSearchParams('lat=37,77&lng=29,08') }),
    )
    await waitFor(() => expect(result.current.flyTarget).toEqual({ lat: 37.77, lng: 29.08 }))
  })

  it('captures refill point when type=refill is set', async () => {
    const { result } = renderHook(() =>
      useTransitMap({
        searchParams: new URLSearchParams('lat=37,77&lng=29,08&type=refill&name=A&id=42'),
      }),
    )
    await waitFor(() =>
      expect(result.current.refillPoint).toMatchObject({ lat: 37.77, lng: 29.08, id: 42, name: 'A' }),
    )
  })
})

describe('useTransitMap — searchParams reactivity', () => {
  it('updates flyTarget when lat/lng change', async () => {
    let params = new URLSearchParams('lat=37,77&lng=29,08')
    const { result, rerender } = renderHook(({ sp }: { sp: URLSearchParams }) => useTransitMap({ searchParams: sp }), {
      initialProps: { sp: params },
    })
    await waitFor(() => expect(result.current.flyTarget).toEqual({ lat: 37.77, lng: 29.08 }))
    act(() => {
      params = new URLSearchParams('lat=37,80&lng=29,10')
      rerender({ sp: params })
    })
    await waitFor(() => expect(result.current.flyTarget).toEqual({ lat: 37.8, lng: 29.1 }))
  })
})
