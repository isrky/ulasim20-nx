/**
 * Denizli API Client
 * Upstream API ile iletişim
 */

import type {
  BusRoute,
  Env,
  GetAllRoutesResponse,
  GetAllStationsResponse,
  GetRouteStationsResponse,
  RouteWithStations,
  Station,
} from '../types'
import { CACHE_KEYS, CacheService } from './cache'

export class DenizliApiClient {
  private baseUrl: string
  private cache: CacheService
  private ctx?: ExecutionContext

  constructor(env: Env, ctx?: ExecutionContext) {
    this.baseUrl = env.UPSTREAM_API
    this.cache = new CacheService(env)
    this.ctx = ctx
  }

  /**
   * Make HTTP request to upstream API
   */
  private async fetch<T>(path: string): Promise<T> {
    const url = `${this.baseUrl}/UlasimBackend/api/Calc${path}`

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json; charset=utf-8',
        'X-Requested-With': 'XMLHttpRequest',
      },
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`)
    }

    return response.json() as Promise<T>
  }

  /**
   * Get all stations with caching
   */
  async getAllStations(forceRefresh = false): Promise<Station[]> {
    return this.cache.getOrSetSWR<Station[]>(CACHE_KEYS.STATIONS, {
      ttlSeconds: this.cache.getTTL('stations'),
      forceRefresh,
      ctx: this.ctx,
      loader: async () => {
        const data = await this.fetch<GetAllStationsResponse>('/GetAllStations')
        return Array.isArray(data.value) ? data.value : []
      },
    })
  }

  /**
   * Get all routes with caching
   */
  async getAllRoutes(forceRefresh = false): Promise<BusRoute[]> {
    return this.cache.getOrSetSWR<BusRoute[]>(CACHE_KEYS.ROUTES, {
      ttlSeconds: this.cache.getTTL('routes'),
      forceRefresh,
      ctx: this.ctx,
      loader: async () => {
        const data = await this.fetch<GetAllRoutesResponse>('/GetAllRoutes')
        return Array.isArray(data.value) ? data.value : []
      },
    })
  }

  /**
   * Get stations for a specific route with caching
   */
  async getRouteStations(
    lineCode: string,
    forceRefresh = false,
  ): Promise<RouteWithStations | null> {
    const cacheKey = CACHE_KEYS.ROUTE_STATIONS(lineCode)

    try {
      return await this.cache.getOrSetSWR<RouteWithStations>(cacheKey, {
        ttlSeconds: this.cache.getTTL('routeStations'),
        forceRefresh,
        ctx: this.ctx,
        loader: async () => {
          const data = await this.fetch<GetRouteStationsResponse>(
            `/GetRouteStations?routeCode=${encodeURIComponent(lineCode)}`,
          )

          const stations = data?.value?.stations
          if (!Array.isArray(stations)) {
            throw new Error('Invalid upstream response (stations missing)')
          }

          return {
            lineCode,
            lineName: data?.value?.lineName || lineCode,
            stations,
          }
        },
      })
    } catch (error) {
      console.error(`Error fetching route stations for ${lineCode}:`, error)
      return null
    }
  }

  /**
   * Get all route stations (batch fetch with caching)
   * This is the key optimization - fetches all routes in parallel
   */
  async getAllRouteStations(forceRefresh = false): Promise<RouteWithStations[]> {
    const cacheKey = CACHE_KEYS.ALL_ROUTE_STATIONS
    const ttlSeconds = this.cache.getTTL('routeStations')

    return this.cache.getOrSetSWR<RouteWithStations[]>(cacheKey, {
      ttlSeconds,
      forceRefresh,
      ctx: this.ctx,
      loader: async () => {
        const routes = await this.getAllRoutes(true)
        const results: RouteWithStations[] = []

        const BATCH_SIZE = 10
        for (let i = 0; i < routes.length; i += BATCH_SIZE) {
          const batch = routes.slice(i, i + BATCH_SIZE)
          const batchResults = await Promise.all(
            batch.map((route) => this.getRouteStations(route.lineCode, true)),
          )
          for (const r of batchResults) {
            if (r) results.push(r)
          }
        }

        // Avoid caching a completely failed refresh as an empty list.
        if (routes.length > 0 && results.length === 0) {
          throw new Error('Failed to fetch any route stations from upstream')
        }

        return results
      },
    })
  }

  /**
   * Get the complete transit graph (pre-computed for frontend)
   */
  async getTransitGraph(forceRefresh = false): Promise<{
    stations: Station[]
    routes: BusRoute[]
    routeStations: RouteWithStations[]
    generatedAt: number
    version: string
  }> {
    const cacheKey = CACHE_KEYS.GRAPH

    return this.cache.getOrSetSWR(cacheKey, {
      ttlSeconds: this.cache.getTTL('graph'),
      forceRefresh,
      ctx: this.ctx,
      loader: async () => {
        const [stations, routes, routeStations] = await Promise.all([
          this.getAllStations(true),
          this.getAllRoutes(true),
          this.getAllRouteStations(true),
        ])

        return {
          stations,
          routes,
          routeStations,
          generatedAt: Date.now(),
          version: '1.0.0',
        }
      },
    })
  }
}
