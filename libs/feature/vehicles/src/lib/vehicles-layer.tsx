import { MapMarker } from '@ulasim20/ui-map'
import type { Vehicle } from '@ulasim20/types-transport'

export function VehiclesLayer({ vehicles }: { vehicles: Vehicle[] }) {
  return (
    <>
      {vehicles.map((v) => (
        <MapMarker key={v.id} position={v.position} title={v.routeId} />
      ))}
    </>
  )
}
