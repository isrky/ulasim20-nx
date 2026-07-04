# MapLibre GL JS migration — design

Date: 2026-07-04
Status: Draft
Scope: Workspace-wide (apps/web, libs/feature/routes, libs/ui/map)

## Goal

Replace the Leaflet/react-leaflet map engine with MapLibre GL JS across the
workspace, while keeping the public API of `TransitMap` and the user-facing
behavior of `/harita` unchanged.

## Non-goals

- Changing the live-vehicle polling cadence (stays 15 s).
- Adding WebSocket / SSE for vehicle positions.
- Self-hosting map tiles (we use OpenFreeMap's public instance).
- Adding a dark-mode toggle or any new map style.
- Refactoring any page or route outside `apps/web/src/pages/Harita.tsx`.
- Changing the `feature-planner` KMZ fallback path.

## Background

`apps/web/src/pages/Harita.tsx` renders `<TransitMap />` from
`@ulasim20/feature-routes`. The component lives in
`libs/feature/routes/src/lib/transit-map.tsx` (614 lines) and is built on
`react-leaflet 4` + `leaflet 1.9` with CARTO Voyager raster tiles.

`libs/ui/map` (`MapView`, `MapMarker`) also depends on leaflet but is not
imported by anything in `apps/*` today.

Both libraries will be rewritten on MapLibre and the leaflet dependencies
removed from the workspace.

## Decisions

| Decision | Choice | Reason |
|---|---|---|
| Tile source | OpenFreeMap public instance (`https://tiles.openfreemap.org/styles/bright`) | Free, no API key, OpenMapTiles schema works with MapLibre Native (Capacitor) |
| Base style | Bright | Closest visual fit to current CARTO Voyager |
| React integration | Bare `maplibre-gl` via a small `useMapInstance` hook | Full control, smallest dep tree, idiomatic MapLibre |
| Overlay rendering | Native GeoJSON `Source` + `Layer` | WebGL rendering scales; zoom-based filtering becomes `minzoom` |
| Imperative markers | Only user location, refill point, search-selected stop | DOM content (popups, badges) needs real elements |
| Live vehicle updates | 15 s polling + `source.setData(featureCollection)` | No backend change |
| `libs/ui/map` fate | Rewrite on MapLibre | Keeps workspace on one map engine |
| `Harita.tsx` | No changes | The page is a 20-line wrapper; everything below is internal |

## Architecture

`libs/ui/map` provides generic, reusable map primitives. `libs/feature/routes`
composes them with transit-domain logic. `apps/web` consumes `TransitMap`
exactly as it does today.

### File layout

```
libs/ui/map/src/lib/
  map-view.tsx        // owns map instance, applies style, renders children
  map-marker.tsx      // imperative marker helper (DOM-element backed)
  map-popup.tsx       // reusable popup component
  use-map-instance.ts // hook to grab the maplibregl.Map from context

libs/feature/routes/src/lib/transit-map/
  index.tsx           // TransitMap entrypoint, top-level state, search-params
  use-transit-map.ts  // boot logic: stations fetch, deep-link handling, polling
  overlays.tsx        // GeoJSON sources + layers (stops, route line, vehicles)
  panels.tsx          // SearchBar, StopPanel, RefillPanel, LinePanel
  icons.ts            // runtime-generated PNG / SVG icons (bus, stop, refill)
  constants.ts        // DENIZLI_CENTER, LINE_COLOR, MIN_STOP_ZOOM, etc.
  transit-map.test.tsx (existing tests, re-mocked)
```

### Public API surface

`apps/web/src/pages/Harita.tsx` continues to import `TransitMap` from
`@ulasim20/feature-routes`. No change to the page file, the router, or the
`index.ts` exports.

`@ulasim20/ui-map` exports:

- `MapView({ center, zoom, style, children })` — creates and owns the
  `maplibregl.Map`. Renders children inside a React context that exposes the
  map instance once `'load'` has fired.
- `useMapInstance()` — returns the live `maplibregl.Map` or `null`.
- `MapMarker({ map, position, children?, className?, onClick?, popup?, draggable? })`
  — thin wrapper around `maplibregl.Marker` with a configurable element.
- `MapPopup({ anchor, children, onClose })` — thin wrapper around
  `maplibregl.Popup`.

## Map instance lifecycle

`MapView` creates the map exactly once on mount:

```ts
new maplibregl.Map({
  container: divRef.current,
  style: 'https://tiles.openfreemap.org/styles/bright',
  center: [DENIZLI_CENTER.lng, DENIZLI_CENTER.lat],
  zoom: 14,
  attributionControl: { compact: true },
})
```

It adds `NavigationControl` (zoom buttons) bottom-right and `ScaleControl`.
The existing in-component "locate" button remains — we do not enable
`GeolocateControl`.

On unmount: `map.remove()`. This releases the WebGL context and event
listeners.

The map is exposed via a `TransitMapContext` once `map.on('load', …)` fires.
Until then `useMapInstance()` returns `null` and overlay components skip
registration.

`MapView` is rendered inside the existing `mounted` guard so it only
constructs on the client.

## `useTransitMap` hook (feature-routes)

Owns all transit-domain state and side effects:

- Fetches `getAllStations()` on mount; memoizes processed coords + search
  index (unchanged from today).
- Reads URL params (`?line=`, `?lat&lng&type=refill&name&id`) and dispatches:
  - `line` → `handleSelectLine(lineCode, source)`.
  - `lat&lng` → `setFlyTarget({ lat, lng })`, optionally `setRefillPoint`.
- Owns the 15 s polling interval for the selected line's live vehicles and
  updates a `vehiclesFC` `useState<FeatureCollection>` instead of mutating
  markers.
- Returns the consolidated state + handlers to the `TransitMap` component.

The hook consumes `useMapInstance()` from `ui-map` but keeps all transit
domain logic in `feature-routes`. `ui-map` stays generic — no transit types
leak in.

## Overlays — native GeoJSON sources & layers

Three sources, four layers, all registered once after `map.on('load')`.

### Sources

| Source ID    | Type     | Data                                          | Notes                                    |
|--------------|----------|-----------------------------------------------|------------------------------------------|
| `stops`      | `geojson` | `FeatureCollection` of all processed stops   | Clustered: `cluster: true, clusterRadius: 40, clusterMaxZoom: 15` |
| `route-line` | `geojson` | `LineString` of selected line geometry or empty `FeatureCollection` | Updated via `source.setData()` on line change |
| `vehicles`   | `geojson` | `FeatureCollection` of live vehicles         | Updated via `source.setData()` every 15 s |

### Layers

- `stops-clusters` (two layers: circle for the bubble background, symbol for
  the count text). Driven by source `cluster: true`,
  `clusterRadius: 40`, `clusterMaxZoom: 15`.
- `stops-circles` (symbol) — `icon-image: stop-green` generated from today's
  `stopIcon` SVG. Filter: `['==', ['get', 'cluster'], false]`. `minzoom: 15`
  (matches today's `MIN_STOP_ZOOM`; also implied by the source's
  `clusterMaxZoom: 15`, kept explicit for clarity).
- `route-line` (line) — `paint: { 'line-color': LINE_COLOR, 'line-width': 5,
  'line-opacity': 0.8 }`. Same look as today's `<Polyline pathOptions={…}>`.
- `vehicles-symbols` (symbol) — `icon-image: bus-green`,
  `text-field: ['get', 'plate']`, `icon-allow-overlap: true`. Click opens
  `MapPopup` anchored at the feature coordinates.

### Click handlers

- `map.on('click', 'stops-clusters', …)` — zoom in by 2 levels toward the
  cluster's expansion zoom.
- `map.on('click', 'stops-circles', …)` — fire `onSelectStop(feature)`.
- `map.on('click', 'vehicles-symbols', …)` — open `MapPopup` anchored at the
  feature coordinates.
- `map.on('mouseenter'/'mouseleave', …)` — toggle cursor pointer.

### Icons

Runtime-generated images via `map.loadImage(svgStringAsDataURL, (err, image)
=> map.addImage('bus-green', image))` once on load. Same trick the current
code uses with `L.divIcon`, ported to MapLibre's sprite. No sprite JSON file
is shipped.

## Imperative markers

Three cases keep `new maplibregl.Marker({ element })` because they need real
DOM:

1. **User location** — single point, updated on geolocation click. Built as a
   `<div>` matching today's `userIcon` SVG.
2. **Refill point** — the deep-linked `?type=refill` marker. Same blue
   circle as today's `refillIcon`.
3. **Search-selected stop** — temporary highlight after a search-result pick.
   Distinct from layer-rendered stops so the user can see which one they just
   picked. Auto-clears when the panel closes or another stop is picked.

`MapMarker` (in `ui-map`) manages `setLngLat` on `position` change and
`remove()` on unmount or `map` change.

## Data flow

Top-level state machine in `useTransitMap`:

```
searchParams → line | lat&lng[&type=refill]
   │
   ├─ line  → handleSelectLine → fetch route stations, vehicles, geometry
   │                                ├─ geometry hit   → setRouteLineGeometry(fc)
   │                                └─ geometry miss  → trigger backend + KMZ fallback
   │                                                    ├─ ok  → setRouteLineGeometry(fc)
   │                                                    └─ err → setGeometryError(...)
   │
   └─ lat&lng → setFlyTarget, optionally setRefillPoint

selectedLine?.lineCode → 15 s setInterval → setVehiclesFC(new fc)
```

`FlyToHandler` becomes a hook:

```ts
useEffect(() => {
  if (!map || !flyTarget) return
  map.flyTo({ center: [flyTarget.lng, flyTarget.lat], zoom: 17, essential: true })
}, [flyTarget, map])
```

No more `<FlyToHandler>` JSX component. The `useMapEvents`/`zoomend`/`moveend`
flow inside `<StopMarkers>` is replaced by `minzoom: 15` on the layer.

The polling effect keeps today's `useEffect([selectedLine?.lineCode])`
cleanup pattern. `setVehiclesFC` is a stable callback built via `useCallback`.

## Testing strategy

Three test layers, all using Vitest + @testing-library/react.

### `libs/ui/map` unit tests (new)

Verify `MapView` mounts the container, calls `map.remove()` on unmount, and
exposes the instance via context once `'load'` fires. `maplibre-gl` is mocked
with a stub class.

### `transit-map.test.tsx` (existing, rewritten)

Re-mock `maplibre-gl` (class stubs for `Map`, `Marker`, `Popup`,
`NavigationControl`, etc.) and assert behavior via:

- `screen.findByText(...)` for the line panel / error / arrivals — unchanged.
- `data-testid="route-line"` on the layer — we add a `map.on('data', …)`
  callback that exposes registered layer IDs to a global registry, then the
  test asserts `getByTestId('route-line')` resolves to `true` after
  `setData`. This matches the pattern the current test uses for `<Polyline
  testId="route-polyline" />`.
- `map.loadImage` resolves immediately so registration is synchronous in
  tests.

Mocks removed: `vi.mock('leaflet/dist/leaflet.css', …)`,
`vi.mock('leaflet', …)`, `vi.mock('react-leaflet', …)`. Replaced by one
`vi.mock('maplibre-gl', …)` factory.

### Visual / manual

`apps/web` smoke test in dev: open `/harita`, pick a stop, pick a line from
a search, verify URL deep-link `?line=320` opens with the polyline drawn. Add
one `harita.spec.ts` Playwright test that asserts the polyline + panel text.

## Migration order

Each step is independently committable:

1. Add `maplibre-gl` dep to root, `libs/ui/map`, `libs/feature/routes`.
   Keep leaflet deps for now.
2. Rewrite `libs/ui/map` (`MapView`, `MapMarker`, new `MapPopup` +
   `useMapInstance`).
3. Add unit tests for `libs/ui/map`.
4. In `feature-routes`, create the new `transit-map/` folder alongside the
   old file; build the new files module by module (`constants` → `icons` →
   `useTransitMap` → `Overlays` → `Panels` → `index`).
5. Swap `src/index.ts` export to point at the new entrypoint. Delete the old
   `transit-map.tsx` once tests pass.
6. Rewrite `transit-map.test.tsx` mocks; run `pnpm test` until green.
7. Run `pnpm typecheck` + `pnpm lint`.
8. Remove `leaflet`, `react-leaflet`, `@types/leaflet` from root, `apps/web`,
   `libs/feature/routes`, `libs/ui/map`. Regenerate lockfile with
   `pnpm install`.
9. Add CSP entries (`tiles.openfreemap.org`, `fonts.openmaptiles.org`,
   `*.openfreemap.org`) wherever the app sets CSP today. Verify in
   production.
10. Add `harita.spec.ts` Playwright test; run `pnpm test:e2e`.

## Risks

- **OpenFreeMap SLA** — public instance is free and best-effort. If it is
  down, the map tiles fail. Mitigation: link to the sponsor page in code
  comments and note in this design that self-hosting is a follow-up. Not
  blocking.
- **Tile attribution** — OpenFreeMap requires `© OpenMapTiles` and
  `© OpenStreetMap` attribution. `attributionControl: { compact: true }`
  handles this; we verify the rendered DOM in tests.
- **Bundle size** — `maplibre-gl` is ~800 KB minified (~200 KB gzipped),
  roughly the same ballpark as `leaflet` + `react-leaflet`. Vite already
  code-splits the `harita` route; `harita` is its own chunk.
- **Mobile (Capacitor) WebView quirks** — older Android WebViews may lack
  WebGL2; MapLibre falls back to WebGL1. Manual smoke test on the Android
  shell after step 6.
- **Icon visual parity** — `stopIcon` and `busIcon` are SVG-encoded data
  URLs today. The migration to `map.loadImage()` changes how they live at
  runtime. Side-by-side screenshot check is part of step 6.

## Open questions

None at draft time. Self-hosting OpenFreeMap is a future candidate.