import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mapInstances: Array<Record<string, ReturnType<typeof vi.fn>>> = []
const loadListeners: Array<(e: unknown) => void> = []

vi.mock('maplibre-gl', () => {
  class Map {
    remove = vi.fn()
    on = vi.fn((evt: string, cb: (e: unknown) => void) => {
      if (evt === 'load') loadListeners.push(cb)
    })
    addControl = vi.fn()
    loaded = vi.fn().mockReturnValue(false)
    constructor(_opts: unknown) {
      mapInstances.push(this as unknown as Record<string, ReturnType<typeof vi.fn>>)
    }
  }
  class NavigationControl {
    // biome-ignore lint/complexity/noUselessConstructor: needed for type-compatible mock
    constructor(_opts?: unknown) {}
  }
  class ScaleControl {
    // biome-ignore lint/complexity/noUselessConstructor: needed for type-compatible mock
    constructor(_opts?: unknown) {}
  }
  return { Map, NavigationControl, ScaleControl, AttributionControl: {} }
})
vi.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}))

import { MapView } from './map-view'

beforeEach(() => {
  mapInstances.length = 0
  loadListeners.length = 0
})

describe('<MapView />', () => {
  it('creates a maplibre map on mount and removes it on unmount', () => {
    const { unmount } = render(
      <MapView center={[29.0864, 37.7765]} zoom={14}>
        <div data-testid="child" />
      </MapView>,
    )
    expect(mapInstances).toHaveLength(1)
    unmount()
    expect(mapInstances[0].remove).toHaveBeenCalled()
    expect(screen.queryByTestId('child')).toBeNull()
  })

  it('registers a load listener so the live map reaches MapInstanceProvider', () => {
    render(<MapView center={[29.0864, 37.7765]} zoom={14} />)
    const last = mapInstances.at(-1)
    expect(last).toBeDefined()
    const calls = last.on.mock.calls
    const initCall = calls.find(([evt]) => evt === 'load')
    expect(initCall).toBeDefined()
  })
})
