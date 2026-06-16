import L from 'leaflet'
import { Marker } from 'react-leaflet'
import type { Coordinates } from '@ulasim20/types-transport'

export function MapMarker({ position, title }: { position: Coordinates; title?: string }) {
  return (
    <Marker
      position={[position.lat, position.lon]}
      title={title}
      icon={L.divIcon({ className: 'map-marker' })}
    />
  )
}
