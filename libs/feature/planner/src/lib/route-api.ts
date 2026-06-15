import {
  type HealthResponse,
  type Journey,
  type LatLng,
  type Leg,
  type PlannerInstallState,
  type RouteApiStation,
  type RouteLocation,
  type RouteRequest,
  type RouteResponse,
  type TransferAlternative,
  checkOfflinePlannerHealth,
  clearOfflinePlanner,
  findOfflineRoute,
  getAllOfflinePlannerStations,
  getOfflinePlannerStatus,
  installOfflinePlanner,
  toRouteLocationFromStation,
  useCurrentLocation,
} from './offline-planner'

export type {
  HealthResponse,
  Journey,
  LatLng,
  Leg,
  PlannerInstallState,
  RouteApiStation,
  RouteLocation,
  RouteRequest,
  RouteResponse,
  TransferAlternative,
}

export interface RouteApiError {
  error: string
  message: string
  statusCode: number
}

export class RouteApiRequestError extends Error {
  code: string
  statusCode: number

  constructor(message: string, code: string, statusCode: number) {
    super(message)
    this.name = 'RouteApiRequestError'
    this.code = code
    this.statusCode = statusCode
  }

  get userMessage(): string {
    switch (this.code) {
      case 'DATA_NOT_READY':
        return 'Çevrimdışı rota verisi henüz indirilmedi.'
      case 'ROUTE_NOT_FOUND':
        return 'Bu iki nokta arasında uygun bir rota bulunamadı.'
      default:
        return this.message || 'Beklenmeyen bir hata oluştu.'
    }
  }
}

export async function checkHealth(): Promise<HealthResponse> {
  return checkOfflinePlannerHealth()
}

export async function getPlannerStatus(): Promise<PlannerInstallState> {
  return getOfflinePlannerStatus()
}

export async function downloadPlannerDataset(
  onProgress?: (progress: number) => void,
): Promise<PlannerInstallState> {
  return installOfflinePlanner(onProgress)
}

export async function resetPlannerDataset(): Promise<void> {
  return clearOfflinePlanner()
}

export async function getAllRouteApiStations(): Promise<RouteApiStation[]> {
  try {
    return await getAllOfflinePlannerStations()
  } catch (error) {
    throw new RouteApiRequestError(
      error instanceof Error ? error.message : 'Rota veri seti hazır değil.',
      'DATA_NOT_READY',
      503,
    )
  }
}

export async function findRoute(
  request: RouteRequest,
  originInput?: RouteLocation,
  destinationInput?: RouteLocation,
): Promise<RouteResponse> {
  try {
    const response = await findOfflineRoute(request, originInput, destinationInput)
    if (response.journeys.length === 0) {
      throw new RouteApiRequestError(
        'Bu iki nokta arasında uygun rota bulunamadı.',
        'ROUTE_NOT_FOUND',
        404,
      )
    }
    return response
  } catch (error) {
    if (error instanceof RouteApiRequestError) throw error
    const message = error instanceof Error ? error.message : 'Rota hesaplama başarısız oldu.'
    const isDatasetError = message.includes('veri seti') || message.includes('IndexedDB')
    throw new RouteApiRequestError(
      message,
      isDatasetError ? 'DATA_NOT_READY' : 'ROUTE_PLANNER_ERROR',
      isDatasetError ? 503 : 500,
    )
  }
}

export async function getCurrentLocationOption(): Promise<RouteLocation> {
  return useCurrentLocation()
}

export function routeLocationFromStation(station: RouteApiStation): RouteLocation {
  return toRouteLocationFromStation(station)
}

export function formatSeconds(s: number): string {
  const m = Math.floor(s / 60)
  const sec = s % 60
  if (m === 0) return `${sec} sn`
  return sec > 0 ? `${m} dk ${sec} sn` : `${m} dk`
}

export function formatMinutes(s: number): string {
  const m = Math.round(s / 60)
  if (m < 60) return `${m} dk`
  const hours = Math.floor(m / 60)
  const mins = m % 60
  return mins > 0 ? `${hours} sa ${mins} dk` : `${hours} sa`
}

export function turkishUpper(s: string): string {
  return s.replace(/i/g, 'İ').replace(/ı/g, 'I').toUpperCase()
}

export function matchStation(query: string, stationName: string): boolean {
  if (!query) return true
  const q = turkishUpper(query.trim())
  const n = turkishUpper(stationName)
  return n.includes(q)
}
