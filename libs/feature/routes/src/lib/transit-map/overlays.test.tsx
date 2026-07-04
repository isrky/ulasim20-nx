import { render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('maplibre-gl', () => ({ Popup: class {} }))
vi.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}))

import { MapInstanceProvider } from '@ulasim20/ui-map'

interface FakeSource {
  setData: ReturnType<typeof vi.fn>
}

interface FakeMap {
  getSource: ReturnType<typeof vi.fn>
  addSource: ReturnType<typeof vi.fn>
  getLayer: ReturnType<typeof vi.fn>
  addLayer: ReturnType<typeof vi.fn>
  loadImage: ReturnType<typeof vi.fn>
  addImage: ReturnType<typeof vi.fn>
  hasImage: ReturnType<typeof vi.fn>
  removeImage: ReturnType<typeof vi.fn>
  on: ReturnType<typeof vi.fn>
  off: ReturnType<typeof vi.fn>
  setData: ReturnType<typeof vi.fn>
  isStyleLoaded: ReturnType<typeof vi.fn>
  __sources: Map<string, FakeSource>
}

function makeFakeMap(): FakeMap {
  const sources = new Map<string, FakeSource>()
  const fake: FakeMap = {
    getSource: vi.fn((id: string) => sources.get(id)),
    addSource: vi.fn((id: string) => { sources.set(id, { setData: vi.fn() }) }),
    getLayer: vi.fn().mockReturnValue(undefined),
    addLayer: vi.fn(),
    loadImage: vi.fn((_url: string) => Promise.resolve({ data: document.createElement('img') } as { data: HTMLImageElement })),
    addImage: vi.fn(),
    hasImage: vi.fn().mockReturnValue(false),
    removeImage: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    setData: vi.fn(),
    isStyleLoaded: vi.fn().mockReturnValue(true),
    __sources: sources,
  }
  return fake
}

describe('<Overlays />', () => {
  let map: FakeMap
  beforeEach(() => { map = makeFakeMap() })
  afterEach(() => { vi.clearAllMocks() })

  it('registers stops, route-line, and vehicles sources + layers on mount', async () => {
    const { Overlays } = await import('./overlays')
    render(
      <MapInstanceProvider value={map as unknown as never}>
        <Overlays
          stops={{ type: 'FeatureCollection', features: [] }}
          routeGeometry={null}
          vehicles={{ type: 'FeatureCollection', features: [] }}
        />
      </MapInstanceProvider>,
    )
    expect(map.addSource.mock.calls.map((c) => c[0])).toEqual(
      expect.arrayContaining(['stops', 'route-line', 'vehicles']),
    )
    expect(map.addLayer.mock.calls.map((c) => c[0].id)).toEqual(
      expect.arrayContaining(['stops-clusters', 'stops-circles', 'route-line', 'vehicles-symbols']),
    )
  })

  it('updates route-line source data when routeGeometry changes', async () => {
    const { Overlays } = await import('./overlays')
    const { rerender } = render(
      <MapInstanceProvider value={map as unknown as never}>
        <Overlays
          stops={{ type: 'FeatureCollection', features: [] }}
          routeGeometry={null}
          vehicles={{ type: 'FeatureCollection', features: [] }}
        />
      </MapInstanceProvider>,
    )
    rerender(
      <MapInstanceProvider value={map as unknown as never}>
        <Overlays
          stops={{ type: 'FeatureCollection', features: [] }}
          routeGeometry={{ type: 'Feature', geometry: { type: 'LineString', coordinates: [[29.08, 37.77]] }, properties: {} }}
          vehicles={{ type: 'FeatureCollection', features: [] }}
        />
      </MapInstanceProvider>,
    )
    const routeSource = map.__sources.get('route-line')
    expect(routeSource).toBeDefined()
    const routeCalls = routeSource?.setData.mock.calls.filter((c) => c[0].type === 'Feature') ?? []
    expect(routeCalls.length).toBeGreaterThan(0)
  })
})