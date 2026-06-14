/**
 * Cache Service
 * Cloudflare KV wrapper with stale-while-revalidate + in-memory L1 cache
 *
 * Goals:
 * - Safe JSON parsing + backward compatible with old cache entry shape
 * - Stale-while-revalidate that actually runs on Workers (via `ExecutionContext.waitUntil`)
 * - In-flight de-duplication to prevent thundering herds on cache-miss/revalidate
 * - Small in-memory L1 to reduce KV reads within a hot worker isolate
 */

import type { Env } from '../types'

// ============================================================================
// Types
// ============================================================================

/**
 * Cache entry format (v2).
 *
 * - `freshUntil`: after this time the entry is considered stale
 * - `expiresAt`: hard-expiry; after this time the entry is considered missing
 */
export interface CacheEntryV2<T> {
  v: 2
  data: T
  cachedAt: number
  freshUntil: number
  expiresAt: number
}

// Back-compat: previous format was { data, cachedAt, expiresAt } where expiresAt was the freshness boundary.
type CacheEntryV1<T> = {
  data: T
  cachedAt: number
  expiresAt: number
}

type CacheReadResult<T> = {
  data: T
  isStale: boolean
  cachedAt: number
  freshUntil: number
  expiresAt: number
}

// ============================================================================
// Module-level state (per Worker isolate)
// ============================================================================

const MEMORY_MAX_ENTRIES = 100

/**
 * L1 memory cache. Small and opportunistic (best-effort).
 * Key -> entry (v2) where `expiresAt` is the hard-expiry.
 */
const memoryCache = new Map<string, CacheEntryV2<unknown>>()

/**
 * In-flight refreshes and computations to avoid stampedes.
 */
const refreshInFlight = new Map<string, Promise<void>>()
const computeInFlight = new Map<string, Promise<unknown>>()

function enforceMemoryLimit(): void {
  while (memoryCache.size > MEMORY_MAX_ENTRIES) {
    const firstKey = memoryCache.keys().next().value as string | undefined
    if (!firstKey) return
    memoryCache.delete(firstKey)
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function toV2Entry<T>(
  entry: CacheEntryV2<T> | CacheEntryV1<T>,
  opts?: { defaultStaleWhileRevalidateMs?: number },
): CacheEntryV2<T> | null {
  // v2
  if ((entry as CacheEntryV2<T>).v === 2) {
    const e = entry as CacheEntryV2<T>
    if (
      e.v === 2 &&
      isFiniteNumber(e.cachedAt) &&
      isFiniteNumber(e.freshUntil) &&
      isFiniteNumber(e.expiresAt)
    ) {
      return e
    }
    return null
  }

  // v1 back-compat: expiresAt used to mean "freshUntil".
  const e1 = entry as CacheEntryV1<T>
  if (!isFiniteNumber(e1.cachedAt) || !isFiniteNumber(e1.expiresAt)) return null

  const ttlMs = e1.expiresAt - e1.cachedAt
  const swrMs = (opts?.defaultStaleWhileRevalidateMs ?? 0) || (ttlMs > 0 ? ttlMs : 0)

  const hardExpiresAt = ttlMs > 0 ? e1.expiresAt + swrMs : e1.expiresAt + 60_000 // 60s safety

  return {
    v: 2,
    data: e1.data,
    cachedAt: e1.cachedAt,
    freshUntil: e1.expiresAt,
    expiresAt: hardExpiresAt,
  }
}

export class CacheService {
  private kv: KVNamespace
  private env: Env

  constructor(env: Env) {
    this.kv = env.CACHE
    this.env = env
  }

  /**
   * Get value from cache
   * Returns null if not found, corrupted, stale, or hard-expired.
   */
  async get<T>(key: string): Promise<T | null> {
    const res = await this.getWithStale<T>(key)
    if (!res || res.isStale) return null
    return res.data
  }

  /**
   * Get value from cache, including stale data
   * Returns { data, isStale } or null if not found
   */
  async getWithStale<T>(key: string): Promise<{ data: T; isStale: boolean } | null> {
    const res = await this.getDetailed<T>(key)
    if (!res) return null
    return { data: res.data, isStale: res.isStale }
  }

  /**
   * Same as `getWithStale` but includes timestamps for callers that need them.
   */
  async getDetailed<T>(key: string): Promise<CacheReadResult<T> | null> {
    try {
      const now = Date.now()

      // L1 first
      const mem = memoryCache.get(key) as CacheEntryV2<T> | undefined
      if (mem) {
        if (now >= mem.expiresAt) {
          memoryCache.delete(key)
        } else {
          const isStale = now >= mem.freshUntil
          return {
            data: mem.data,
            isStale,
            cachedAt: mem.cachedAt,
            freshUntil: mem.freshUntil,
            expiresAt: mem.expiresAt,
          }
        }
      }

      // L2 KV
      const raw = await this.kv.get(key, 'text')
      if (!raw) return null

      const parsed = JSON.parse(raw) as CacheEntryV2<T> | CacheEntryV1<T>
      const entry = toV2Entry<T>(parsed)
      if (!entry) {
        // Corrupted entry - delete best-effort
        this.kv.delete(key).catch(() => {})
        return null
      }

      if (now >= entry.expiresAt) {
        // Hard-expired - delete best-effort
        this.kv.delete(key).catch(() => {})
        return null
      }

      // Store to memory L1 (keep insertion order for eviction)
      memoryCache.delete(key)
      memoryCache.set(key, entry as CacheEntryV2<unknown>)
      enforceMemoryLimit()

      const isStale = now >= entry.freshUntil
      return {
        data: entry.data,
        isStale,
        cachedAt: entry.cachedAt,
        freshUntil: entry.freshUntil,
        expiresAt: entry.expiresAt,
      }
    } catch (error) {
      console.error(`Cache get error for key ${key}:`, error)
      return null
    }
  }

  /**
   * Set value in cache with TTL
   * @param key Cache key
   * @param data Data to cache
   * @param ttlSeconds Time to live in seconds
   */
  async set<T>(
    key: string,
    data: T,
    ttlSeconds: number,
    options?: { staleWhileRevalidateSeconds?: number },
  ): Promise<void> {
    try {
      const now = Date.now()
      const staleSeconds = Math.max(0, options?.staleWhileRevalidateSeconds ?? ttlSeconds)

      const entry: CacheEntryV2<T> = {
        v: 2,
        data,
        cachedAt: now,
        freshUntil: now + ttlSeconds * 1000,
        expiresAt: now + (ttlSeconds + staleSeconds) * 1000,
      }

      // KV hard TTL should cover the full stale window (+ small buffer).
      const hardTtlSeconds = Math.max(60, Math.ceil((entry.expiresAt - now) / 1000) + 60)

      // Update memory first for hot-path reads.
      memoryCache.delete(key)
      memoryCache.set(key, entry as unknown as CacheEntryV2<unknown>)
      enforceMemoryLimit()

      await this.kv.put(key, JSON.stringify(entry), {
        expirationTtl: hardTtlSeconds,
      })
    } catch (error) {
      console.error(`Cache set error for key ${key}:`, error)
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<void> {
    try {
      memoryCache.delete(key)
      await this.kv.delete(key)
    } catch (error) {
      console.error(`Cache delete error for key ${key}:`, error)
    }
  }

  /**
   * Cache-aside helper with real SWR.
   *
   * Behavior:
   * - fresh hit: returns cached
   * - stale hit: returns stale immediately and schedules background revalidate (if ctx provided)
   * - miss/hard-expired: computes, stores, returns
   */
  async getOrSetSWR<T>(
    key: string,
    params: {
      ttlSeconds: number
      staleWhileRevalidateSeconds?: number
      forceRefresh?: boolean
      revalidateOnStale?: boolean
      ctx?: ExecutionContext
      loader: () => Promise<T>
    },
  ): Promise<T> {
    const {
      ttlSeconds,
      staleWhileRevalidateSeconds,
      forceRefresh,
      revalidateOnStale = true,
      ctx,
      loader,
    } = params

    if (!forceRefresh) {
      const cached = await this.getDetailed<T>(key)
      if (cached) {
        if (!cached.isStale) return cached.data
        // stale: schedule refresh and return stale immediately
        if (revalidateOnStale) {
          this.scheduleRevalidate<T>(key, ttlSeconds, staleWhileRevalidateSeconds, loader, ctx)
        }
        return cached.data
      }
    }

    // miss or forced refresh: compute with de-dupe
    const existing = computeInFlight.get(key) as Promise<T> | undefined
    if (existing) return existing

    const computePromise = (async () => {
      const value = await loader()
      await this.set(key, value, ttlSeconds, { staleWhileRevalidateSeconds })
      return value
    })()

    computeInFlight.set(key, computePromise as Promise<unknown>)
    computePromise.finally(() => {
      computeInFlight.delete(key)
    })

    return computePromise
  }

  private scheduleRevalidate<T>(
    key: string,
    ttlSeconds: number,
    staleWhileRevalidateSeconds: number | undefined,
    loader: () => Promise<T>,
    ctx?: ExecutionContext,
  ): void {
    if (refreshInFlight.has(key)) return

    const refreshPromise = (async () => {
      try {
        const value = await loader()
        await this.set(key, value, ttlSeconds, { staleWhileRevalidateSeconds })
      } catch (error) {
        console.error(`Cache revalidate error for key ${key}:`, error)
      }
    })()

    refreshInFlight.set(key, refreshPromise)
    refreshPromise.finally(() => {
      refreshInFlight.delete(key)
    })

    if (ctx) {
      ctx.waitUntil(refreshPromise)
    }
  }

  /**
   * Get TTL values from environment
   */
  getTTL(
    type:
      | 'stations'
      | 'routes'
      | 'routeStations'
      | 'graph'
      | 'plannerIndex'
      | 'geometry'
      | 'realtime'
      | 'pharmacies',
  ): number {
    switch (type) {
      case 'stations':
        return Number.parseInt(this.env.CACHE_TTL_STATIONS) || 86400
      case 'routes':
        return Number.parseInt(this.env.CACHE_TTL_ROUTES) || 86400
      case 'routeStations':
        return Number.parseInt(this.env.CACHE_TTL_ROUTE_STATIONS) || 43200
      case 'graph':
        return Number.parseInt(this.env.CACHE_TTL_GRAPH) || 21600
      case 'plannerIndex':
        return Number.parseInt(this.env.CACHE_TTL_PLANNER_INDEX || '21600') || 21600
      case 'geometry':
        return (
          Number.parseInt(
            (this.env as Env & { CACHE_TTL_GEOMETRY?: string }).CACHE_TTL_GEOMETRY || '2592000',
          ) || 2592000
        )
      case 'realtime':
        return (
          Number.parseInt(
            (this.env as Env & { CACHE_TTL_REALTIME?: string }).CACHE_TTL_REALTIME || '10',
          ) || 10
        )
      case 'pharmacies':
        return Number.parseInt(this.env.CACHE_TTL_PHARMACIES || '3600') || 3600
    }
  }
}

// Cache keys
export const CACHE_KEYS = {
  STATIONS: 'stations:all',
  ROUTES: 'routes:all',
  ROUTE_STATIONS: (lineCode: string) => `route:${lineCode}:stations`,
  ALL_ROUTE_STATIONS: 'routes:all:stations',
  GRAPH: 'graph:full',
  // Route geometry cache keys
  ROUTE_GEOMETRY: (lineCode: string) => `route:${lineCode}:geometry`,
  ALL_ROUTE_GEOMETRIES: 'routes:all:geometries',
  // Pre-computed planner index (for CPU optimization)
  PLANNER_INDEX: 'planner:index:v2',
  // Real-time data (short TTL)
  REALTIME_STATION_LINE: (stationId: number, lineCode: string) =>
    `realtime:station:${stationId}:line:${lineCode}`,
  // Pharmacy on-duty data (scraped)
  PHARMACIES: 'pharmacies:onduty',
  FEEDBACK: (id: string) => `feedback:${id}`,
} as const
