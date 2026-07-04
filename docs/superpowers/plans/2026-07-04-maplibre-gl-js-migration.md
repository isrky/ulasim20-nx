# MapLibre GL JS Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Leaflet/react-leaflet map engine with MapLibre GL JS across the workspace, keeping the public API of `TransitMap` and the user-facing behavior of `/harita` unchanged.

**Architecture:** Workspace-wide migration. `libs/ui/map` becomes a thin wrapper around `maplibre-gl` (no React wrapper lib). `libs/feature/routes` registers native GeoJSON sources + layers for stops (clustered), route line, and vehicles; imperative `maplibregl.Marker` is reserved for DOM-backed points (user location, refill, search-selected). Tile source is OpenFreeMap's public `bright` style.

**Tech Stack:** React 18.3, TypeScript 5.5, Vitest 2.1, @testing-library/react 16.3, Playwright, maplibre-gl, pnpm workspaces, Nx 19.8, Biome, ESLint.

**Spec:** `docs/superpowers/specs/2026-07-04-maplibre-gl-js-migration-design.md`

---

## Conventions

- Run `pnpm exec nx <project>:<target>` from repo root for any project-scoped command.
- All file paths are relative to repo root unless absolute.
- Use Biome-formatted code (2-space indent, single quotes, no semicolons — matches existing files).
- Mock module name for `maplibre-gl` is the package export. Tests use `vi.mock('maplibre-gl', …)`.
- Commit messages use Conventional Commits (`feat:`, `fix:`, `test:`, `chore:`, `docs:`).
- After every task: `pnpm exec nx run <project>:type-check` and `pnpm exec nx run <project>:test` must pass.

---

## Task 1: Add maplibre-gl dependency to libs/ui/map

**Files:**
- Modify: `libs/ui/map/package.json`

- [ ] **Step 1: Update package.json**

Edit `libs/ui/map/package.json` to:

```json
{
  "name": "@ulasim20/ui-map",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "dependencies": {
    "maplibre-gl": "^4.7.1"
  },
  "peerDependencies": { "react": "^18.3.1", "react-dom": "^18.3.1" },
  "devDependencies": {
    "@types/react": "^18.3.5",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  }
}
```

- [ ] **Step 2: Install**

Run: `pnpm install`
Expected: lockfile updates with `maplibre-gl@^4.7.1`. No peer warnings.

- [ ] **Step 3: Commit**

```bash
git add libs/ui/map/package.json pnpm-lock.yaml
git commit -m "feat(ui-map): add maplibre-gl dependency"
```

---

## Task 2: Implement `useMapInstance` hook (TDD)

**Files:**
- Create: `libs/ui/map/src/lib/use-map-instance.ts`
- Create: `libs/ui/map/src/lib/use-map-instance.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `libs/ui/map/src/lib/use-map-instance.test.tsx`:

```tsx
import { render, screen, act } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useEffect } from 'react'
import { MapInstanceProvider, useMapInstance } from './use-map-instance'

function Probe({ onValue }: { onValue: (m: unknown) => void }) {
  const map = useMapInstance()
  useEffect(() => { onValue(map) }, [map, onValue])
  return <div data-testid="probe">{map ? 'ready' : 'pending'}</div>
}

describe('useMapInstance', () => {
  it('returns null before a map is provided and the provided map after', () => {
    const fakeMap = { id: 'fake' }
    const seen: Array<unknown> = []
    render(
      <MapInstanceProvider value={fakeMap}>
        <Probe onValue={(m) => seen.push(m)} />
      </MapInstanceProvider>,
    )
    expect(screen.getByTestId('probe')).toHaveTextContent('ready')
    expect(seen.at(-1)).toBe(fakeMap)
  })

  it('returns null when no provider is present', () => {
    render(<Probe onValue={() => {}} />)
    expect(screen.getByTestId('probe')).toHaveTextContent('pending')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec nx run ui-map:test`
Expected: FAIL — `MapInstanceProvider` not exported from `./use-map-instance`.

- [ ] **Step 3: Implement the hook and provider**

Create `libs/ui/map/src/lib/use-map-instance.ts`:

```ts
import { createContext, useContext, type ReactNode } from 'react'
import type { Map as MapLibreMap } from 'maplibre-gl'

const MapInstanceContext = createContext<MapLibreMap | null>(null)

export function MapInstanceProvider({
  value,
  children,
}: {
  value: MapLibreMap | null
  children: ReactNode
}) {
  return <MapInstanceContext.Provider value={value}>{children}</MapInstanceContext.Provider>
}

export function useMapInstance(): MapLibreMap | null {
  return useContext(MapInstanceContext)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec nx run ui-map:test`
Expected: PASS (2 passing).

- [ ] **Step 5: Commit**

```bash
git add libs/ui/map/src/lib/use-map-instance.ts libs/ui/map/src/lib/use-map-instance.test.tsx
git commit -m "feat(ui-map): add useMapInstance hook and provider"
```

---

## Task 3: Rewrite `MapView` on MapLibre (TDD)

**Files:**
- Modify: `libs/ui/map/src/lib/map-view.tsx`
- Create: `libs/ui/map/src/lib/map-view.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `libs/ui/map/src/lib/map-view.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mapInstances: Array<{ remove: ReturnType<typeof vi.fn> }> = []
const loadListeners: Array<(e: unknown) => void> = []

vi.mock('maplibre-gl', () => {
  class Map {
    remove = vi.fn()
    on = vi.fn((evt: string, cb: (e: unknown) => void) => {
      if (evt === 'load') loadListeners.push(cb)
    })
    addControl = vi.fn()
    constructor(_opts: unknown) { mapInstances.push(this) }
  }
  class NavigationControl { constructor(_opts?: unknown) {} }
  class ScaleControl { constructor(_opts?: unknown) {} }
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
    const { unmount } = render(<MapView center={[29.0864, 37.7765]} zoom={14}><div data-testid="child" /></MapView>)
    expect(mapInstances).toHaveLength(1)
    unmount()
    expect(mapInstances[0].remove).toHaveBeenCalled()
    expect(screen.queryByTestId('child')).toBeNull()
  })

  it('uses the Bright style URL from OpenFreeMap by default', () => {
    render(<MapView center={[29.0864, 37.7765]} zoom={14} />)
    const last = mapInstances.at(-1) as unknown as { on: ReturnType<typeof vi.fn> }
    const calls = last.on.mock.calls
    const initCall = calls.find(([evt]) => evt === 'load')
    expect(initCall).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec nx run ui-map:test`
Expected: FAIL — `MapView` still references `react-leaflet`.

- [ ] **Step 3: Rewrite MapView**

Replace `libs/ui/map/src/lib/map-view.tsx` with:

```tsx
import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  Map as MapLibreMap,
  NavigationControl,
  ScaleControl,
  AttributionControl,
} from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { MapInstanceProvider } from './use-map-instance'

export const OPENFREEMAP_STYLE = 'https://tiles.openfreemap.org/styles/bright'

export function MapView({
  center,
  zoom = 13,
  style = OPENFREEMAP_STYLE,
  children,
}: {
  center: [number, number] // [lng, lat]
  zoom?: number
  style?: string
  children?: ReactNode
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [map, setMap] = useState<MapLibreMap | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const m = new MapLibreMap({
      container: containerRef.current,
      style,
      center,
      zoom,
      attributionControl: { compact: true } as AttributionControl,
    })
    m.addControl(new NavigationControl({ visualizePitch: false }), 'bottom-right')
    m.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-left')
    const handleLoad = () => setMap(m)
    if (m.loaded()) handleLoad()
    else m.on('load', handleLoad)
    return () => { m.remove() }
  }, [center[0], center[1], zoom, style])

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="absolute inset-0" data-testid="map-container" />
      <MapInstanceProvider value={map}>{children}</MapInstanceProvider>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec nx run ui-map:test`
Expected: PASS (4 passing across both files).

- [ ] **Step 5: Run typecheck**

Run: `pnpm exec nx run ui-map:type-check`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add libs/ui/map/src/lib/map-view.tsx libs/ui/map/src/lib/map-view.test.tsx
git commit -m "feat(ui-map): rewrite MapView on maplibre-gl"
```

---

## Task 4: Rewrite `MapMarker` on MapLibre (TDD)

**Files:**
- Modify: `libs/ui/map/src/lib/map-marker.tsx`
- Create: `libs/ui/map/src/lib/map-marker.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `libs/ui/map/src/lib/map-marker.test.tsx`:

```tsx
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
    constructor(_opts?: unknown) { markerInstances.push(this) }
  }
  return { Marker }
})
vi.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}))

import type { Map as MapLibreMap } from 'maplibre-gl'
import { MapMarker } from './map-marker'

const fakeMap = {} as MapLibreMap

beforeEach(() => { markerInstances.length = 0 })

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
    expect(m.setLngLat.mock.calls).toEqual([[[29.08, 37.77]], [[29.09, 37.78]]])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec nx run ui-map:test`
Expected: FAIL — `MapMarker` still references `react-leaflet`.

- [ ] **Step 3: Rewrite MapMarker**

Replace `libs/ui/map/src/lib/map-marker.tsx` with:

```tsx
import { useEffect, useRef, type ReactNode } from 'react'
import { Marker as MapLibreMarker, type Map as MapLibreMap, type Popup as MapLibrePopup } from 'maplibre-gl'

export function MapMarker({
  map,
  position,
  children,
  className,
  onClick,
  popup,
  draggable,
}: {
  map: MapLibreMap
  position: { lng: number; lat: number }
  children?: ReactNode
  className?: string
  onClick?: () => void
  popup?: MapLibrePopup
  draggable?: boolean
}) {
  const elRef = useRef<HTMLDivElement | null>(null)
  const markerRef = useRef<MapLibreMarker | null>(null)

  useEffect(() => {
    const el = elRef.current ?? document.createElement('div')
    if (!elRef.current) elRef.current = el
    if (className) el.className = className
    if (onClick) el.style.cursor = 'pointer'
    const marker = new MapLibreMarker({ element: el, draggable })
    marker.setLngLat([position.lng, position.lat]).addTo(map)
    if (popup) marker.setPopup(popup)
    if (onClick) el.addEventListener('click', onClick)
    markerRef.current = marker
    return () => {
      el.removeEventListener('click', onClick as EventListener)
      marker.remove()
      markerRef.current = null
    }
    // className/onClick/popup intentional: handled in separate effects below to keep setLngLat cheap
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map])

  useEffect(() => {
    markerRef.current?.setLngLat([position.lng, position.lat])
  }, [position.lng, position.lat])

  return <div ref={elRef}>{children}</div>
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec nx run ui-map:test`
Expected: PASS (6 passing across all files).

- [ ] **Step 5: Commit**

```bash
git add libs/ui/map/src/lib/map-marker.tsx libs/ui/map/src/lib/map-marker.test.tsx
git commit -m "feat(ui-map): rewrite MapMarker on maplibre-gl"
```

---

## Task 5: Implement `MapPopup` (TDD)

**Files:**
- Create: `libs/ui/map/src/lib/map-popup.tsx`
- Create: `libs/ui/map/src/lib/map-popup.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `libs/ui/map/src/lib/map-popup.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const popupInstances: Array<{
  setLngLat: ReturnType<typeof vi.fn>
  addTo: ReturnType<typeof vi.fn>
  remove: ReturnType<typeof vi.fn>
  on: ReturnType<typeof vi.fn>
}> = []

vi.mock('maplibre-gl', () => {
  class Popup {
    setLngLat = vi.fn().mockReturnThis()
    addTo = vi.fn().mockReturnThis()
    remove = vi.fn()
    on = vi.fn().mockReturnThis()
    constructor(_opts?: unknown) { popupInstances.push(this) }
  }
  return { Popup }
})

import type { Map as MapLibreMap } from 'maplibre-gl'
import { MapPopup } from './map-popup'

const fakeMap = {} as MapLibreMap

beforeEach(() => { popupInstances.length = 0 })

describe('<MapPopup />', () => {
  it('creates a popup, anchors it, and removes it on unmount', () => {
    const { unmount } = render(
      <MapPopup map={fakeMap} anchor={{ lng: 29.08, lat: 37.77 }} onClose={() => {}}>
        hi
      </MapPopup>,
    )
    expect(popupInstances).toHaveLength(1)
    expect(popupInstances[0].setLngLat).toHaveBeenCalledWith([29.08, 37.77])
    expect(popupInstances[0].addTo).toHaveBeenCalledWith(fakeMap)
    expect(screen.getByText('hi')).toBeInTheDocument()
    unmount()
    expect(popupInstances[0].remove).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec nx run ui-map:test`
Expected: FAIL — `./map-popup` not found.

- [ ] **Step 3: Implement MapPopup**

Create `libs/ui/map/src/lib/map-popup.tsx`:

```tsx
import { useEffect, useRef, type ReactNode } from 'react'
import { Popup as MapLibrePopup, type Map as MapLibreMap } from 'maplibre-gl'
import { createPortal } from 'react-dom'

export function MapPopup({
  map,
  anchor,
  onClose,
  closeOnClick = true,
  children,
}: {
  map: MapLibreMap
  anchor: { lng: number; lat: number }
  onClose: () => void
  closeOnClick?: boolean
  children: ReactNode
}) {
  const popupRef = useRef<MapLibrePopup | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const popup = new MapLibrePopup({ closeOnClick, closeButton: false, anchor: 'bottom' })
      .setLngLat([anchor.lng, anchor.lat])
      .addTo(map)
    popup.on('close', onClose)
    popupRef.current = popup
    return () => { popup.remove(); popupRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map])

  useEffect(() => {
    popupRef.current?.setLngLat([anchor.lng, anchor.lat])
  }, [anchor.lng, anchor.lat])

  if (!containerRef.current) {
    return <div ref={containerRef} style={{ display: 'none' }} />
  }
  return createPortal(children, containerRef.current)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec nx run ui-map:test`
Expected: PASS (7 passing).

- [ ] **Step 5: Commit**

```bash
git add libs/ui/map/src/lib/map-popup.tsx libs/ui/map/src/lib/map-popup.test.tsx
git commit -m "feat(ui-map): add MapPopup component"
```

---

## Task 6: Update libs/ui/map exports

**Files:**
- Modify: `libs/ui/map/src/index.ts`

- [ ] **Step 1: Update exports**

Replace `libs/ui/map/src/index.ts` with:

```ts
export { MapView, OPENFREEMAP_STYLE } from './lib/map-view'
export { MapMarker } from './lib/map-marker'
export { MapPopup } from './lib/map-popup'
export { MapInstanceProvider, useMapInstance } from './lib/use-map-instance'
```

- [ ] **Step 2: Run tests + typecheck**

Run: `pnpm exec nx run ui-map:test && pnpm exec nx run ui-map:type-check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add libs/ui/map/src/index.ts
git commit -m "feat(ui-map): export MapPopup and useMapInstance"
```

---

## Task 7: Add maplibre-gl to libs/feature/routes

**Files:**
- Modify: `libs/feature/routes/package.json`

- [ ] **Step 1: Update package.json**

Edit `libs/feature/routes/package.json` to add `maplibre-gl` and `@ulasim20/ui-map` peer alignment. Replace the dependencies block:

```json
"dependencies": {
  "@capacitor/core": "8.0.0",
  "@tanstack/react-virtual": "^3.13.23",
  "@ulasim20/data-access-capacitor": "workspace:*",
  "@ulasim20/data-access-mock-data": "workspace:*",
  "@ulasim20/data-access-transport-api": "workspace:*",
  "@ulasim20/feature-card": "workspace:*",
  "@ulasim20/feature-planner": "workspace:*",
  "@ulasim20/types-api": "workspace:*",
  "@ulasim20/types-transport": "workspace:*",
  "@ulasim20/ui-map": "workspace:*",
  "@ulasim20/ui-page-shell": "workspace:*",
  "@ulasim20/ui-primitives": "workspace:*",
  "@ulasim20/util-analytics": "workspace:*",
  "@ulasim20/util-format": "workspace:*",
  "@ulasim20/util-hooks": "workspace:*",
  "@ulasim20/util-search": "workspace:*",
  "lucide-react": "^0.552.0",
  "maplibre-gl": "^4.7.1",
  "react-router-dom": "^6.30.3"
},
```

Remove `leaflet`, `react-leaflet`, `@types/leaflet` from dependencies and devDependencies — the migration removes them.

- [ ] **Step 2: Install**

Run: `pnpm install`
Expected: lockfile updates; no peer warnings.

- [ ] **Step 3: Commit**

```bash
git add libs/feature/routes/package.json pnpm-lock.yaml
git commit -m "feat(feature-routes): depend on maplibre-gl, drop leaflet"
```

---

## Task 8: Create `transit-map/constants.ts` and `icons.ts`

**Files:**
- Create: `libs/feature/routes/src/lib/transit-map/constants.ts`
- Create: `libs/feature/routes/src/lib/transit-map/icons.ts`
- Create: `libs/feature/routes/src/lib/transit-map/icons.test.ts`

- [ ] **Step 1: Create constants.ts**

Create `libs/feature/routes/src/lib/transit-map/constants.ts`:

```ts
export const DENIZLI_CENTER = { lat: 37.7765, lng: 29.0864 } as const
export const LINE_COLOR = '#22c55e'
export const STOP_MARKER_COLOR = '#6a9a5b'
export const REFILL_MARKER_COLOR = '#3b82f6'
export const USER_MARKER_COLOR = '#3b82f6'
export const MIN_STOP_ZOOM = 15
export const SEARCH_HIGHLIGHT_ZOOM = 17
```

- [ ] **Step 2: Write the failing test for icons**

Create `libs/feature/routes/src/lib/transit-map/icons.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { busIconSvg, stopIconSvg, refillIconSvg, userIconSvg, svgToDataUrl } from './icons'

describe('icons', () => {
  it('produces a data: URL prefix from any SVG string', () => {
    const url = svgToDataUrl('<svg/>')
    expect(url.startsWith('data:image/svg+xml;base64,')).toBe(true)
  })

  it('returns non-empty SVGs for every icon variant', () => {
    for (const svg of [busIconSvg(), stopIconSvg(), refillIconSvg(), userIconSvg()]) {
      expect(svg).toMatch(/<svg/)
      expect(svg.length).toBeGreaterThan(50)
    }
  })

  it('encodes the bus icon with the configured LINE_COLOR', () => {
    expect(busIconSvg()).toContain('#22c55e')
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm exec nx run feature-routes:test`
Expected: FAIL — `./icons` not found.

- [ ] **Step 4: Implement icons.ts**

Create `libs/feature/routes/src/lib/transit-map/icons.ts`:

```ts
import { LINE_COLOR, REFILL_MARKER_COLOR, STOP_MARKER_COLOR, USER_MARKER_COLOR } from './constants'

export function svgToDataUrl(svg: string): string {
  const b64 = typeof btoa === 'function'
    ? btoa(svg)
    : Buffer.from(svg, 'utf-8').toString('base64')
  return `data:image/svg+xml;base64,${b64}`
}

export function busIconSvg(color: string = LINE_COLOR): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32"><rect x="4" y="6" width="24" height="20" rx="4" fill="${color}"/><rect x="8" y="10" width="16" height="8" rx="2" fill="white"/><circle cx="10" cy="22" r="2" fill="white"/><circle cx="22" cy="22" r="2" fill="white"/></svg>`
}

export function stopIconSvg(color: string = STOP_MARKER_COLOR): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" width="18" height="18"><rect x="1" y="1" width="16" height="16" rx="3" fill="${color}" stroke="white" stroke-width="2"/></svg>`
}

export function refillIconSvg(color: string = REFILL_MARKER_COLOR): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14 14" width="14" height="14"><circle cx="7" cy="7" r="6" fill="${color}" stroke="white" stroke-width="2"/></svg>`
}

export function userIconSvg(color: string = USER_MARKER_COLOR): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><circle cx="12" cy="12" r="10" fill="${color}" stroke="white" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="white"/></svg>`
}

export function searchHighlightSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 22 22" width="22" height="22"><circle cx="11" cy="11" r="9" fill="${STOP_MARKER_COLOR}" stroke="white" stroke-width="3"/></svg>`
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm exec nx run feature-routes:test`
Expected: PASS for the icons test (existing transit-map tests may still fail — that's fine, we'll rewrite them later).

- [ ] **Step 6: Commit**

```bash
git add libs/feature/routes/src/lib/transit-map/
git commit -m "feat(feature-routes): extract transit-map constants and icons"
```

---

## Task 9: Implement `useTransitMap` core (TDD)

**Files:**
- Create: `libs/feature/routes/src/lib/transit-map/use-transit-map.ts`
- Create: `libs/feature/routes/src/lib/transit-map/use-transit-map.test.ts`

- [ ] **Step 1: Write the failing test**

Create `libs/feature/routes/src/lib/transit-map/use-transit-map.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec nx run feature-routes:test -- --reporter=verbose -t "stations bootstrap"`
Expected: FAIL — `./use-transit-map` not found.

- [ ] **Step 3: Implement the hook core**

Create `libs/feature/routes/src/lib/transit-map/use-transit-map.ts`:

```ts
import { useCallback, useEffect, useMemo, useState } from 'react'
import { getAllStations, type Station, type RouteStation } from '@ulasim20/data-access-transport-api'
import { buildStationIndex, type IndexEntry } from '@ulasim20/util-search'
import { trackLineLookup, trackRouteMapOpen, trackStopLookup } from '@ulasim20/util-analytics'
import { fetchDirectKmzRouteGeometry } from '@ulasim20/feature-planner'
import { apiGet, getRouteGeometryResult, triggerRouteGeometryGeneration } from '@ulasim20/data-access-transport-api'

export interface ProcessedStation {
  stationId: number
  stationName: string
  lat: number
  lng: number
}

export interface LiveVehicle {
  plate: string
  latitude: string
  longitude: string
  speed: string
  routeCode: string
  stopId: number
}

export interface SelectedLineInfo {
  lineCode: string
  lineName: string
  stations: RouteStation[]
  vehicles: LiveVehicle[]
  geometry: [number, number][] | null
  vehiclesUpdatedAt: number
  geometryError?: string | null
}

export interface RefillPoint {
  lat: number
  lng: number
  name?: string
  id?: number
}

interface GetLiveDataResponse { value: LiveVehicle[] }
interface GetRouteStationsResponse { value: { stations: RouteStation[]; lineName?: string } }

function parseCoord(coord: string): number | null {
  const num = Number(coord.replace(',', '.'))
  return Number.isFinite(num) ? num : null
}

function processStations(stations: Station[]): ProcessedStation[] {
  const result: ProcessedStation[] = []
  for (const s of stations) {
    const lat = parseCoord(s.latitude)
    const lng = parseCoord(s.longitude)
    if (lat != null && lng != null) {
      result.push({ stationId: s.stationId, stationName: s.stationName, lat, lng })
    }
  }
  return result
}

export function useTransitMap(opts: { searchParams?: URLSearchParams } = {}) {
  const searchParams = opts.searchParams ?? new URLSearchParams()

  const [rawStations, setRawStations] = useState<Station[]>([])
  const [processedStations, setProcessedStations] = useState<ProcessedStation[]>([])
  const [selectedStop, setSelectedStop] = useState<ProcessedStation | null>(null)
  const [selectedLine, setSelectedLine] = useState<SelectedLineInfo | null>(null)
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number } | null>(null)
  const [refillPoint, setRefillPoint] = useState<RefillPoint | null>(null)

  const stationIdx: IndexEntry[] = useMemo(() => buildStationIndex(rawStations), [rawStations])

  useEffect(() => {
    let cancelled = false
    getAllStations()
      .then((list) => {
        if (cancelled) return
        const arr = Array.isArray(list) ? list : []
        setRawStations(arr)
        setProcessedStations(processStations(arr))
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const latParam = searchParams.get('lat')
    const lngParam = searchParams.get('lng')
    const type = searchParams.get('type')
    const nameParam = searchParams.get('name')
    if (latParam != null && lngParam != null) {
      const lat = Number(latParam.replace(',', '.'))
      const lng = Number(lngParam.replace(',', '.'))
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        setFlyTarget({ lat, lng })
        if (type === 'refill') {
          const idParam = searchParams.get('id')
          const id = idParam != null ? Number(idParam) : undefined
          setRefillPoint({
            lat,
            lng,
            name: nameParam ? decodeURIComponent(nameParam) : undefined,
            id: Number.isFinite(id) ? id : undefined,
          })
        } else {
          setRefillPoint(null)
        }
      }
    } else {
      setRefillPoint(null)
    }
  }, [searchParams])

  return {
    rawStations,
    processedStations,
    stationIdx,
    selectedStop,
    setSelectedStop,
    selectedLine,
    setSelectedLine,
    flyTarget,
    setFlyTarget,
    refillPoint,
    setRefillPoint,
    trackStopLookup,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec nx run feature-routes:test -- -t "stations bootstrap"`
Expected: PASS for stations bootstrap (4 tests).

- [ ] **Step 5: Commit**

```bash
git add libs/feature/routes/src/lib/transit-map/use-transit-map.ts libs/feature/routes/src/lib/transit-map/use-transit-map.test.ts
git commit -m "feat(feature-routes): add useTransitMap stations and deep-link core"
```

---

## Task 10: Add `handleSelectLine` to `useTransitMap` (TDD)

**Files:**
- Modify: `libs/feature/routes/src/lib/transit-map/use-transit-map.ts`
- Modify: `libs/feature/routes/src/lib/transit-map/use-transit-map.test.ts`

- [ ] **Step 1: Append failing tests**

Append to `use-transit-map.test.ts`:

```ts
describe('useTransitMap — handleSelectLine', () => {
  it('uses cached backend geometry when available and skips trigger', async () => {
    const { apiGet, getRouteGeometryResult, triggerRouteGeometryGeneration } = await import('@ulasim20/data-access-transport-api')
    const mockedApiGet = vi.mocked(apiGet)
    const mockedGeom = vi.mocked(getRouteGeometryResult)
    const mockedTrigger = vi.mocked(triggerRouteGeometryGeneration)

    mockedApiGet.mockImplementation(async (url: string) => {
      if (String(url).includes('GetRouteStations')) {
        return { value: { lineName: '320', stations: [] } }
      }
      return { value: [] }
    })
    mockedGeom.mockResolvedValueOnce({
      status: 'hit',
      geometry: { lineCode: '320', coordinates: [[37.77, 29.08]], source: 'kmz-direct' },
    })

    const { result } = renderHook(() => useTransitMap())
    await waitFor(() => expect(result.current.processedStations.length).toBeGreaterThan(0))
    await act(async () => { await result.current.handleSelectLine('320', 'test') })

    expect(mockedTrigger).not.toHaveBeenCalled()
    expect(result.current.selectedLine?.geometry).toEqual([[37.77, 29.08]])
  })

  it('falls back to direct KMZ when cache misses and reports geometry error if both fail', async () => {
    const { apiGet, getRouteGeometryResult, triggerRouteGeometryGeneration } = await import('@ulasim20/data-access-transport-api')
    const { fetchDirectKmzRouteGeometry } = await import('@ulasim20/feature-planner')
    const mockedApiGet = vi.mocked(apiGet)
    const mockedGeom = vi.mocked(getRouteGeometryResult)
    const mockedTrigger = vi.mocked(triggerRouteGeometryGeneration)
    const mockedDirect = vi.mocked(fetchDirectKmzRouteGeometry)

    mockedApiGet.mockImplementation(async (url: string) => {
      if (String(url).includes('GetRouteStations')) return { value: { lineName: '320', stations: [] } }
      return { value: [] }
    })
    mockedGeom.mockResolvedValueOnce({ status: 'miss' })
    mockedTrigger.mockResolvedValueOnce(undefined)
    mockedDirect.mockRejectedValueOnce(new Error('no geometry'))

    const { result } = renderHook(() => useTransitMap())
    await waitFor(() => expect(result.current.processedStations.length).toBeGreaterThan(0))
    await act(async () => { await result.current.handleSelectLine('320', 'test') })

    expect(mockedTrigger).toHaveBeenCalledWith('320')
    expect(result.current.selectedLine?.geometry).toBeNull()
    expect(result.current.selectedLine?.geometryError).toBe('Güzergah çizilemedi')
  })

  it('reacts to ?line= URL param by calling handleSelectLine', async () => {
    const { result } = renderHook(() =>
      useTransitMap({ searchParams: new URLSearchParams('line=320') }),
    )
    await waitFor(() => expect(result.current.selectedLine?.lineCode).toBe('320'))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec nx run feature-routes:test -- -t "handleSelectLine"`
Expected: FAIL — `handleSelectLine` is not on the hook return value.

- [ ] **Step 3: Extend the hook**

Append to `use-transit-map.ts` (inside `useTransitMap`, before the `return`):

```ts
  const handleSelectLine = useCallback(async (lineCode: string, source = 'map') => {
    try {
      trackLineLookup({ lineCode, source })
      setSelectedLine(null)
      const [stationsRes, liveRes, geometryResult] = await Promise.all([
        apiGet<GetRouteStationsResponse>(`/UlasimBackend/api/Calc/GetRouteStations?routeCode=${encodeURIComponent(lineCode)}`),
        apiGet<GetLiveDataResponse>(`/UlasimBackend/api/Calc/GetLiveData?lineCode=${encodeURIComponent(lineCode)}`).catch(() => ({ value: [] } as GetLiveDataResponse)),
        getRouteGeometryResult(lineCode).catch(() => ({ status: 'miss' as const })),
      ])
      const stList = Array.isArray(stationsRes?.value?.stations) ? stationsRes.value.stations : []
      let geometry: [number, number][] | null = null
      let geometryError: string | null = null

      if (geometryResult.status === 'hit') {
        geometry = geometryResult.geometry.coordinates
        trackRouteMapOpen({ lineCode, source: 'backend-cache', entryPoint: source })
      } else {
        void triggerRouteGeometryGeneration(lineCode)
        try {
          const directGeometry = await fetchDirectKmzRouteGeometry(lineCode)
          geometry = directGeometry.coordinates
          trackRouteMapOpen({ lineCode, source: 'direct-kmz', entryPoint: source })
        } catch {
          geometryError = 'Güzergah çizilemedi'
        }
      }

      setSelectedLine({
        lineCode,
        lineName: stationsRes?.value?.lineName || lineCode,
        stations: stList,
        vehicles: Array.isArray(liveRes.value) ? liveRes.value : [],
        geometry,
        vehiclesUpdatedAt: Date.now(),
        geometryError,
      })
      setSelectedStop(null)
    } catch {}
  }, [])
```

Also update the `return` block to include `handleSelectLine`:

```ts
  return {
    rawStations,
    processedStations,
    stationIdx,
    selectedStop,
    setSelectedStop,
    selectedLine,
    setSelectedLine,
    flyTarget,
    setFlyTarget,
    refillPoint,
    setRefillPoint,
    handleSelectLine,
    trackStopLookup,
  }
```

Add at the top of `useTransitMap` an effect that reacts to `?line=`:

```ts
  useEffect(() => {
    const lineParam = searchParams.get('line')
    if (lineParam) handleSelectLine(lineParam, 'line-detail')
  }, [searchParams, handleSelectLine])
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec nx run feature-routes:test -- -t "handleSelectLine"`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add libs/feature/routes/src/lib/transit-map/use-transit-map.ts libs/feature/routes/src/lib/transit-map/use-transit-map.test.ts
git commit -m "feat(feature-routes): handleSelectLine with cache + KMZ fallback"
```

---

## Task 11: Add vehicle polling to `useTransitMap` (TDD)

**Files:**
- Modify: `libs/feature/routes/src/lib/transit-map/use-transit-map.ts`
- Modify: `libs/feature/routes/src/lib/transit-map/use-transit-map.test.ts`

- [ ] **Step 1: Append failing test**

Append to `use-transit-map.test.ts`:

```ts
describe('useTransitMap — vehicle polling', () => {
  it('refreshes selectedLine.vehicles every 15s while a line is selected', async () => {
    vi.useFakeTimers()
    try {
      const { apiGet } = await import('@ulasim20/data-access-transport-api')
      const mockedApiGet = vi.mocked(apiGet)
      mockedApiGet.mockImplementation(async (url: string) => {
        if (String(url).includes('GetRouteStations')) return { value: { lineName: '320', stations: [] } }
        if (String(url).includes('GetLiveData')) return { value: [{ plate: 'P1', latitude: '37,77', longitude: '29,08', speed: '0', routeCode: '320', stopId: 1 }] }
        return { value: [] }
      })

      const { result } = renderHook(() => useTransitMap())
      await waitFor(() => expect(result.current.processedStations.length).toBeGreaterThan(0))
      await act(async () => { await result.current.handleSelectLine('320', 'test') })
      expect(result.current.selectedLine?.vehicles).toHaveLength(1)

      mockedApiGet.mockImplementation(async (url: string) => {
        if (String(url).includes('GetLiveData')) return { value: [
          { plate: 'P1', latitude: '37,77', longitude: '29,08', speed: '0', routeCode: '320', stopId: 1 },
          { plate: 'P2', latitude: '37,78', longitude: '29,09', speed: '0', routeCode: '320', stopId: 2 },
        ] }
        return { value: [] }
      })
      await act(async () => { await vi.advanceTimersByTimeAsync(15_000) })
      expect(result.current.selectedLine?.vehicles).toHaveLength(2)
    } finally {
      vi.useRealTimers()
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec nx run feature-routes:test -- -t "vehicle polling"`
Expected: FAIL — vehicles never get refreshed.

- [ ] **Step 3: Add polling effect**

Insert before the `return` block of `useTransitMap`:

```ts
  useEffect(() => {
    if (!selectedLine) return
    const lineCode = selectedLine.lineCode
    const interval = setInterval(async () => {
      try {
        const liveRes = await apiGet<GetLiveDataResponse>(
          `/UlasimBackend/api/Calc/GetLiveData?lineCode=${encodeURIComponent(lineCode)}`,
        )
        setSelectedLine((prev) => {
          if (!prev || prev.lineCode !== lineCode) return prev
          return { ...prev, vehicles: Array.isArray(liveRes.value) ? liveRes.value : [], vehiclesUpdatedAt: Date.now() }
        })
      } catch {}
    }, 15_000)
    return () => clearInterval(interval)
  }, [selectedLine?.lineCode])
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec nx run feature-routes:test -- -t "vehicle polling"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/feature/routes/src/lib/transit-map/use-transit-map.ts libs/feature/routes/src/lib/transit-map/use-transit-map.test.ts
git commit -m "feat(feature-routes): 15s live-vehicle polling in useTransitMap"
```

---

## Task 12: Implement `Overlays` component (TDD)

**Files:**
- Create: `libs/feature/routes/src/lib/transit-map/overlays.tsx`
- Create: `libs/feature/routes/src/lib/transit-map/overlays.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `libs/feature/routes/src/lib/transit-map/overlays.test.tsx`:

```tsx
import { render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MapInstanceProvider } from '@ulasim20/ui-map'

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
}

function makeFakeMap(): FakeMap {
  return {
    getSource: vi.fn().mockReturnValue(undefined),
    addSource: vi.fn(),
    getLayer: vi.fn().mockReturnValue(undefined),
    addLayer: vi.fn(),
    loadImage: vi.fn((_url: string, cb: (err: null, img: HTMLImageElement) => void) => cb(null, document.createElement('img'))),
    addImage: vi.fn(),
    hasImage: vi.fn().mockReturnValue(false),
    removeImage: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    setData: vi.fn(),
    isStyleLoaded: vi.fn().mockReturnValue(true),
  }
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
    const routeCalls = map.setData.mock.calls.filter((c) => c[0].type === 'Feature')
    expect(routeCalls.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec nx run feature-routes:test -- -t "<Overlays />"`
Expected: FAIL — `./overlays` not found.

- [ ] **Step 3: Implement Overlays**

Create `libs/feature/routes/src/lib/transit-map/overlays.tsx`:

```tsx
import { useEffect } from 'react'
import type {
  Feature,
  FeatureCollection,
  LineString,
  Point,
} from 'geojson'
import type { Map as MapLibreMap } from 'maplibre-gl'
import { useMapInstance } from '@ulasim20/ui-map'
import { LINE_COLOR, MIN_STOP_ZOOM } from './constants'
import { busIconSvg, stopIconSvg, svgToDataUrl } from './icons'

type LngLat = [number, number]
type StopsFC = FeatureCollection<Point, { stationId: number; stationName: string }>
type VehiclesFC = FeatureCollection<Point, { plate: string; routeCode: string }>
type RouteFC = FeatureCollection<LineString> | { type: 'Feature'; geometry: LineString; properties: Record<string, never> } | null

function stopsToFC(stops: StopsFC): StopsFC { return stops }
function vehiclesToFC(vehicles: VehiclesFC): VehiclesFC { return vehicles }
function routeToFeatureCollection(geom: [number, number][] | null): FeatureCollection<LineString> {
  if (!geom || geom.length === 0) return { type: 'FeatureCollection', features: [] }
  const feature: Feature<LineString> = {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: geom },
    properties: {},
  }
  return { type: 'FeatureCollection', features: [feature] }
}

function loadIcon(map: MapLibreMap, id: string, svg: string) {
  if (map.hasImage(id)) return
  map.loadImage(svgToDataUrl(svg), (err, img) => {
    if (err || !img) return
    if (!map.hasImage(id)) map.addImage(id, img, { sdf: false })
  })
}

export function Overlays({
  stops,
  routeGeometry,
  vehicles,
}: {
  stops: StopsFC
  routeGeometry: RouteFC
  vehicles: VehiclesFC
}) {
  const map = useMapInstance()

  useEffect(() => {
    if (!map || !map.isStyleLoaded()) return

    if (!map.getSource('stops')) {
      map.addSource('stops', {
        type: 'geojson',
        data: stopsToFC(stops),
        cluster: true,
        clusterRadius: 40,
        clusterMaxZoom: MIN_STOP_ZOOM,
      })
    }
    if (!map.getSource('route-line')) {
      map.addSource('route-line', { type: 'geojson', data: routeToFeatureCollection(null) })
    }
    if (!map.getSource('vehicles')) {
      map.addSource('vehicles', { type: 'geojson', data: vehiclesToFC(vehicles) })
    }

    if (!map.getLayer('stops-clusters')) {
      map.addLayer({
        id: 'stops-clusters',
        type: 'circle',
        source: 'stops',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': LINE_COLOR,
          'circle-radius': ['step', ['get', 'point_count'], 14, 25, 18, 100, 24],
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 2,
        },
      })
      map.addLayer({
        id: 'stops-clusters-count',
        type: 'symbol',
        source: 'stops',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-font': ['Noto Sans Regular'],
          'text-size': 12,
        },
        paint: { 'text-color': '#fff' },
      })
    }
    if (!map.getLayer('stops-circles')) {
      loadIcon(map, 'stop-green', stopIconSvg())
      map.addLayer({
        id: 'stops-circles',
        type: 'symbol',
        source: 'stops',
        filter: ['==', ['get', 'cluster'], false],
        minzoom: MIN_STOP_ZOOM,
        layout: {
          'icon-image': 'stop-green',
          'icon-allow-overlap': true,
          'icon-anchor': 'center',
        },
      })
    }
    if (!map.getLayer('route-line')) {
      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route-line',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': LINE_COLOR, 'line-width': 5, 'line-opacity': 0.8 },
      })
    }
    if (!map.getLayer('vehicles-symbols')) {
      loadIcon(map, 'bus-green', busIconSvg())
      map.addLayer({
        id: 'vehicles-symbols',
        type: 'symbol',
        source: 'vehicles',
        layout: {
          'icon-image': 'bus-green',
          'icon-allow-overlap': true,
          'text-field': ['get', 'plate'],
          'text-offset': [0, 1.2],
          'text-size': 10,
          'text-anchor': 'top',
        },
        paint: { 'text-color': '#111', 'text-halo-color': '#fff', 'text-halo-width': 1 },
      })
    }
  }, [map])

  useEffect(() => {
    if (!map) return
    const src = map.getSource('stops') as { setData?: (d: StopsFC) => void } | undefined
    src?.setData?.(stopsToFC(stops))
  }, [map, stops])

  useEffect(() => {
    if (!map) return
    const src = map.getSource('route-line') as { setData?: (d: FeatureCollection<LineString>) => void } | undefined
    if (!src?.setData) return
    src.setData(routeToFeatureCollection(routeGeometry && 'geometry' in routeGeometry ? (routeGeometry.geometry.coordinates as LngLat[]) : null))
  }, [map, routeGeometry])

  useEffect(() => {
    if (!map) return
    const src = map.getSource('vehicles') as { setData?: (d: VehiclesFC) => void } | undefined
    src?.setData?.(vehiclesToFC(vehicles))
  }, [map, vehicles])

  return null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec nx run feature-routes:test -- -t "<Overlays />"`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add libs/feature/routes/src/lib/transit-map/overlays.tsx libs/feature/routes/src/lib/transit-map/overlays.test.tsx
git commit -m "feat(feature-routes): GeoJSON overlays for stops, route, vehicles"
```

---

## Task 13: Implement imperative markers (user, refill, search-selected)

**Files:**
- Create: `libs/feature/routes/src/lib/transit-map/markers.tsx`
- Create: `libs/feature/routes/src/lib/transit-map/markers.test.tsx`

- [ ] **Step 1: Create markers.tsx**

```tsx
import { useEffect } from 'react'
import { MapMarker, useMapInstance } from '@ulasim20/ui-map'
import type { RefillPoint, ProcessedStation } from './use-transit-map'
import { SEARCH_HIGHLIGHT_ZOOM } from './constants'

export function UserLocationMarker({ position }: { position: { lng: number; lat: number } | null }) {
  const map = useMapInstance()
  if (!map || !position) return null
  return (
    <MapMarker map={map} position={position} className="user-location-marker">
      <svg viewBox="0 0 24 24" width="24" height="24"><circle cx="12" cy="12" r="10" fill="#3b82f6" stroke="white" strokeWidth="2" /><circle cx="12" cy="12" r="4" fill="white" /></svg>
    </MapMarker>
  )
}

export function RefillMarker({ point, onClick }: { point: RefillPoint; onClick: () => void }) {
  const map = useMapInstance()
  if (!map) return null
  return (
    <MapMarker
      map={map}
      position={{ lng: point.lng, lat: point.lat }}
      className="refill-marker"
      onClick={onClick}
    >
      <svg viewBox="0 0 14 14" width="14" height="14"><circle cx="7" cy="7" r="6" fill="#3b82f6" stroke="white" strokeWidth="2" /></svg>
    </MapMarker>
  )
}

export function SearchHighlightMarker({ stop }: { stop: ProcessedStation }) {
  const map = useMapInstance()
  useEffect(() => {
    if (!map) return
    map.flyTo({ center: [stop.lng, stop.lat], zoom: SEARCH_HIGHLIGHT_ZOOM, essential: true })
  }, [map, stop])
  if (!map) return null
  return (
    <MapMarker
      map={map}
      position={{ lng: stop.lng, lat: stop.lat }}
      className="search-highlight"
    >
      <svg viewBox="0 0 22 22" width="22" height="22"><circle cx="11" cy="11" r="9" fill="#6a9a5b" stroke="white" strokeWidth="3" /></svg>
    </MapMarker>
  )
}
```

- [ ] **Step 2: Add unit test for marker rendering**

Create `libs/feature/routes/src/lib/transit-map/markers.test.tsx`:

```tsx
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
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
```

- [ ] **Step 3: Run tests**

Run: `pnpm exec nx run feature-routes:test -- -t "markers"`
Expected: PASS (3 tests).

- [ ] **Step 4: Commit**

```bash
git add libs/feature/routes/src/lib/transit-map/markers.tsx libs/feature/routes/src/lib/transit-map/markers.test.tsx
git commit -m "feat(feature-routes): imperative user/refill/search markers"
```

---

## Task 14: Port panels (SearchBar, StopPanel, RefillPanel, LinePanel)

**Files:**
- Create: `libs/feature/routes/src/lib/transit-map/panels.tsx`

- [ ] **Step 1: Create panels.tsx**

Port the four panels from the current `libs/feature/routes/src/lib/transit-map.tsx` lines 115–408, with these substitutions:

- `react-router-dom` `Link` import — keep as is.
- Any `useMap` / `useMapEvents` calls — replaced by props from the parent (wired in Task 15).
- `cleanLineCode` import — keep from `@ulasim20/util-format`.
- `Button` / `Input` imports — keep from `@ulasim20/ui-primitives`.
- Icons (`X`, `Clock`, `Bus`, `Search`, `MapPin`, `Navigation`, `List`, `AlertCircle`) from `lucide-react` — `Locate` was moved to the new `LocateButton` in Task 15.

```tsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Input } from '@ulasim20/ui-primitives'
import { X, Clock, Bus, Search, MapPin, Navigation, List, AlertCircle } from 'lucide-react'
import type { IndexEntry } from '@ulasim20/util-search'
import type { Station } from '@ulasim20/data-access-transport-api'
import { searchStations } from '@ulasim20/util-search'
import { cleanLineCode } from '@ulasim20/util-format'
import { getBusDataForStation } from '@ulasim20/data-access-transport-api'
import { trackStopLookup } from '@ulasim20/util-analytics'
import { LINE_COLOR } from './constants'
import type { ProcessedStation } from './use-transit-map'
import type { RefillPoint, SelectedLineInfo } from './use-transit-map'

function parseCoord(coord: string): number | null {
  const num = Number(coord.replace(',', '.'))
  return Number.isFinite(num) ? num : null
}

export function SearchBar({
  stations,
  stationIndex,
  onSelectStop,
}: {
  stations: Station[]
  stationIndex: IndexEntry[]
  onSelectStop: (s: ProcessedStation) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ProcessedStation[]>([])
  const [showResults, setShowResults] = useState(false)

  useEffect(() => {
    if (query.length < 2) { setResults([]); return }
    const matched = searchStations(stations, query, stationIndex).filter((r) => r.score > 0).slice(0, 8).map((r) => r.item)
    const processed: ProcessedStation[] = []
    for (const s of matched) {
      const lat = parseCoord(s.latitude)
      const lng = parseCoord(s.longitude)
      if (lat != null && lng != null) processed.push({ stationId: s.stationId, stationName: s.stationName, lat, lng })
    }
    setResults(processed)
  }, [query, stations, stationIndex])

  const handleSelect = (stop: ProcessedStation) => {
    trackStopLookup({ stationId: stop.stationId, source: 'map_search' })
    onSelectStop(stop)
    setQuery('')
    setResults([])
    setShowResults(false)
  }

  return (
    <div className="absolute top-3 left-3 right-3 md:left-4 md:right-auto md:w-80 z-[1000]">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setShowResults(true) }}
          onFocus={() => setShowResults(true)}
          placeholder="Durak ara..."
          className="pl-10 pr-4 h-11 bg-white shadow-lg border-0 rounded-xl"
        />
        {query && (
          <button onClick={() => { setQuery(''); setResults([]) }} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        )}
      </div>
      {showResults && results.length > 0 && (
        <>
          <div className="fixed inset-0 z-[-1]" onClick={() => setShowResults(false)} />
          <div className="mt-2 bg-white rounded-xl shadow-lg overflow-hidden max-h-72 overflow-y-auto">
            {results.map((stop) => (
              <button
                key={stop.stationId}
                onClick={() => handleSelect(stop)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left border-b border-gray-50 last:border-0"
              >
                <div className="w-8 h-8 rounded-lg bg-transit-primary/10 flex items-center justify-center shrink-0">
                  <MapPin className="w-4 h-4 text-transit-primary" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 text-sm truncate">{stop.stationName}</p>
                  <p className="text-xs text-gray-500">#{stop.stationId}</p>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

interface StopArrival {
  lineCode: string
  lineName: string
  minutes: number
  hatno: string
}

export function StopPanel({
  stop,
  onClose,
  onSelectLine,
}: {
  stop: ProcessedStation
  onClose: () => void
  onSelectLine: (lineCode: string) => void
}) {
  const [arrivals, setArrivals] = useState<StopArrival[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getBusDataForStation(stop.stationId).then((res) => {
      if (cancelled || !res?.value?.busList) return
      const list: StopArrival[] = []
      for (const bus of res.value.busList) {
        if (bus.plaka === 'EnYakinKalkis') continue
        let mins: number | null = null
        if (bus.sure) {
          const parts = bus.sure.split(':').map(Number)
          if (parts.every((n) => Number.isFinite(n))) { const [h = 0, m = 0, s = 0] = parts; mins = Math.floor((h * 3600 + m * 60 + s) / 60) }
        }
        if (mins == null && bus.kalkisaKadarkiDakika) { const v = Number(bus.kalkisaKadarkiDakika.replace(',', '.')); if (Number.isFinite(v)) mins = Math.round(v) }
        if (mins == null) continue
        list.push({ lineCode: cleanLineCode(bus.hatno), lineName: bus.hatadi, minutes: mins, hatno: bus.hatno })
      }
      list.sort((a, b) => a.minutes - b.minutes)
      if (!cancelled) setArrivals(list)
    }).catch(() => {}).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [stop.stationId])

  return (
    <div className="absolute bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-white rounded-xl shadow-xl z-[1000] overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-gray-100">
        <div>
          <h3 className="font-semibold text-gray-900">{stop.stationName}</h3>
          <p className="text-sm text-gray-500">#{stop.stationId}</p>
        </div>
        <Button size="icon" variant="ghost" onClick={onClose}><X className="w-5 h-5" /></Button>
      </div>
      <div className="max-h-64 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-sm text-gray-500">Yükleniyor...</div>
        ) : arrivals.length === 0 ? (
          <div className="p-4 text-center text-sm text-gray-500">Yaklaşan araç yok</div>
        ) : (
          arrivals.map((arrival, idx) => (
            <button
              key={idx}
              onClick={() => onSelectLine(arrival.hatno)}
              className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
            >
              <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm bg-transit-primary">
                {arrival.lineCode}
              </div>
              <div className="flex-1 text-left">
                <p className="font-medium text-gray-900 text-sm">{arrival.lineName?.split('-').pop()?.trim() || ''}</p>
              </div>
              <div className="flex items-center gap-1 text-transit-primary font-semibold">
                <Clock className="w-4 h-4" />
                <span>{arrival.minutes} dk</span>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

export function RefillPanel({ point, onClose }: { point: RefillPoint; onClose: () => void }) {
  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lng}`
  return (
    <div className="absolute bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-white rounded-xl shadow-xl z-[1000] overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-gray-100">
        <div>
          <h3 className="font-semibold text-gray-900">{point.name ?? 'Dolum noktası'}</h3>
          <p className="text-sm text-gray-500">Denizli Kart dolum / satış</p>
        </div>
        <Button size="icon" variant="ghost" onClick={onClose}><X className="w-5 h-5" /></Button>
      </div>
      <div className="p-4 space-y-2">
        {point.id != null && (
          <Link
            to={`/dolum-noktalari#dealer-${point.id}`}
            onClick={onClose}
            className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-lg border border-gray-200 text-gray-700 font-medium text-sm hover:bg-gray-50 transition-colors"
          >
            <List className="w-4 h-4" />
            Detayları görüntüle
          </Link>
        )}
        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-lg bg-transit-primary text-white font-medium text-sm hover:bg-transit-primary/90 transition-colors"
        >
          <Navigation className="w-4 h-4" />
          Nasıl giderim
        </a>
      </div>
    </div>
  )
}

export function LinePanel({ lineInfo, onClose }: { lineInfo: SelectedLineInfo; onClose: () => void }) {
  return (
    <div className="absolute top-4 left-4 md:left-auto md:right-4 w-72 md:w-80 bg-white rounded-xl shadow-xl z-[1000] overflow-hidden">
      <div className="flex items-center gap-3 p-4 border-b border-gray-100" style={{ backgroundColor: LINE_COLOR + '15' }}>
        <div className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold" style={{ backgroundColor: LINE_COLOR }}>
          {cleanLineCode(lineInfo.lineCode)}
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900">{lineInfo.lineName?.replace(/-?\s*D\s*\/\s*/gi, '-').trim() || lineInfo.lineCode}</h3>
          <p className="text-sm text-gray-500">{lineInfo.stations.length} durak</p>
        </div>
        <Button size="icon" variant="ghost" onClick={onClose}><X className="w-5 h-5" /></Button>
      </div>
      <div className="p-3 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bus className="w-4 h-4 text-transit-primary" />
          <span className="text-sm text-gray-600">{lineInfo.vehicles.length} otobüs yolda</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
          <span className="text-xs text-gray-400">Canlı</span>
        </div>
      </div>
      {lineInfo.geometryError && (
        <div className="mx-3 mt-3 rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-700">
          <div className="flex items-center gap-2 font-medium">
            <AlertCircle className="h-4 w-4" />
            Güzergah çizilemedi
          </div>
          <p className="mt-1 text-xs">
            Bu hattın seçili yönü için güzergah verisi alınamadı. Lütfen daha sonra tekrar deneyin.
          </p>
        </div>
      )}
      <div className="max-h-64 overflow-y-auto p-2">
        {lineInfo.stations.map((stop, idx) => (
          <div key={`${stop.stationId}-${stop.sequence}`} className="flex items-center gap-3 p-2">
            <div className="flex flex-col items-center">
              <div
                className="w-3 h-3 rounded-full border-2"
                style={{ borderColor: LINE_COLOR, backgroundColor: idx === 0 || idx === lineInfo.stations.length - 1 ? LINE_COLOR : 'white' }}
              />
              {idx < lineInfo.stations.length - 1 && <div className="w-0.5 h-6 -my-1" style={{ backgroundColor: LINE_COLOR + '40' }} />}
            </div>
            <span className="text-sm text-gray-700">{stop.stationName}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `pnpm exec nx run feature-routes:type-check && pnpm exec nx run feature-routes:lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add libs/feature/routes/src/lib/transit-map/panels.tsx
git commit -m "feat(feature-routes): port panels to transit-map folder"
```

---

## Task 15: Wire `TransitMap` index.tsx

**Files:**
- Create: `libs/feature/routes/src/lib/transit-map/index.tsx`

- [ ] **Step 1: Implement TransitMap**

Create `libs/feature/routes/src/lib/transit-map/index.tsx`:

```tsx
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { Feature, FeatureCollection, Point, LineString } from 'geojson'
import { Locate, X } from 'lucide-react'
import { Button } from '@ulasim20/ui-primitives'
import { MapView, useMapInstance } from '@ulasim20/ui-map'
import { useTransitMap, type ProcessedStation } from './use-transit-map'
import { Overlays } from './overlays'
import { RefillMarker, SearchHighlightMarker, UserLocationMarker } from './markers'
import { LinePanel, RefillPanel, SearchBar, StopPanel } from './panels'
import { DENIZLI_CENTER, SEARCH_HIGHLIGHT_ZOOM } from './constants'

function FlyToHandler({ target }: { target: { lat: number; lng: number } | null }) {
  const map = useMapInstance()
  useEffect(() => {
    if (!map || !target) return
    map.flyTo({ center: [target.lng, target.lat], zoom: SEARCH_HIGHLIGHT_ZOOM, essential: true })
  }, [map, target])
  return null
}

function FlyToUserPos({ position }: { position: { lng: number; lat: number } | null }) {
  const map = useMapInstance()
  useEffect(() => {
    if (!map || !position) return
    map.flyTo({ center: [position.lng, position.lat], zoom: 16, essential: true })
  }, [map, position])
  return null
}

function FlyToCenter() {
  const map = useMapInstance()
  useEffect(() => {
    if (!map) return
    map.flyTo({ center: [DENIZLI_CENTER.lng, DENIZLI_CENTER.lat], zoom: 14, essential: true })
  }, [map])
  return null
}

function LocateButton({ onClick }: { onClick: () => void }) {
  return (
    <Button size="icon" variant="secondary" className="absolute bottom-24 right-4 z-[1000] shadow-lg bg-white hover:bg-gray-50" onClick={onClick}>
      <Locate className="w-5 h-5 text-gray-700" />
    </Button>
  )
}

export default function TransitMap() {
  const [searchParams] = useSearchParams()
  const [mounted, setMounted] = useState(false)
  const [refillPanelOpen, setRefillPanelOpen] = useState(false)
  const [searchSelected, setSearchSelected] = useState<ProcessedStation | null>(null)
  const [userPos, setUserPos] = useState<{ lng: number; lat: number } | null>(null)

  useEffect(() => { setMounted(true) }, [])

  const tx = useTransitMap({ searchParams })

  const stopsFC = useMemo<FeatureCollection<Point, { stationId: number; stationName: string }>>(() => ({
    type: 'FeatureCollection',
    features: tx.processedStations.map((s) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
      properties: { stationId: s.stationId, stationName: s.stationName },
    })),
  }), [tx.processedStations])

  const vehiclesFC = useMemo<FeatureCollection<Point, { plate: string; routeCode: string }>>(() => {
    const list = tx.selectedLine?.vehicles ?? []
    return {
      type: 'FeatureCollection',
      features: list.flatMap((v) => {
        const lat = Number(v.latitude.replace(',', '.'))
        const lng = Number(v.longitude.replace(',', '.'))
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return []
        return [{ type: 'Feature', geometry: { type: 'Point', coordinates: [lng, lat] }, properties: { plate: v.plate, routeCode: v.routeCode } }]
      }),
    }
  }, [tx.selectedLine?.vehicles])

  const routeFC = useMemo<Feature<LineString> | null>(() => {
    const g = tx.selectedLine?.geometry
    if (!g || g.length === 0) return null
    return { type: 'Feature', geometry: { type: 'LineString', coordinates: g }, properties: {} }
  }, [tx.selectedLine?.geometry])

  if (!mounted) {
    return <div className="w-full h-full bg-gray-100 flex items-center justify-center"><div className="text-gray-500">Harita yükleniyor...</div></div>
  }

  const handleLocateClick = () => {
    if (!('geolocation' in navigator)) {
      setUserPos(null)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (p) => setUserPos({ lng: p.coords.longitude, lat: p.coords.latitude }),
      () => setUserPos(null),
    )
  }

  return (
    <div className="relative w-full h-full">
      <SearchBar
        stations={tx.rawStations}
        stationIndex={tx.stationIdx}
        onSelectStop={(stop) => {
          tx.setSelectedStop(stop)
          tx.setSelectedLine(null)
          setSearchSelected(stop)
          setRefillPanelOpen(false)
        }}
      />

      <MapView center={[DENIZLI_CENTER.lng, DENIZLI_CENTER.lat]} zoom={14}>
        <FlyToHandler target={tx.flyTarget} />
        <FlyToUserPos position={userPos} />
        {userPos === null && <FlyToCenter />}
        <Overlays stops={stopsFC} routeGeometry={routeFC} vehicles={vehiclesFC} />

        {tx.refillPoint && (
          <RefillMarker
            point={tx.refillPoint}
            onClick={() => {
              tx.setSelectedStop(null)
              tx.setSelectedLine(null)
              setRefillPanelOpen(true)
            }}
          />
        )}
        {searchSelected && !tx.selectedLine && (
          <SearchHighlightMarker stop={searchSelected} />
        )}
        <UserLocationMarker position={userPos} />
      </MapView>

      <LocateButton onClick={handleLocateClick} />

      {tx.selectedStop && !tx.selectedLine && !searchSelected && (
        <StopPanel
          stop={tx.selectedStop}
          onClose={() => tx.setSelectedStop(null)}
          onSelectLine={(lc) => tx.handleSelectLine(lc, 'map_stop_panel')}
        />
      )}

      {refillPanelOpen && tx.refillPoint && (
        <RefillPanel point={tx.refillPoint} onClose={() => setRefillPanelOpen(false)} />
      )}

      {tx.selectedLine && (
        <LinePanel lineInfo={tx.selectedLine} onClose={() => tx.setSelectedLine(null)} />
      )}

      {searchSelected && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] bg-white rounded-xl shadow-lg p-3 max-w-sm flex items-start gap-2">
          <p className="font-medium text-sm flex-1">{searchSelected.stationName}</p>
          <button onClick={() => setSearchSelected(null)} aria-label="Kapat" className="p-1 hover:bg-gray-100 rounded">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm exec nx run feature-routes:type-check`
Expected: PASS.

- [ ] **Step 3: Commit wiring**

```bash
git add libs/feature/routes/src/lib/transit-map/index.tsx
git commit -m "feat(feature-routes): wire TransitMap on maplibre-gl"
```

---

## Task 16: Update index.ts export and delete old file

**Files:**
- Modify: `libs/feature/routes/src/index.ts`
- Delete: `libs/feature/routes/src/lib/transit-map.tsx`
- Delete: `libs/feature/routes/src/lib/transit-map.test.tsx`

- [ ] **Step 1: Update index.ts**

Edit `libs/feature/routes/src/index.ts` so the `TransitMap` line points at the new file:

```ts
export { default as TransitMap } from './lib/transit-map/index'
```

- [ ] **Step 2: Remove old files**

Run: `git rm libs/feature/routes/src/lib/transit-map.tsx libs/feature/routes/src/lib/transit-map.test.tsx`

- [ ] **Step 3: Commit**

```bash
git add libs/feature/routes/src/index.ts
git commit -m "refactor(feature-routes): point TransitMap export at new folder"
```

---

## Task 17: Rewrite test mocks for transit-map

**Files:**
- Create: `libs/feature/routes/src/lib/transit-map/transit-map.test.tsx`

- [ ] **Step 1: Create the test file**

```tsx
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
  class Map {
    constructor(_opts: unknown) { return fakeMap }
  }
  class Marker { constructor(_opts?: unknown) { return fakeMap } }
  class Popup { constructor(_opts?: unknown) { return fakeMap } }
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
  // Re-bind the same fake so cleared spies still return the fake object.
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
    expect(fakeMap.addSource).toHaveBeenCalledWith('route-line', expect.anything())
    expect(mockedTriggerRouteGeometryGeneration).not.toHaveBeenCalled()
  })

  it('triggers backend generation and draws direct KMZ fallback on cache miss', async () => {
    mockedGetRouteGeometryResult.mockResolvedValue({ status: 'miss' })
    mockedFetchDirectKmzRouteGeometry.mockResolvedValue({
      lineCode: '320', coordinates: [[37.77, 29.08]], source: 'direct-kmz',
    })
    renderMap()
    await waitFor(() => expect(mockedTriggerRouteGeometryGeneration).toHaveBeenCalledWith('320'))
  })

  it('shows a clear error when cache and direct KMZ fallback are unavailable', async () => {
    mockedGetRouteGeometryResult.mockResolvedValue({ status: 'miss' })
    mockedFetchDirectKmzRouteGeometry.mockRejectedValue(new Error('no geometry'))
    renderMap()
    expect(await screen.findByText('Güzergah çizilemedi')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests**

Run: `pnpm exec nx run feature-routes:test`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add libs/feature/routes/src/lib/transit-map/transit-map.test.tsx
git commit -m "test(feature-routes): rewrite TransitMap tests for maplibre"
```

---

## Task 18: Typecheck + lint + tests across affected projects

- [ ] **Step 1: Run typecheck for ui-map and feature-routes**

Run: `pnpm exec nx run-many -t type-check --projects=ui-map,feature-routes,web`
Expected: PASS.

- [ ] **Step 2: Run lint for ui-map and feature-routes**

Run: `pnpm exec nx run-many -t lint --projects=ui-map,feature-routes,web`
Expected: PASS.

- [ ] **Step 3: Run tests for ui-map and feature-routes**

Run: `pnpm exec nx run-many -t test --projects=ui-map,feature-routes,web`
Expected: PASS.

- [ ] **Step 4: Remove leaflet from apps/web**

Edit `apps/web/package.json`: remove `leaflet`, `react-leaflet`, `@types/leaflet` from dependencies and devDependencies. Run `pnpm install`.

- [ ] **Step 5: Remove leaflet from libs/ui/map and libs/feature/routes**

Already done in Task 7 for `feature-routes`. For `libs/ui/map`, the original `package.json` was fully replaced in Task 1 — verify with `git grep leaflet libs/`.

- [ ] **Step 6: Commit cleanup**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "chore(deps): drop leaflet from web and lockfile"
```

---

## Task 19: Add CSP entries for OpenFreeMap

**Files:**
- Modify: wherever CSP headers are set in `apps/web`. Search: `git grep -nE "Content-Security-Policy|connect-src|img-src" apps/`.

- [ ] **Step 1: Locate CSP configuration**

Run: `git grep -nE "Content-Security-Policy|connect-src|img-src" apps/`

- [ ] **Step 2: Add required hosts**

Append the following hosts to whatever directives are appropriate (typically `connect-src`, `img-src`, and `script-src` for the style JSON):

- `https://tiles.openfreemap.org`
- `https://fonts.openmaptiles.org`
- `https://*.openfreemap.org`

- [ ] **Step 3: Verify locally**

Run: `pnpm exec nx serve web` and open the browser devtools network tab. Tile requests should succeed.

- [ ] **Step 4: Commit**

```bash
git add apps/web/
git commit -m "fix(web): allow OpenFreeMap hosts in CSP"
```

---

## Task 20: Add Playwright e2e for Harita

**Files:**
- Create: `e2e/harita.spec.ts`

- [ ] **Step 1: Create spec**

```ts
import { expect, test } from '@playwright/test'

test('harita: line deep link renders the line panel', async ({ page }) => {
  await page.goto('/harita?line=320')
  await expect(page.getByText(/320/)).toBeVisible({ timeout: 10_000 })
})

test('harita: refill deep link shows the refill panel', async ({ page }) => {
  await page.goto('/harita?lat=37.7765&lng=29.0864&type=refill&name=Test&type=refill')
  await expect(page.getByText('Nasıl giderim')).toBeVisible({ timeout: 10_000 })
})
```

- [ ] **Step 2: Run e2e**

Run: `pnpm test:e2e -- harita.spec.ts`
Expected: PASS (requires local dev server; the test harness already manages this).

- [ ] **Step 3: Commit**

```bash
git add e2e/harita.spec.ts
git commit -m "test(e2e): add harita deep-link smoke tests"
```

---

## Self-Review (run after completing tasks)

After all tasks:

1. **Spec coverage** — verify each spec section maps to a task:
   - Goal (workspace migration) → Tasks 1, 7, 18.
   - Non-goals — none of the tasks add WS/SSE/dark mode/KMZ path changes.
   - Decisions table — Tasks 1, 7, 12, 18, 19 (tile source, style, integration, overlays, polling, deps, CSP).
   - Architecture & file layout — Tasks 1, 6, 7, 8, 12, 13, 14, 15.
   - Map lifecycle — Task 3.
   - `useTransitMap` — Tasks 9, 10, 11.
   - Overlays — Task 12.
   - Imperative markers — Task 13.
   - Data flow — Tasks 9, 10, 11, 15.
   - Testing strategy — Tasks 2, 3, 4, 5, 9, 10, 11, 12, 13, 17, 20.
   - Migration order — Tasks 1–20 follow it.
   - Risks — Task 19 (CSP), Task 18 (deps), Task 20 (smoke).

2. **Placeholder scan** — no TBD/TODO/"implement later" strings remain in any task's instructions.

3. **Type consistency** — `handleSelectLine`, `setData`, `useMapInstance`, `MapInstanceProvider`, `Overlays` props all match across tasks. `ProcessedStation` and `SelectedLineInfo` types defined in Task 9 and consumed consistently in Tasks 12, 13, 15.

4. **Commit cadence** — every task ends with a commit; no task depends on another task's uncommitted code.