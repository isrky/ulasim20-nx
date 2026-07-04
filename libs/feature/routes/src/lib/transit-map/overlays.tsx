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
  void map.loadImage(svgToDataUrl(svg)).then(({ data }) => {
    if (!map.hasImage(id)) map.addImage(id, data as HTMLImageElement, { sdf: false })
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
    const src = map.getSource('route-line') as { setData?: (d: unknown) => void } | undefined
    if (!src?.setData) return
    if (routeGeometry && 'geometry' in routeGeometry) {
      src.setData(routeGeometry)
    } else {
      src.setData(routeToFeatureCollection(null))
    }
  }, [map, routeGeometry])

  useEffect(() => {
    if (!map) return
    const src = map.getSource('vehicles') as { setData?: (d: VehiclesFC) => void } | undefined
    src?.setData?.(vehiclesToFC(vehicles))
  }, [map, vehicles])

  return null
}