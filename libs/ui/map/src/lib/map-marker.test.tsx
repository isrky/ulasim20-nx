import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const markerInstances: Array<{
  setLngLat: ReturnType<typeof vi.fn>
  setPopup: ReturnType<typeof vi.fn>
  remove: ReturnType<typeof vi.fn>
  addTo: ReturnType<typeof vi.fn>
}> = []

vi.mock('maplibre-gl', () => {
  class Marker {
    setLngLat = vi.fn().mockReturnThis()
    setPopup = vi.fn().mockReturnThis()
    remove = vi.fn()
    addTo = vi.fn().mockReturnThis()
    constructor(_opts?: unknown) {
      markerInstances.push(this)
    }
  }
  return { Marker }
})
vi.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}))

import type { Map as MapLibreMap } from 'maplibre-gl'
import { MapMarker } from './map-marker'

const fakeMap = {} as MapLibreMap

beforeEach(() => {
  markerInstances.length = 0
})

describe('<MapMarker />', () => {
  it('creates a marker, sets its lng/lat, and removes it on unmount', () => {
    const { unmount } = render(
      <MapMarker map={fakeMap} position={{ lng: 29.08, lat: 37.77 }}>
        <span>x</span>
      </MapMarker>,
    )
    expect(markerInstances).toHaveLength(1)
    expect(markerInstances[0].setLngLat).toHaveBeenCalledWith([29.08, 37.77])
    expect(markerInstances[0].addTo).toHaveBeenCalledWith(fakeMap)
    unmount()
    expect(markerInstances[0].remove).toHaveBeenCalled()
  })

  it('updates lng/lat when position changes', () => {
    const { rerender } = render(
      <MapMarker map={fakeMap} position={{ lng: 29.08, lat: 37.77 }} />,
    )
    rerender(<MapMarker map={fakeMap} position={{ lng: 29.09, lat: 37.78 }} />)
    const m = markerInstances[0]
    expect(m.setLngLat.mock.calls.length).toBeGreaterThanOrEqual(2)
    expect(m.setLngLat).toHaveBeenLastCalledWith([29.09, 37.78])
  })

  it('fires onClick when the marker element is clicked and cleans up the listener on unmount', () => {
    const onClick = vi.fn()
    const { container, unmount } = render(
      <MapMarker map={fakeMap} position={{ lng: 29.08, lat: 37.77 }} onClick={onClick} />,
    )
    const markerEl = container.firstChild as HTMLElement
    markerEl.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(onClick).toHaveBeenCalledTimes(1)
    unmount()
    markerEl.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
