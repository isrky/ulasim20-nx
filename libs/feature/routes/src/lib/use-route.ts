import { useEffect, useState } from 'react'
import type { TransportApi } from '@ulasim20/data-access-transport-api'
import type { Route } from '@ulasim20/types-transport'

export function useRoute(api: TransportApi, routeId: string) {
  const [route, setRoute] = useState<Route | null>(null)
  useEffect(() => {
    let cancelled = false
    api.listRoutes().then((res) => {
      if (cancelled || !res.ok) return
      setRoute(res.data.find((r) => r.id === routeId) ?? null)
    })
    return () => {
      cancelled = true
    }
  }, [api, routeId])
  return route
}
