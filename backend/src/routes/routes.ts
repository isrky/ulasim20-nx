/**
 * Routes Router - CPU Optimized
 * GET /api/routes - Tüm hatları getir
 * GET /api/routes/:lineCode/stations - Hat duraklarını getir
 * GET /api/routes/:lineCode/geometry - Hat geometrisini getir (OSRM)
 * GET /api/routes/graph - Tam transit graf (tek seferde)
 * GET /api/routes/geometries - Tüm hat geometrilerini getir
 * POST /api/routes/geometries/generate - Tüm geometrileri yeniden hesapla
 *
 * Optimizations:
 * - Cache-first for all reads
 * - Minimized response sizes
 * - Avoid CPU-intensive operations during requests
 */

import { Hono } from 'hono'
import { DenizliApiClient } from '../services/denizli-api'
import { KmzRouteGeometryService } from '../services/kmz-route-geometry'
import { RouteGeometryService } from '../services/route-geometry'
import type { Env } from '../types'

export const routesRouter = new Hono<{ Bindings: Env }>()

// GET /api/routes - Get all routes (lightweight)
routesRouter.get('/', async (c) => {
  const refresh = c.req.query('refresh') === 'true'

  try {
    const client = new DenizliApiClient(c.env, c.executionCtx)
    const routes = await client.getAllRoutes(refresh)

    // Return minimal response for free tier
    return c.json({
      success: true,
      count: routes.length,
      data: routes,
    })
  } catch (error) {
    console.error('Error fetching routes:', error)
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch routes',
      },
      500,
    )
  }
})

// GET /api/routes/graph - Get complete transit graph
// This is the main endpoint for frontend to get all data in one request
// Note: This is a large response - consider using /api/routes/graph/light for mobile
routesRouter.get('/graph', async (c) => {
  const refresh = c.req.query('refresh') === 'true'

  try {
    const client = new DenizliApiClient(c.env, c.executionCtx)
    const graph = await client.getTransitGraph(refresh)

    return c.json({
      success: true,
      data: graph,
      stats: {
        stations: graph.stations.length,
        routes: graph.routes.length,
        routeStations: graph.routeStations.length,
      },
    })
  } catch (error) {
    console.error('Error fetching transit graph:', error)
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch transit graph',
      },
      500,
    )
  }
})

// GET /api/routes/graph/light - Lightweight graph for planning only
// Returns minimal data needed for server-side planning
// Use this if frontend doesn't need full station/route details
routesRouter.get('/graph/light', async (c) => {
  try {
    const client = new DenizliApiClient(c.env, c.executionCtx)
    const [routes, stations] = await Promise.all([client.getAllRoutes(), client.getAllStations()])

    // Return only essential data
    return c.json({
      success: true,
      routes: routes.map((r) => ({
        lineCode: r.lineCode,
        lineName: r.lineName,
        shortLineName: r.shortLineName,
      })),
      stationCount: stations.length,
      routeCount: routes.length,
    })
  } catch (error) {
    console.error('Error fetching light graph:', error)
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch light graph',
      },
      500,
    )
  }
})

// GET /api/routes/all-stations - Get all route stations
routesRouter.get('/all-stations', async (c) => {
  const refresh = c.req.query('refresh') === 'true'

  try {
    const client = new DenizliApiClient(c.env, c.executionCtx)
    const routeStations = await client.getAllRouteStations(refresh)

    return c.json({
      success: true,
      count: routeStations.length,
      data: routeStations,
      cached: !refresh,
    })
  } catch (error) {
    console.error('Error fetching all route stations:', error)
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch route stations',
      },
      500,
    )
  }
})

// GET /api/routes/geometries - Get all route geometries (from cache only)
// This is FAST - serves pre-computed geometries from KV
// Use POST /api/routes/geometries/generate to populate cache
routesRouter.get('/geometries', async (c) => {
  try {
    const geometryService = new RouteGeometryService(c.env)

    // Get from cache only - no computation (CPU optimized)
    const geometries = await geometryService.getAllRouteGeometriesFromCache()

    if (geometries.size === 0) {
      return c.json({
        success: true,
        count: 0,
        data: {},
        cached: false,
        message: 'No cached geometries. Run POST /api/routes/geometries/generate to populate.',
      })
    }

    // Convert Map to object for JSON response
    const data: Record<string, { coordinates: [number, number][]; distance: number }> = {}
    for (const [lineCode, geometry] of geometries) {
      data[lineCode] = {
        coordinates: geometry.coordinates,
        distance: geometry.distance,
      }
    }

    return c.json({
      success: true,
      count: geometries.size,
      data,
      cached: true,
    })
  } catch (error) {
    console.error('Error fetching route geometries:', error)
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch route geometries',
      },
      500,
    )
  }
})

// POST /api/routes/geometries/generate - Regenerate all route geometries
// This is a long-running operation, use with caution
routesRouter.post('/geometries/generate', async (c) => {
  try {
    const client = new DenizliApiClient(c.env, c.executionCtx)
    const geometryService = new RouteGeometryService(c.env)

    // Get all route stations
    const routeStations = await client.getAllRouteStations(true)

    // Calculate all geometries (force refresh)
    const geometries = await geometryService.getAllRouteGeometries(routeStations, true)

    return c.json({
      success: true,
      message: 'Route geometries generated successfully',
      count: geometries.size,
      generatedAt: Date.now(),
    })
  } catch (error) {
    console.error('Error generating route geometries:', error)
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate route geometries',
      },
      500,
    )
  }
})

// GET /api/routes/:lineCode - Get route info
routesRouter.get('/:lineCode', async (c) => {
  const lineCode = c.req.param('lineCode')

  try {
    const client = new DenizliApiClient(c.env, c.executionCtx)
    const routes = await client.getAllRoutes()
    const route = routes.find((r) => r.lineCode === lineCode)

    if (!route) {
      return c.json({ success: false, error: 'Route not found' }, 404)
    }

    return c.json({
      success: true,
      data: route,
    })
  } catch (error) {
    console.error('Error fetching route:', error)
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch route',
      },
      500,
    )
  }
})

// GET /api/routes/:lineCode/stations - Get stations for a route
routesRouter.get('/:lineCode/stations', async (c) => {
  const lineCode = c.req.param('lineCode')
  const refresh = c.req.query('refresh') === 'true'

  try {
    const client = new DenizliApiClient(c.env, c.executionCtx)
    const routeStations = await client.getRouteStations(lineCode, refresh)

    if (!routeStations) {
      return c.json({ success: false, error: 'Route stations not found' }, 404)
    }

    return c.json({
      success: true,
      data: routeStations,
      cached: !refresh,
    })
  } catch (error) {
    console.error('Error fetching route stations:', error)
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch route stations',
      },
      500,
    )
  }
})

// GET /api/routes/:lineCode/geometry - Get cached KMZ-direct route geometry
routesRouter.get('/:lineCode/geometry', async (c) => {
  const lineCode = c.req.param('lineCode').toUpperCase()

  try {
    const geometryService = new KmzRouteGeometryService(c.env)
    const cached = await geometryService.getCached(lineCode)

    if (!cached) {
      return c.json({
        success: true,
        cached: false,
        status: 'miss',
        data: null,
      })
    }

    return c.json({
      success: true,
      data: {
        lineCode: cached.lineCode,
        coordinates: cached.coordinates,
        distance: cached.distance,
        source: cached.source,
      },
      cached: true,
    })
  } catch (error) {
    console.error('Error fetching route geometry:', error)
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch route geometry',
      },
      500,
    )
  }
})

// POST /api/routes/:lineCode/geometry/generate - Warm KMZ-direct route geometry cache
routesRouter.post('/:lineCode/geometry/generate', async (c) => {
  const lineCode = c.req.param('lineCode').toUpperCase()

  const generation = new KmzRouteGeometryService(c.env)
    .generateAndCache(lineCode)
    .catch((error) => {
      console.error(`Error generating route geometry for ${lineCode}:`, error)
    })

  c.executionCtx.waitUntil(generation)

  return c.json({ success: true, accepted: true }, 202)
})
