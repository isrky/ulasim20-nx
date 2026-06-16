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

export {
  backendOrigin,
  CACHE_TTL_MS,
  isBackendReachable,
  resolveBackendUrl,
  resolveRuntimeUrl,
} from './lib/denizli'

export type {
  BusData,
  BusDataForStationResponse,
  BusRoute,
  Dealer,
  GetAllDealersResponse,
  PharmacyData,
  PharmacyResponse,
  RouteGeometry,
  RouteGeometryResult,
  RouteStation,
  RouteWithStations,
  Station,
} from './lib/denizli'

export {
  apiGet,
  checkBackendStatus,
  clearRouteStationsCache,
  clearRoutesCache,
  clearStationsCache,
  getAllDealers,
  getAllRouteGeometries,
  getAllRouteStations,
  getAllRouteStationsOptimized,
  getAllRoutes,
  getAllStations,
  getBusDataForStation,
  getPharmacies,
  getRouteGeometry,
  getRouteGeometryResult,
  getRouteStations,
  getTransitGraphFromBackend,
  triggerRouteGeometryGeneration,
} from './lib/denizli'
