import { http, HttpResponse } from 'msw'
import type { Route, Stop, Vehicle } from '@ulasim20/types-transport'

export const handlers = [
  http.get('/api/routes', () =>
    HttpResponse.json<{ ok: true; data: Route[] }>({ ok: true, data: [] })
  ),
  http.get('/api/stops', () =>
    HttpResponse.json<{ ok: true; data: Stop[] }>({ ok: true, data: [] })
  ),
  http.get('/api/vehicles/live', () =>
    HttpResponse.json<{ ok: true; data: Vehicle[] }>({ ok: true, data: [] })
  )
]
