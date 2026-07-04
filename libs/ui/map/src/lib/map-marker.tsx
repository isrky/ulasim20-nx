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

  // className/onClick/popup/draggable intentional: only the map identity should rebuild the marker
  // biome-ignore lint/correctness/useExhaustiveDependencies: see comment above
  useEffect(() => {
    const el = elRef.current ?? document.createElement('div')
    if (!elRef.current) elRef.current = el
    if (className) el.className = className
    if (onClick) el.style.cursor = 'pointer'
    const marker = new MapLibreMarker({ element: el, draggable })
    marker.addTo(map)
    if (popup) marker.setPopup(popup)
    if (onClick) el.addEventListener('click', onClick)
    markerRef.current = marker
    return () => {
      el.removeEventListener('click', onClick as EventListener)
      marker.remove()
      markerRef.current = null
    }
  }, [map])

  useEffect(() => {
    markerRef.current?.setLngLat([position.lng, position.lat])
  }, [position.lng, position.lat])

  return <div ref={elRef}>{children}</div>
}
