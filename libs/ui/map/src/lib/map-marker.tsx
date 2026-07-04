import { useEffect, useRef, type ReactNode } from 'react'
import {
  Marker as MapLibreMarker,
  type Map as MapLibreMap,
  type Popup as MapLibrePopup,
} from 'maplibre-gl'

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

  // Mount: create marker + add to map. className/position/draggable are
  // intentionally not deps: position has its own effect, the others are
  // applied at construction only and only the map identity should rebuild.
  // biome-ignore lint/correctness/useExhaustiveDependencies: see comment above
  useEffect(() => {
    const el = elRef.current as HTMLDivElement
    if (className) el.className = className
    const marker = new MapLibreMarker({ element: el, draggable })
    marker.setLngLat([position.lng, position.lat]).addTo(map)
    markerRef.current = marker
    return () => {
      marker.remove()
      markerRef.current = null
    }
  }, [map])

  // Position updates: cheap setLngLat on prop change.
  useEffect(() => {
    markerRef.current?.setLngLat([position.lng, position.lat])
  }, [position.lng, position.lat])

  // Click: register/refresh handler whenever the closure changes.
  useEffect(() => {
    const el = elRef.current
    if (!el || !onClick) return
    el.style.cursor = 'pointer'
    const handler: EventListener = () => onClick()
    el.addEventListener('click', handler)
    return () => el.removeEventListener('click', handler)
  }, [onClick])

  // Popup: refresh whenever the popup instance changes.
  useEffect(() => {
    markerRef.current?.setPopup(popup ?? undefined)
  }, [popup])

  return <div ref={elRef}>{children}</div>
}