import type { ReactNode } from 'react'
import { MapContainer, TileLayer } from 'react-leaflet'

export function MapView({
  center,
  zoom = 13,
  children
}: {
  center: [number, number]
  zoom?: number
  children?: ReactNode
}) {
  return (
    <MapContainer center={center} zoom={zoom} style={{ height: '100%', width: '100%' }}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {children}
    </MapContainer>
  )
}
