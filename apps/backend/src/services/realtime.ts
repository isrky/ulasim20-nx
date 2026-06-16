/**
 * Real-time Service
 * Integrates upstream "live arrivals" into planning.
 *
 * Notes:
 * - Upstream endpoints are best-effort and may be unavailable.
 * - We keep TTL very short (default 10s) to avoid stale predictions.
 */

import type { Env, GetBusDataForStationResponse, LiveBusArrival } from '../types'
import { CACHE_KEYS, CacheService } from './cache'

export interface NextArrivalEstimate {
  /** Estimated wait time (minutes) until the next vehicle arrives to the station */
  waitMinutes: number
  /** Epoch ms when fetched */
  updatedAt: number
  /** Vehicle plate when available */
  plate: string | null
  /** Heuristic confidence */
  confidence: 'high' | 'medium'
}

function normalizeLineCode(lineCode: string): string {
  return String(lineCode || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
}

function parseSecondsHHMMSS(value: string): number | null {
  const parts = value.split(':').map((p) => Number(p))
  if (parts.length < 2) return null
  if (parts.some((n) => !Number.isFinite(n))) return null
  const [h = 0, m = 0, s = 0] = parts
  const total = h * 3600 + m * 60 + s
  return Number.isFinite(total) ? total : null
}

function parseNumberLike(value: string | null | undefined): number | null {
  if (!value) return null
  const v = Number(String(value).replace(',', '.'))
  return Number.isFinite(v) ? v : null
}

function estimateWaitMinutesFromArrival(item: LiveBusArrival): number | null {
  // Preferred: "sure" field (HH:MM:SS or MM:SS)
  if (item.sure) {
    const sec = parseSecondsHHMMSS(item.sure)
    if (sec != null) {
      if (sec < 30) return 0
      return Math.min(240, Math.max(0, Math.ceil(sec / 60)))
    }
  }

  // Fallback: "kalkisaKadarkiDakika" (minutes)
  const mins = parseNumberLike(item.kalkisaKadarkiDakika)
  if (mins != null) {
    return Math.min(240, Math.max(0, Math.ceil(mins)))
  }

  return null
}

async function upstreamGet<T>(env: Env, path: string): Promise<T> {
  const url = `${env.UPSTREAM_API}/UlasimBackend/api/Calc${path}`
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json; charset=utf-8',
      'X-Requested-With': 'XMLHttpRequest',
    },
  })

  if (!response.ok) {
    throw new Error(`Upstream API error: ${response.status} ${response.statusText}`)
  }

  return response.json() as Promise<T>
}

export class RealTimeService {
  private env: Env
  private cache: CacheService
  private ctx?: ExecutionContext

  constructor(env: Env, ctx?: ExecutionContext) {
    this.env = env
    this.cache = new CacheService(env)
    this.ctx = ctx
  }

  /**
   * Best-effort next arrival estimate for a station + line.
   *
   * Implementation:
   * - Calls upstream `GetBusDataForStation`
   * - Filters by lineCode (direction-insensitive: ignores trailing "D")
   * - Picks the smallest positive wait estimate
   */
  async getNextArrivalEstimate(
    stationId: number,
    lineCode: string,
    opts?: { forceRefresh?: boolean },
  ): Promise<NextArrivalEstimate | null> {
    const normalized = normalizeLineCode(lineCode)
    if (!normalized || !Number.isFinite(stationId)) return null

    const ttl = this.cache.getTTL('realtime')
    const cacheKey = CACHE_KEYS.REALTIME_STATION_LINE(stationId, normalized)

    try {
      return await this.cache.getOrSetSWR<NextArrivalEstimate | null>(cacheKey, {
        ttlSeconds: ttl,
        staleWhileRevalidateSeconds: Math.max(5, ttl),
        forceRefresh: opts?.forceRefresh,
        // If stale and we have ctx, refresh in background.
        revalidateOnStale: !!this.ctx,
        ctx: this.ctx,
        loader: async () => {
          // Try with routeCode filter first (smaller payload), then fallback to empty routeCode.
          const encodedStation = encodeURIComponent(String(stationId))

          const tryFetch = async (routeCode: string) => {
            const encodedRoute = encodeURIComponent(routeCode)
            return upstreamGet<GetBusDataForStationResponse>(
              this.env,
              `/GetBusDataForStation?waitingStation=${encodedStation}&routeCode=${encodedRoute}`,
            )
          }

          let data: GetBusDataForStationResponse
          try {
            data = await tryFetch(normalized)
          } catch {
            data = await tryFetch('')
          }

          const list = data?.value?.busList
          if (!Array.isArray(list) || list.length === 0) return null

          const targetNoD = normalized.replace(/D$/i, '').replace(/-$/, '')

          let best: NextArrivalEstimate | null = null
          const now = Date.now()

          for (const item of list) {
            const hatno = normalizeLineCode(item?.hatno || '')
            if (!hatno) continue

            const hatNoD = hatno.replace(/D$/i, '').replace(/-$/, '')
            if (hatNoD !== targetNoD) continue

            const waitMinutes = estimateWaitMinutesFromArrival(item)
            if (waitMinutes == null) continue

            // Ignore obviously wrong predictions
            if (waitMinutes > 180) continue

            const plate = item?.plaka ?? null
            const confidence: NextArrivalEstimate['confidence'] =
              plate && plate !== 'EnYakinKalkis' ? 'high' : 'medium'

            if (!best || waitMinutes < best.waitMinutes) {
              best = {
                waitMinutes,
                updatedAt: now,
                plate: plate && plate !== 'EnYakinKalkis' ? plate : null,
                confidence,
              }
            }
          }

          return best
        },
      })
    } catch (error) {
      console.warn('Realtime estimate failed:', { stationId, lineCode, error })
      return null
    }
  }
}
