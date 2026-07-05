import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const fakeMap = {
  flyTo: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  isStyleLoaded: vi.fn().mockReturnValue(true),
  loaded: vi.fn().mockReturnValue(true),
  addControl: vi.fn(),
  addSource: vi.fn(),
  addLayer: vi.fn(),
  getSource: vi.fn().mockReturnValue({ setData: vi.fn() }),
  getLayer: vi.fn().mockReturnValue(undefined),
  hasImage: vi.fn().mockReturnValue(true),
  loadImage: vi.fn((_u: string, cb: (e: null, img: HTMLImageElement) => void) => cb(null, document.createElement('img'))),
  addImage: vi.fn(),
  setData: vi.fn(),
  remove: vi.fn(),
}

vi.mock('maplibre-gl', () => {
  // biome-ignore lint/suspicious/noShadowRestrictedNames: intentionally mocking the global Map class
  class Map {
    // biome-ignore lint/correctness/noConstructorReturn: returning shared fake instance for spy assertions
    constructor(_opts: unknown) { return fakeMap }
  }
  class Marker {
    // biome-ignore lint/correctness/noConstructorReturn: returning shared fake instance for spy assertions
    constructor(_opts?: unknown) { return fakeMap }
  }
  class Popup {
    // biome-ignore lint/correctness/noConstructorReturn: returning shared fake instance for spy assertions
    constructor(_opts?: unknown) { return fakeMap }
  }
  class NavigationControl {}
  class ScaleControl {}
  class AttributionControl {}
  return { Map, Marker, Popup, NavigationControl, ScaleControl, AttributionControl }
})
vi.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}))

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

import {
  apiGet,
  getAllStations,
  getRouteGeometryResult,
  triggerRouteGeometryGeneration,
} from '@ulasim20/data-access-transport-api'
import { fetchDirectKmzRouteGeometry } from '@ulasim20/feature-planner'
import TransitMap from './index'

const mockedGetAllStations = vi.mocked(getAllStations)
const mockedApiGet = vi.mocked(apiGet)
const mockedGetRouteGeometryResult = vi.mocked(getRouteGeometryResult)
const mockedTriggerRouteGeometryGeneration = vi.mocked(triggerRouteGeometryGeneration)
const mockedFetchDirectKmzRouteGeometry = vi.mocked(fetchDirectKmzRouteGeometry)

function renderMap(path = '/harita?line=320') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <TransitMap />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  Object.assign(fakeMap, {
    flyTo: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    isStyleLoaded: vi.fn().mockReturnValue(true),
    loaded: vi.fn().mockReturnValue(true),
    addControl: vi.fn(),
    addSource: vi.fn(),
    addLayer: vi.fn(),
    getSource: vi.fn().mockReturnValue({ setData: vi.fn() }),
    getLayer: vi.fn().mockReturnValue(undefined),
    hasImage: vi.fn().mockReturnValue(true),
    loadImage: vi.fn((_u: string, cb: (e: null, img: HTMLImageElement) => void) => cb(null, document.createElement('img'))),
    addImage: vi.fn(),
    setData: vi.fn(),
    remove: vi.fn(),
  })
  mockedGetAllStations.mockResolvedValue([])
  mockedApiGet.mockImplementation(async (url: string) => {
    if (String(url).includes('GetRouteStations')) {
      return { value: { lineName: '320 Test Hattı', stations: [] } }
    }
    return { value: [] }
  })
})

describe('<TransitMap /> route deep link', () => {
  it('draws cached backend geometry for the selected line query param', async () => {
    mockedGetRouteGeometryResult.mockResolvedValue({
      status: 'hit',
      geometry: { lineCode: '320', coordinates: [[37.77, 29.08]], source: 'kmz-direct' },
    })
    renderMap()
    expect(await screen.findByText('320 Test Hattı')).toBeInTheDocument()
    expect(mockedTriggerRouteGeometryGeneration).not.toHaveBeenCalled()
    expect(mockedFetchDirectKmzRouteGeometry).not.toHaveBeenCalled()
  })

  it('triggers backend generation and draws direct KMZ fallback on cache miss', async () => {
    mockedGetRouteGeometryResult.mockResolvedValue({ status: 'miss' })
    mockedFetchDirectKmzRouteGeometry.mockResolvedValue({
      lineCode: '320', coordinates: [[37.77, 29.08]], source: 'direct-kmz',
    })
    renderMap()
    await waitFor(() => expect(mockedTriggerRouteGeometryGeneration).toHaveBeenCalledWith('320'))
    expect(await screen.findByText('320 Test Hattı')).toBeInTheDocument()
  })

  it('shows a clear error when cache and direct KMZ fallback are unavailable', async () => {
    mockedGetRouteGeometryResult.mockResolvedValue({ status: 'miss' })
    mockedFetchDirectKmzRouteGeometry.mockRejectedValue(new Error('no geometry'))
    renderMap()
    expect(await screen.findByText('Güzergah çizilemedi')).toBeInTheDocument()
  })
})
