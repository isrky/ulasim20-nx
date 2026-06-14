import type { Route, Stop } from '@ulasim20/types-transport'
import { MapMarker, MapView } from '@ulasim20/ui-map'

export function RoutePlanner({ route: _route, stops }: { route: Route; stops: Stop[] }) {
  const center = stops[0]
    ? [stops[0].location.lat, stops[0].location.lon]
    : [37.7765, 29.0864]
  return (
    <MapView center={center as [number, number]}>
      {stops.map((s) => (
        <MapMarker key={s.id} position={s.location} title={s.name} />
      ))}
    </MapView>
  )
}
