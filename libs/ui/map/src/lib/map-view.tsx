import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  Map as MapLibreMap,
  NavigationControl,
  ScaleControl,
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
  center: [number, number]
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
      attributionControl: { compact: true },
    })
    m.addControl(new NavigationControl({ visualizePitch: false }), 'bottom-right')
    m.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-left')
    const handleLoad = () => setMap(m)
    if (m.loaded()) handleLoad()
    else m.on('load', handleLoad)
    return () => {
      setMap(null)
      m.remove()
    }
  }, [center[0], center[1], zoom, style])

  return (
    <div className="relative h-full w-full">
      <div
        ref={containerRef}
        className="absolute inset-0"
        data-testid="map-container"
      />
      <MapInstanceProvider value={map}>{children}</MapInstanceProvider>
    </div>
  )
}
