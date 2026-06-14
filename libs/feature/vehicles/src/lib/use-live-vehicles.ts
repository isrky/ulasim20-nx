import { useEffect, useState } from 'react'
import type { TransportApi } from '@ulasim20/data-access-transport-api'
import type { Vehicle } from '@ulasim20/types-transport'

export function useLiveVehicles(api: TransportApi) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  useEffect(() => {
    let cancelled = false
    const tick = () =>
      api.liveVehicles().then((res) => {
        if (!cancelled && res.ok) setVehicles(res.data)
      })
    tick()
    const id = setInterval(tick, 15_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [api])
  return vehicles
}
