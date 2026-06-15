import { ApiClient } from '@ulasim20/data-access-api-client'
import type { Route, Stop, Vehicle } from '@ulasim20/types-transport'
import type { ApiResponse } from '@ulasim20/types-api'

export class TransportApi {
  constructor(private readonly client: ApiClient) {}

  listRoutes(): Promise<ApiResponse<Route[]>> {
    return this.client.get<ApiResponse<Route[]>>('/routes')
  }

  listStops(): Promise<ApiResponse<Stop[]>> {
    return this.client.get<ApiResponse<Stop[]>>('/stops')
  }

  liveVehicles(): Promise<ApiResponse<Vehicle[]>> {
    return this.client.get<ApiResponse<Vehicle[]>>('/vehicles/live')
  }
}

export { pb, type FeedbackRecord } from './lib/pocketbase'
