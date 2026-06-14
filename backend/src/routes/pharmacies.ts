/**
 * Pharmacies Router
 * GET /api/pharmacies - Nöbetçi eczane listesi (scraped & cached)
 */

import { Hono } from 'hono'
import { CACHE_KEYS, CacheService } from '../services/cache'
import { scrapePharmacies } from '../services/pharmacy-scraper'
import type { Env } from '../types'
import type { PharmacyResponse } from '../types'

export const pharmaciesRouter = new Hono<{ Bindings: Env }>()

pharmaciesRouter.get('/', async (c) => {
  const refresh = c.req.query('refresh') === 'true'

  try {
    const cache = new CacheService(c.env)
    const ttl = cache.getTTL('pharmacies')

    const data = await cache.getOrSetSWR<PharmacyResponse>(CACHE_KEYS.PHARMACIES, {
      ttlSeconds: ttl,
      forceRefresh: refresh,
      ctx: c.executionCtx,
      loader: scrapePharmacies,
    })

    return c.json({
      success: true,
      data,
    })
  } catch (error) {
    console.error('Error fetching pharmacies:', error)
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch pharmacies',
      },
      500,
    )
  }
})
