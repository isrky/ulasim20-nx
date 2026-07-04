import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Popup as MapLibrePopup, type Map as MapLibreMap } from 'maplibre-gl'

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
  const [container, setContainer] = useState<HTMLDivElement | null>(null)

  // Mount: create popup + add to map. closeOnClick and anchor are intentionally
  // not deps: anchor has its own effect (cheap setLngLat), and closeOnClick is
  // only applied at construction; only the map identity should rebuild.
  // biome-ignore lint/correctness/useExhaustiveDependencies: see comment above
  useEffect(() => {
    const popup = new MapLibrePopup({
      closeOnClick,
      closeButton: false,
      anchor: 'bottom',
    })
      .setLngLat([anchor.lng, anchor.lat])
      .addTo(map)
    popup.on('close', onClose)
    popupRef.current = popup
    return () => {
      popup.remove()
      popupRef.current = null
    }
  }, [map])

  useEffect(() => {
    popupRef.current?.setLngLat([anchor.lng, anchor.lat])
  }, [anchor.lng, anchor.lat])

  return (
    <>
      <div ref={setContainer} style={{ display: 'none' }} />
      {container && createPortal(children, container)}
    </>
  )
}