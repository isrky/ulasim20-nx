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

  // Mount: create popup + add to map. closeOnClick and onClose are intentionally
  // not deps: anchor has its own effect (cheap setLngLat), closeOnClick is only
  // applied at construction, and onClose is re-registered in a separate effect
  // so the listener stays fresh without rebuilding the popup; only the map
  // identity should rebuild.
  // biome-ignore lint/correctness/useExhaustiveDependencies: see comment above
  useEffect(() => {
    const popup = new MapLibrePopup({
      closeOnClick,
      closeButton: false,
      anchor: 'bottom',
    })
      .setLngLat([anchor.lng, anchor.lat])
      .addTo(map)
    popupRef.current = popup
    return () => {
      popup.remove()
      popupRef.current = null
    }
  }, [map])

  // Position updates.
  useEffect(() => {
    popupRef.current?.setLngLat([anchor.lng, anchor.lat])
  }, [anchor.lng, anchor.lat])

  // Wire React-rendered children into the popup. The ref-callback pattern below
  // sets `container` on mount/update; this effect forwards that node to the
  // popup so children render inside it instead of the hidden React div.
  useEffect(() => {
    if (popupRef.current && container) {
      popupRef.current.setDOMContent(container)
    }
  }, [container])

  // Keep onClose fresh: re-register the listener whenever the prop changes so
  // it doesn't capture a stale closure.
  useEffect(() => {
    const popup = popupRef.current
    if (!popup) return
    popup.on('close', onClose)
    return () => {
      popup.off('close', onClose)
    }
  }, [onClose])

  return (
    <>
      <div ref={setContainer} style={{ display: 'none' }} />
      {container && createPortal(children, container)}
    </>
  )
}
