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