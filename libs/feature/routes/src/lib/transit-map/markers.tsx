import { useEffect } from 'react'
import { MapMarker, useMapInstance } from '@ulasim20/ui-map'
import type { RefillPoint, ProcessedStation } from './use-transit-map'
import { SEARCH_HIGHLIGHT_ZOOM } from './constants'
import { refillIconSvg, searchHighlightSvg, userIconSvg } from './icons'

export function UserLocationMarker({ position }: { position: { lng: number; lat: number } | null }) {
  const map = useMapInstance()
  if (!map || !position) return null
  return (
    <MapMarker map={map} position={position} className="user-location-marker">
      <span
        aria-hidden
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static SVG string built in our own icons.ts helpers, no untrusted input
        dangerouslySetInnerHTML={{ __html: userIconSvg() }}
      />
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
      <span
        aria-hidden
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static SVG string built in our own icons.ts helpers, no untrusted input
        dangerouslySetInnerHTML={{ __html: refillIconSvg() }}
      />
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
      <span
        aria-hidden
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static SVG string built in our own icons.ts helpers, no untrusted input
        dangerouslySetInnerHTML={{ __html: searchHighlightSvg() }}
      />
    </MapMarker>
  )
}