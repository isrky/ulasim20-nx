import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('maplibre-gl', () => {
  class Marker {
    setLngLat = vi.fn().mockReturnThis()
    setPopup = vi.fn().mockReturnThis()
    remove = vi.fn()
    addTo = vi.fn().mockReturnThis()
  }
  return { Marker }
})
vi.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}))

import { MapInstanceProvider } from '@ulasim20/ui-map'
import { RefillMarker, SearchHighlightMarker, UserLocationMarker } from './markers'

const mapStub = {
  flyTo: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  hasImage: vi.fn().mockReturnValue(true),
}

describe('markers', () => {
  it('renders a refill marker when a refill point is provided', () => {
    const { container } = render(
      <MapInstanceProvider value={mapStub as unknown as never}>
        <RefillMarker point={{ lat: 37.77, lng: 29.08, name: 'X', id: 1 }} onClick={() => {}} />
      </MapInstanceProvider>,
    )
    expect(container.querySelector('.refill-marker')).toBeInTheDocument()
  })

  it('flies to the search-selected stop on mount', () => {
    render(
      <MapInstanceProvider value={mapStub as unknown as never}>
        <SearchHighlightMarker stop={{ stationId: 1, stationName: 'A', lat: 37.77, lng: 29.08 }} />
      </MapInstanceProvider>,
    )
    expect(mapStub.flyTo).toHaveBeenCalledWith(expect.objectContaining({ center: [29.08, 37.77] }))
  })

  it('renders nothing when no user location is set', () => {
    const { container } = render(
      <MapInstanceProvider value={mapStub as unknown as never}>
        <UserLocationMarker position={null} />
      </MapInstanceProvider>,
    )
    expect(container.querySelector('.user-location-marker')).toBeNull()
  })
})