import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TransitMap from './transit-map'
import {
  apiGet,
  getAllStations,
  getRouteGeometryResult,
  triggerRouteGeometryGeneration,
} from '@/api/denizli'
import { fetchDirectKmzRouteGeometry } from '@/lib/kmz-route-geometry'

vi.mock('leaflet/dist/leaflet.css', () => ({}))
vi.mock('leaflet', () => {
  class Icon {
    static Default = {
      prototype: {},
      mergeOptions: vi.fn(),
    }
    // biome-ignore lint/complexity/noUselessConstructor: needed for type compatibility with Leaflet
    constructor(_options?: unknown) {}
  }

  class DivIcon {
    // biome-ignore lint/complexity/noUselessConstructor: needed for type compatibility with Leaflet
    constructor(_options?: unknown) {}
  }

  return {
    default: {
      Icon,
      DivIcon,
      divIcon: vi.fn(() => ({})),
    },
  }
})
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="map">{children}</div>,
  TileLayer: () => null,
  Marker: ({ children }: { children?: React.ReactNode }) => <div data-testid="marker">{children}</div>,
  Popup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Polyline: () => <div data-testid="route-polyline" />,
  useMap: () => ({
    flyTo: vi.fn(),
    fitBounds: vi.fn(),
    setView: vi.fn(),
    getZoom: vi.fn(() => 13),
    getBounds: vi.fn(() => ({ contains: vi.fn(() => true) })),
  }),
  useMapEvents: vi.fn(),
}))
vi.mock('@/api/denizli', () => ({
  apiGet: vi.fn(),
  getAllStations: vi.fn(),
  getBusDataForStation: vi.fn(),
  getRouteGeometryResult: vi.fn(),
  triggerRouteGeometryGeneration: vi.fn(),
}))
vi.mock('@/lib/kmz-route-geometry', () => ({
  fetchDirectKmzRouteGeometry: vi.fn(),
}))
vi.mock('@/lib/analytics', () => ({
  trackLineLookup: vi.fn(),
  trackRouteMapOpen: vi.fn(),
  trackStopLookup: vi.fn(),
}))

const mockedGetAllStations = vi.mocked(getAllStations)
const mockedApiGet = vi.mocked(apiGet)
const mockedGetRouteGeometryResult = vi.mocked(getRouteGeometryResult)
const mockedTriggerRouteGeometryGeneration = vi.mocked(triggerRouteGeometryGeneration)
const mockedFetchDirectKmzRouteGeometry = vi.mocked(fetchDirectKmzRouteGeometry)

function renderMap(path = '/harita?line=320') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <TransitMap />
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedGetAllStations.mockResolvedValue([])
  mockedApiGet.mockImplementation(async (url: string) => {
    if (url.includes('GetRouteStations')) {
      return {
        value: {
          lineName: '320 Test Hattı',
          stations: [
            { stationId: 1, stationName: 'Durak 1', stationCode: '1', latitude: '37.77', longitude: '29.08', sure: '1 dk' },
            { stationId: 2, stationName: 'Durak 2', stationCode: '2', latitude: '37.78', longitude: '29.09', sure: '2 dk' },
          ],
        },
      }
    }
    return { value: [] }
  })
})

describe('<TransitMap /> route deep link', () => {
  it('draws cached backend geometry for the selected line query param', async () => {
    mockedGetRouteGeometryResult.mockResolvedValue({
      status: 'hit',
      geometry: {
        lineCode: '320',
        coordinates: [[37.77, 29.08], [37.78, 29.09]],
        source: 'kmz-direct',
      },
    })

    renderMap()

    expect(await screen.findByText('320 Test Hattı')).toBeInTheDocument()
    expect(screen.getByTestId('route-polyline')).toBeInTheDocument()
    expect(mockedTriggerRouteGeometryGeneration).not.toHaveBeenCalled()
  })

  it('triggers backend generation and draws direct KMZ fallback on cache miss', async () => {
    mockedGetRouteGeometryResult.mockResolvedValue({ status: 'miss' })
    mockedFetchDirectKmzRouteGeometry.mockResolvedValue({
      lineCode: '320',
      coordinates: [[37.77, 29.08], [37.78, 29.09]],
      source: 'direct-kmz',
    })

    renderMap()

    await waitFor(() => expect(mockedTriggerRouteGeometryGeneration).toHaveBeenCalledWith('320'))
    expect(await screen.findByTestId('route-polyline')).toBeInTheDocument()
  })

  it('shows a clear error when cache and direct KMZ fallback are unavailable', async () => {
    mockedGetRouteGeometryResult.mockResolvedValue({ status: 'miss' })
    mockedFetchDirectKmzRouteGeometry.mockRejectedValue(new Error('no geometry'))

    renderMap()

    expect(await screen.findByText('Güzergah çizilemedi')).toBeInTheDocument()
    expect(screen.queryByTestId('route-polyline')).not.toBeInTheDocument()
  })
})
