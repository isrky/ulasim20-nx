import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const popupInstances: Array<{
  setLngLat: ReturnType<typeof vi.fn>
  addTo: ReturnType<typeof vi.fn>
  remove: ReturnType<typeof vi.fn>
  on: ReturnType<typeof vi.fn>
  off: ReturnType<typeof vi.fn>
  setDOMContent: ReturnType<typeof vi.fn>
}> = []

vi.mock('maplibre-gl', () => {
  class Popup {
    setLngLat = vi.fn().mockReturnThis()
    addTo = vi.fn().mockReturnThis()
    remove = vi.fn()
    on = vi.fn().mockReturnThis()
    off = vi.fn().mockReturnThis()
    setDOMContent = vi.fn()
    constructor(_opts?: unknown) {
      popupInstances.push(this)
    }
  }
  return { Popup }
})
vi.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}))

import type { Map as MapLibreMap } from 'maplibre-gl'
import { MapPopup } from './map-popup'

const fakeMap = {} as MapLibreMap

beforeEach(() => {
  popupInstances.length = 0
})

describe('<MapPopup />', () => {
  it('creates a popup, anchors it, wires children into the popup, and removes it on unmount', () => {
    const { unmount } = render(
      <MapPopup
        map={fakeMap}
        anchor={{ lng: 29.08, lat: 37.77 }}
        onClose={() => {}}
      >
        <span data-testid="popup-child">hi</span>
      </MapPopup>,
    )
    expect(popupInstances).toHaveLength(1)
    expect(popupInstances[0].setLngLat).toHaveBeenCalledWith([29.08, 37.77])
    expect(popupInstances[0].addTo).toHaveBeenCalledWith(fakeMap)
    expect(popupInstances[0].setDOMContent).toHaveBeenCalledTimes(1)
    const container = popupInstances[0].setDOMContent.mock.calls[0][0] as HTMLElement
    expect(container.contains(container.querySelector('[data-testid="popup-child"]'))).toBe(true)
    expect(container.textContent).toContain('hi')
    unmount()
    expect(popupInstances[0].remove).toHaveBeenCalled()
  })

  it('updates the anchor lng/lat when position changes', () => {
    const { rerender } = render(
      <MapPopup
        map={fakeMap}
        anchor={{ lng: 29.08, lat: 37.77 }}
        onClose={() => {}}
      />,
    )
    rerender(
      <MapPopup
        map={fakeMap}
        anchor={{ lng: 29.09, lat: 37.78 }}
        onClose={() => {}}
      />,
    )
    const p = popupInstances[0]
    expect(p.setLngLat.mock.calls.length).toBeGreaterThanOrEqual(2)
    expect(p.setLngLat).toHaveBeenLastCalledWith([29.09, 37.78])
  })

  it('registers onClose on the popup and removes it on prop change', () => {
    const onCloseA = vi.fn()
    const onCloseB = vi.fn()
    const { rerender } = render(
      <MapPopup
        map={fakeMap}
        anchor={{ lng: 29.08, lat: 37.77 }}
        onClose={onCloseA}
      >
        x
      </MapPopup>,
    )
    expect(popupInstances[0].on).toHaveBeenCalledWith('close', onCloseA)
    rerender(
      <MapPopup
        map={fakeMap}
        anchor={{ lng: 29.08, lat: 37.77 }}
        onClose={onCloseB}
      >
        x
      </MapPopup>,
    )
    expect(popupInstances[0].off).toHaveBeenCalledWith('close', onCloseA)
    expect(popupInstances[0].on).toHaveBeenCalledWith('close', onCloseB)
  })
})
