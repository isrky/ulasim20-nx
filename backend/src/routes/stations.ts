/**
 * Stations Router - CPU Optimized
 * GET /api/stations - Tüm durakları getir
 *
 * Optimizations:
 * - Fast distance calculation (equirectangular approximation)
 * - Early termination in nearby search
 * - Reduced limits for free tier
 */

import { Hono } from 'hono'
import { DenizliApiClient } from '../services/denizli-api'
import type { Env } from '../types'

export const stationsRouter = new Hono<{ Bindings: Env }>()

/**
 * Fast distance calculation using equirectangular approximation
 * ~2x faster than Haversine for short distances (<50km)
 */
function fastDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = (lat2 - lat1) * 0.0174533
  const dLng = (lng2 - lng1) * 0.0174533
  const avgLat = ((lat1 + lat2) / 2) * 0.0174533
  const x = dLng * Math.cos(avgLat)
  return R * Math.sqrt(dLat * dLat + x * x)
}

// GET /api/stations - Get all stations
stationsRouter.get('/', async (c) => {
  const refresh = c.req.query('refresh') === 'true'

  try {
    const client = new DenizliApiClient(c.env, c.executionCtx)
    const stations = await client.getAllStations(refresh)

    return c.json({
      success: true,
      count: stations.length,
      data: stations,
    })
  } catch (error) {
    console.error('Error fetching stations:', error)
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch stations',
      },
      500,
    )
  }
})

// GET /api/stations/:id - Get station by ID
stationsRouter.get('/:id', async (c) => {
  const stationId = Number.parseInt(c.req.param('id'))

  if (Number.isNaN(stationId)) {
    return c.json({ success: false, error: 'Invalid station ID' }, 400)
  }

  try {
    const client = new DenizliApiClient(c.env, c.executionCtx)
    const stations = await client.getAllStations()
    const station = stations.find((s) => s.stationId === stationId)

    if (!station) {
      return c.json({ success: false, error: 'Station not found' }, 404)
    }

    return c.json({
      success: true,
      data: station,
    })
  } catch (error) {
    console.error('Error fetching station:', error)
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch station',
      },
      500,
    )
  }
})

// GET /api/stations/nearby?lat=X&lng=Y&radius=500 - Find nearby stations
// Optimized for CPU: uses fast distance formula and early termination
stationsRouter.get('/nearby', async (c) => {
  const lat = Number.parseFloat(c.req.query('lat') || '')
  const lng = Number.parseFloat(c.req.query('lng') || '')
  const radius = Math.min(Number.parseInt(c.req.query('radius') || '500'), 1000) // Cap at 1km
  const limit = Math.min(Number.parseInt(c.req.query('limit') || '5'), 10) // Cap at 10

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return c.json({ success: false, error: 'Invalid coordinates' }, 400)
  }

  try {
    const client = new DenizliApiClient(c.env, c.executionCtx)
    const stations = await client.getAllStations()

    // Pre-filter by bounding box (fast, avoids trig for far stations)
    const degRadius = radius / 111000 // Approximate degrees
    const minLat = lat - degRadius
    const maxLat = lat + degRadius
    const minLng = lng - degRadius * 1.5 // Account for longitude compression
    const maxLng = lng + degRadius * 1.5

    const nearbyStations: Array<(typeof stations)[0] & { distance: number }> = []

    for (const station of stations) {
      const stationLat = Number.parseFloat(String(station.latitude).replace(',', '.'))
      const stationLng = Number.parseFloat(String(station.longitude).replace(',', '.'))

      if (Number.isNaN(stationLat) || Number.isNaN(stationLng)) continue

      // Quick bounding box check (very fast)
      if (
        stationLat < minLat ||
        stationLat > maxLat ||
        stationLng < minLng ||
        stationLng > maxLng
      ) {
        continue
      }

      // Full distance calculation only for candidates
      const distance = Math.round(fastDistanceMeters(lat, lng, stationLat, stationLng))

      if (distance <= radius) {
        nearbyStations.push({ ...station, distance })
      }
    }

    // Sort by distance and limit
    nearbyStations.sort((a, b) => a.distance - b.distance)

    return c.json({
      success: true,
      count: nearbyStations.length,
      data: nearbyStations.slice(0, limit),
    })
  } catch (error) {
    console.error('Error finding nearby stations:', error)
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to find nearby stations',
      },
      500,
    )
  }
})
