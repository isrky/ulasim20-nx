/**
 * Route Geometry Service - KMZ + Adaptive OSRM Hybrid
 *
 * Strateji:
 * 1. Belediyenin KMZ dosyasından koordinatları al (en doğru kaynak)
 * 2. Adaptif waypoint seçimi (mesafe + açı bazlı)
 * 3. Seçilen waypoint'leri OSRM'ye gönder (yol detayları için)
 * 4. Fallback zinciri: KMZ+OSRM → Sadece KMZ → Durak+OSRM → Düz çizgi
 *
 * CPU Optimizasyonları:
 * - Pre-computed geometries served from KV cache
 * - Douglas-Peucker simplification for final output
 * - Coordinate precision reduced (6 decimal places)
 */

import type { Env, RouteStation, RouteWithStations } from '../types'
import { CACHE_KEYS, CacheService } from './cache'

// Coordinate type for geometry [lat, lng]
export type LatLng = [number, number]

// Route geometry with metadata
export interface RouteGeometry {
  lineCode: string
  coordinates: LatLng[]
  distance: number // meters
  duration: number // seconds
  generatedAt: number
  source?: 'kmz+osrm' | 'kmz' | 'osrm' | 'straight' // Debug: geometry source
}

// Simplified geometry for transfer (smaller payload)
export interface SimpleGeometry {
  c: LatLng[] // coordinates (shortened key)
  d: number // distance
}

// OSRM response types
interface OSRMRoute {
  geometry: {
    coordinates: [number, number][] // [lng, lat]
  }
  distance: number
  duration: number
}

interface OSRMResponse {
  code: string
  routes?: OSRMRoute[]
}

// KMZ base URL
const KMZ_BASE_URL = 'https://ulasim.denizli.bel.tr/guzergah'

// Adaptive waypoint selection parameters
const WAYPOINT_CONFIG = {
  MIN_WAYPOINTS: 10, // Minimum waypoints for any route
  MAX_WAYPOINTS: 80, // OSRM limit
  MIN_DISTANCE_M: 50, // Minimum distance between waypoints (meters)
  MAX_DISTANCE_M: 300, // Maximum distance between waypoints (meters)
  ANGLE_THRESHOLD_DEG: 20, // Add waypoint if angle change > this
}

// ============================================================================
// MATH UTILITIES
// ============================================================================

/**
 * Calculate distance between two coordinates in meters (Haversine)
 */
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000 // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Calculate angle between three points in degrees
 * Returns the angle at point B in the path A -> B -> C
 */
function calculateAngle(a: LatLng, b: LatLng, c: LatLng): number {
  const [latA, lngA] = a
  const [latB, lngB] = b
  const [latC, lngC] = c

  // Vector BA
  const baLat = latA - latB
  const baLng = lngA - lngB

  // Vector BC
  const bcLat = latC - latB
  const bcLng = lngC - lngB

  // Dot product and magnitudes
  const dot = baLat * bcLat + baLng * bcLng
  const magBA = Math.sqrt(baLat ** 2 + baLng ** 2)
  const magBC = Math.sqrt(bcLat ** 2 + bcLng ** 2)

  if (magBA === 0 || magBC === 0) return 180

  // Angle in degrees
  const cosAngle = Math.max(-1, Math.min(1, dot / (magBA * magBC)))
  return (Math.acos(cosAngle) * 180) / Math.PI
}

/**
 * Round coordinate to 6 decimal places (~0.1m precision)
 */
function roundCoord(coord: LatLng): LatLng {
  return [Math.round(coord[0] * 1000000) / 1000000, Math.round(coord[1] * 1000000) / 1000000]
}

/**
 * Calculate total distance of a path
 */
function calculatePathDistance(coords: LatLng[]): number {
  let total = 0
  for (let i = 1; i < coords.length; i++) {
    total += haversineDistance(coords[i - 1][0], coords[i - 1][1], coords[i][0], coords[i][1])
  }
  return total
}

// ============================================================================
// KMZ PARSING
// ============================================================================

/**
 * Fetch and parse KMZ file for a route
 * KMZ contains pre-drawn route geometry from municipality
 */
async function fetchKMZGeometry(lineCode: string): Promise<{
  gidis: LatLng[] | null
  donus: LatLng[] | null
} | null> {
  try {
    // Extract base code (440D -> 440)
    const baseCode = lineCode.replace(/D$/i, '').replace(/-$/, '')
    const url = `${KMZ_BASE_URL}/${baseCode}.kmz`

    const response = await fetch(url)
    if (!response.ok) {
      console.info(`KMZ not found for ${lineCode}: ${response.status}`)
      return null
    }

    // KMZ is a ZIP file containing KML
    const arrayBuffer = await response.arrayBuffer()
    const kmlContent = await extractKMLFromKMZ(arrayBuffer)

    if (!kmlContent) {
      console.info(`Could not extract KML from KMZ for ${lineCode}`)
      return null
    }

    // Parse coordinates from KML
    return parseKMLCoordinates(kmlContent)
  } catch (error) {
    console.error(`Error fetching KMZ for ${lineCode}:`, error)
    return null
  }
}

/**
 * Extract KML content from KMZ (ZIP) file
 * Uses simple ZIP parsing without external libraries
 */
async function extractKMLFromKMZ(arrayBuffer: ArrayBuffer): Promise<string | null> {
  try {
    const uint8 = new Uint8Array(arrayBuffer)

    // Find PK signature (ZIP file)
    if (uint8[0] !== 0x50 || uint8[1] !== 0x4b) {
      return null
    }

    // Simple ZIP parsing - find the file data
    // ZIP local file header: PK\x03\x04
    let offset = 0
    while (offset < uint8.length - 30) {
      if (
        uint8[offset] === 0x50 &&
        uint8[offset + 1] === 0x4b &&
        uint8[offset + 2] === 0x03 &&
        uint8[offset + 3] === 0x04
      ) {
        // Read local file header
        const compressionMethod = uint8[offset + 8] | (uint8[offset + 9] << 8)
        const compressedSize =
          uint8[offset + 18] |
          (uint8[offset + 19] << 8) |
          (uint8[offset + 20] << 16) |
          (uint8[offset + 21] << 24)
        const fileNameLength = uint8[offset + 26] | (uint8[offset + 27] << 8)
        const extraLength = uint8[offset + 28] | (uint8[offset + 29] << 8)

        const fileName = new TextDecoder().decode(
          uint8.slice(offset + 30, offset + 30 + fileNameLength),
        )

        const dataStart = offset + 30 + fileNameLength + extraLength
        const fileData = uint8.slice(dataStart, dataStart + compressedSize)

        // Check if this is a KML file
        if (fileName.toLowerCase().endsWith('.kml')) {
          if (compressionMethod === 0) {
            // Stored (no compression)
            return new TextDecoder().decode(fileData)
          }
          if (compressionMethod === 8) {
            // Deflate compression - use DecompressionStream
            try {
              const ds = new DecompressionStream('deflate-raw')
              const writer = ds.writable.getWriter()
              writer.write(fileData)
              writer.close()

              const reader = ds.readable.getReader()
              const chunks: Uint8Array[] = []

              while (true) {
                const { done, value } = await reader.read()
                if (done) break
                chunks.push(value)
              }

              const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
              const result = new Uint8Array(totalLength)
              let position = 0
              for (const chunk of chunks) {
                result.set(chunk, position)
                position += chunk.length
              }

              return new TextDecoder().decode(result)
            } catch (e) {
              console.error('Decompression failed:', e)
              return null
            }
          }
        }

        offset = dataStart + compressedSize
      } else {
        offset++
      }
    }

    return null
  } catch (error) {
    console.error('Error extracting KML:', error)
    return null
  }
}

/**
 * Parse coordinates from KML content
 * Returns separate coordinates for "gidiş" and "dönüş" directions
 */
function parseKMLCoordinates(kml: string): {
  gidis: LatLng[] | null
  donus: LatLng[] | null
} {
  const result: { gidis: LatLng[] | null; donus: LatLng[] | null } = {
    gidis: null,
    donus: null,
  }

  // Find all Placemark elements
  const placemarkRegex = /<Placemark[^>]*>[\s\S]*?<\/Placemark>/gi
  const placemarks = kml.match(placemarkRegex) || []

  for (const placemark of placemarks) {
    // Get placemark name
    const nameMatch = placemark.match(/<name>([^<]*)<\/name>/i)
    const name = nameMatch?.[1]?.toLowerCase() || ''

    // Get coordinates
    const coordMatch = placemark.match(/<coordinates>\s*([\s\S]*?)\s*<\/coordinates>/i)
    if (!coordMatch) continue

    const coordString = coordMatch[1].trim()
    const coordinates = parseCoordinateString(coordString)

    if (coordinates.length < 2) continue

    // Determine direction based on name
    if (name.includes('gidiş') || name.includes('gidis')) {
      result.gidis = coordinates
    } else if (name.includes('dönüş') || name.includes('donus')) {
      result.donus = coordinates
    } else {
      // If no direction in name, use first found as gidis
      if (!result.gidis) {
        result.gidis = coordinates
      } else if (!result.donus) {
        result.donus = coordinates
      }
    }
  }

  return result
}

/**
 * Parse coordinate string from KML
 * Format: "lng,lat,alt lng,lat,alt ..."
 */
function parseCoordinateString(coordString: string): LatLng[] {
  const coords: LatLng[] = []

  // Split by whitespace
  const points = coordString.split(/\s+/).filter((p) => p.trim())

  for (const point of points) {
    const parts = point.split(',')
    if (parts.length >= 2) {
      const lng = Number.parseFloat(parts[0])
      const lat = Number.parseFloat(parts[1])

      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        coords.push(roundCoord([lat, lng]))
      }
    }
  }

  return coords
}

// ============================================================================
// ADAPTIVE WAYPOINT SELECTION
// ============================================================================

/**
 * Select waypoints adaptively based on distance and angle
 * Returns fewer points for straight sections, more for curves
 */
function selectAdaptiveWaypoints(coords: LatLng[]): LatLng[] {
  if (coords.length <= WAYPOINT_CONFIG.MAX_WAYPOINTS) {
    return coords
  }

  const waypoints: LatLng[] = []

  // Always include first point
  waypoints.push(coords[0])

  let distanceSinceLastWaypoint = 0

  for (let i = 1; i < coords.length - 1; i++) {
    const prev = coords[i - 1]
    const curr = coords[i]
    const next = coords[i + 1]

    // Calculate distance from last waypoint
    const segmentDistance = haversineDistance(prev[0], prev[1], curr[0], curr[1])
    distanceSinceLastWaypoint += segmentDistance

    // Calculate angle at this point
    const angle = calculateAngle(prev, curr, next)
    const angleChange = 180 - angle // Deviation from straight line

    // Decision criteria for adding waypoint
    const isSignificantTurn = angleChange > WAYPOINT_CONFIG.ANGLE_THRESHOLD_DEG
    const isTooFar = distanceSinceLastWaypoint > WAYPOINT_CONFIG.MAX_DISTANCE_M
    const isMinDistanceMet = distanceSinceLastWaypoint > WAYPOINT_CONFIG.MIN_DISTANCE_M

    // Add waypoint if significant turn OR too far from last waypoint
    if ((isSignificantTurn && isMinDistanceMet) || isTooFar) {
      waypoints.push(curr)
      distanceSinceLastWaypoint = 0
    }

    // Safety check: don't exceed max waypoints
    if (waypoints.length >= WAYPOINT_CONFIG.MAX_WAYPOINTS - 1) {
      break
    }
  }

  // Always include last point
  waypoints.push(coords[coords.length - 1])

  // Ensure minimum waypoints
  if (waypoints.length < WAYPOINT_CONFIG.MIN_WAYPOINTS) {
    return selectEvenlySpacedWaypoints(coords, WAYPOINT_CONFIG.MIN_WAYPOINTS)
  }

  return waypoints
}

/**
 * Fallback: select evenly spaced waypoints
 */
function selectEvenlySpacedWaypoints(coords: LatLng[], targetCount: number): LatLng[] {
  if (coords.length <= targetCount) return coords

  const waypoints: LatLng[] = []
  const step = (coords.length - 1) / (targetCount - 1)

  for (let i = 0; i < targetCount; i++) {
    const index = Math.round(i * step)
    waypoints.push(coords[Math.min(index, coords.length - 1)])
  }

  return waypoints
}

// ============================================================================
// DOUGLAS-PEUCKER SIMPLIFICATION (for final output)
// ============================================================================

function perpendicularDistance(point: LatLng, lineStart: LatLng, lineEnd: LatLng): number {
  const [y, x] = point
  const [y1, x1] = lineStart
  const [y2, x2] = lineEnd

  const dx = x2 - x1
  const dy = y2 - y1

  if (dx === 0 && dy === 0) {
    return Math.sqrt((x - x1) ** 2 + (y - y1) ** 2)
  }

  const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)))
  const projX = x1 + t * dx
  const projY = y1 + t * dy

  return Math.sqrt((x - projX) ** 2 + (y - projY) ** 2)
}

function simplifyLine(points: LatLng[], epsilon = 0.00003): LatLng[] {
  if (points.length <= 2) return points

  let maxDist = 0
  let maxIndex = 0

  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], points[0], points[points.length - 1])
    if (dist > maxDist) {
      maxDist = dist
      maxIndex = i
    }
  }

  if (maxDist > epsilon) {
    const left = simplifyLine(points.slice(0, maxIndex + 1), epsilon)
    const right = simplifyLine(points.slice(maxIndex), epsilon)
    return [...left.slice(0, -1), ...right]
  }

  return [points[0], points[points.length - 1]]
}

// ============================================================================
// ROUTE GEOMETRY SERVICE
// ============================================================================

export class RouteGeometryService {
  private cache: CacheService
  private osrmBaseUrl: string

  constructor(env: Env) {
    this.cache = new CacheService(env)
    this.osrmBaseUrl = 'https://router.project-osrm.org'
  }

  /**
   * Parse station coordinates
   */
  private parseStationCoords(stations: RouteStation[]): LatLng[] {
    // Sort by sequence first
    const sorted = [...stations].sort((a, b) => a.sequence - b.sequence)

    return sorted
      .map((s) => {
        const lat = Number.parseFloat(String(s.latitude).replace(',', '.'))
        const lng = Number.parseFloat(String(s.longitude).replace(',', '.'))
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          return roundCoord([lat, lng])
        }
        return null
      })
      .filter((c): c is LatLng => c !== null)
  }

  /**
   * Fetch route geometry from OSRM
   */
  private async fetchOSRMRoute(coords: LatLng[]): Promise<{
    coordinates: LatLng[]
    distance: number
    duration: number
  } | null> {
    if (coords.length < 2) return null

    // Chunk if needed (OSRM limit ~100 waypoints)
    const MAX_WAYPOINTS = 80

    if (coords.length <= MAX_WAYPOINTS) {
      return this.fetchOSRMRouteChunk(coords)
    }

    // Split into chunks with overlap
    const chunks: LatLng[][] = []
    for (let i = 0; i < coords.length; i += MAX_WAYPOINTS - 1) {
      const chunk = coords.slice(i, i + MAX_WAYPOINTS)
      if (chunk.length >= 2) {
        chunks.push(chunk)
      }
    }

    const allCoordinates: LatLng[] = []
    let totalDistance = 0
    let totalDuration = 0

    for (const chunk of chunks) {
      const result = await this.fetchOSRMRouteChunk(chunk)

      if (result) {
        if (allCoordinates.length > 0 && result.coordinates.length > 0) {
          allCoordinates.push(...result.coordinates.slice(1))
        } else {
          allCoordinates.push(...result.coordinates)
        }
        totalDistance += result.distance
        totalDuration += result.duration
      } else {
        // Fallback: straight lines for this chunk
        if (allCoordinates.length > 0) {
          allCoordinates.push(...chunk.slice(1))
        } else {
          allCoordinates.push(...chunk)
        }
      }

      // Rate limiting
      if (chunks.length > 1) {
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
    }

    return {
      coordinates: allCoordinates,
      distance: totalDistance,
      duration: totalDuration,
    }
  }

  /**
   * Fetch single chunk from OSRM
   */
  private async fetchOSRMRouteChunk(coords: LatLng[]): Promise<{
    coordinates: LatLng[]
    distance: number
    duration: number
  } | null> {
    if (coords.length < 2) return null

    const coordString = coords.map((c) => `${c[1]},${c[0]}`).join(';') // lng,lat for OSRM
    const url = `${this.osrmBaseUrl}/route/v1/driving/${coordString}?overview=full&geometries=geojson`

    try {
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`OSRM error: ${response.status}`)
      }

      const data = (await response.json()) as OSRMResponse

      if (data.code !== 'Ok' || !data.routes?.[0]?.geometry?.coordinates) {
        throw new Error('OSRM route not found')
      }

      const route = data.routes[0]
      const coordinates = route.geometry.coordinates.map(([lng, lat]) => roundCoord([lat, lng]))

      return {
        coordinates,
        distance: Math.round(route.distance),
        duration: Math.round(route.duration),
      }
    } catch (error) {
      console.error('OSRM fetch error:', error)
      return null
    }
  }

  /**
   * Calculate route geometry using hybrid KMZ + OSRM approach
   *
   * Fallback chain:
   * 1. KMZ waypoints + OSRM (best: accurate route + road details)
   * 2. KMZ only (good: accurate route, no road details)
   * 3. Station coords + OSRM (fair: may use wrong roads)
   * 4. Station coords only (poor: straight lines)
   */
  async calculateRouteGeometry(route: RouteWithStations): Promise<RouteGeometry | null> {
    const lineCode = route.lineCode
    const isReturnDirection = lineCode.endsWith('D') || lineCode.endsWith('d')

    console.info(`Calculating geometry for ${lineCode} (return: ${isReturnDirection})`)

    // Try KMZ first (most accurate source)
    const kmzData = await fetchKMZGeometry(lineCode)

    if (kmzData) {
      // Select appropriate direction
      const kmzCoords = isReturnDirection ? kmzData.donus : kmzData.gidis

      if (kmzCoords && kmzCoords.length >= 2) {
        console.info(`KMZ found for ${lineCode}: ${kmzCoords.length} coordinates`)

        // Select adaptive waypoints from KMZ
        const waypoints = selectAdaptiveWaypoints(kmzCoords)
        console.info(`Selected ${waypoints.length} adaptive waypoints`)

        // Use waypoints with OSRM for road details
        const osrmResult = await this.fetchOSRMRoute(waypoints)

        if (osrmResult && osrmResult.coordinates.length > 0) {
          console.info(`KMZ+OSRM success for ${lineCode}`)
          const simplified = simplifyLine(osrmResult.coordinates, 0.00002)

          return {
            lineCode,
            coordinates: simplified,
            distance: osrmResult.distance,
            duration: osrmResult.duration,
            generatedAt: Date.now(),
            source: 'kmz+osrm',
          }
        }

        // Fallback: use KMZ coordinates directly
        console.info(`OSRM failed, using KMZ directly for ${lineCode}`)
        const simplified = simplifyLine(kmzCoords, 0.00002)

        return {
          lineCode,
          coordinates: simplified,
          distance: Math.round(calculatePathDistance(kmzCoords)),
          duration: 0,
          generatedAt: Date.now(),
          source: 'kmz',
        }
      }
    }

    // Fallback: use station coordinates
    console.info(`No KMZ for ${lineCode}, using station coordinates`)
    const stationCoords = this.parseStationCoords(route.stations)

    if (stationCoords.length < 2) {
      console.info(`Not enough station coordinates for ${lineCode}`)
      return null
    }

    // Try OSRM with station coordinates
    const osrmResult = await this.fetchOSRMRoute(stationCoords)

    if (osrmResult && osrmResult.coordinates.length > 0) {
      console.info(`Station+OSRM success for ${lineCode}`)
      const simplified = simplifyLine(osrmResult.coordinates, 0.00002)

      return {
        lineCode,
        coordinates: simplified,
        distance: osrmResult.distance,
        duration: osrmResult.duration,
        generatedAt: Date.now(),
        source: 'osrm',
      }
    }

    // Final fallback: straight lines between stations
    console.info(`All methods failed, using straight lines for ${lineCode}`)
    return {
      lineCode,
      coordinates: stationCoords,
      distance: Math.round(calculatePathDistance(stationCoords)),
      duration: 0,
      generatedAt: Date.now(),
      source: 'straight',
    }
  }

  /**
   * Get route geometry from cache (FAST - no computation)
   */
  async getRouteGeometryFromCache(lineCode: string): Promise<RouteGeometry | null> {
    const cacheKey = CACHE_KEYS.ROUTE_GEOMETRY(lineCode)
    // Serve stale too: geometries rarely change, and recomputation is expensive.
    const cached = await this.cache.getWithStale<RouteGeometry>(cacheKey)
    if (cached) return cached.data

    const allCached = await this.cache.getWithStale<Record<string, SimpleGeometry>>(
      CACHE_KEYS.ALL_ROUTE_GEOMETRIES,
    )
    const simple = allCached?.data?.[lineCode]
    if (simple) {
      return {
        lineCode,
        coordinates: simple.c,
        distance: simple.d,
        duration: 0,
        generatedAt: Date.now(),
      }
    }

    return null
  }

  /**
   * Get route geometry from cache or calculate
   */
  async getRouteGeometry(
    route: RouteWithStations,
    forceRefresh = false,
  ): Promise<RouteGeometry | null> {
    const cacheKey = CACHE_KEYS.ROUTE_GEOMETRY(route.lineCode)

    if (!forceRefresh) {
      const cached = await this.getRouteGeometryFromCache(route.lineCode)
      if (cached) return cached
    }

    const geometry = await this.calculateRouteGeometry(route)
    if (!geometry) return null

    // Cache long-term (configurable)
    await this.cache.set(cacheKey, geometry, this.cache.getTTL('geometry'))

    return geometry
  }

  /**
   * Get all route geometries from cache only (FAST)
   */
  async getAllRouteGeometriesFromCache(): Promise<Map<string, RouteGeometry>> {
    const result = new Map<string, RouteGeometry>()

    // Serve stale too (see single-geometry rationale).
    const cachedAll = await this.cache.getWithStale<Record<string, SimpleGeometry>>(
      CACHE_KEYS.ALL_ROUTE_GEOMETRIES,
    )
    if (cachedAll?.data) {
      for (const [lineCode, simple] of Object.entries(cachedAll.data)) {
        result.set(lineCode, {
          lineCode,
          coordinates: simple.c,
          distance: simple.d,
          duration: 0,
          generatedAt: Date.now(),
        })
      }
    }

    return result
  }

  /**
   * Get all route geometries (batch) - SLOW, for background processing
   */
  async getAllRouteGeometries(
    routes: RouteWithStations[],
    forceRefresh = false,
    onProgress?: (done: number, total: number) => void,
  ): Promise<Map<string, RouteGeometry>> {
    const result = new Map<string, RouteGeometry>()
    const total = routes.length
    let done = 0

    if (!forceRefresh) {
      const cachedResult = await this.getAllRouteGeometriesFromCache()
      if (cachedResult.size > 0) {
        return cachedResult
      }
    }

    // Process in batches
    const BATCH_SIZE = 2 // Reduced for KMZ+OSRM (more requests per route)

    for (let i = 0; i < routes.length; i += BATCH_SIZE) {
      const batch = routes.slice(i, i + BATCH_SIZE)

      const batchResults = await Promise.all(
        batch.map(async (route) => {
          try {
            return await this.getRouteGeometry(route, forceRefresh)
          } catch (error) {
            console.error(`Error calculating geometry for ${route.lineCode}:`, error)
            return null
          }
        }),
      )

      for (const geometry of batchResults) {
        if (geometry) {
          result.set(geometry.lineCode, geometry)
        }
        done++
        onProgress?.(done, total)
      }

      // Rate limiting between batches
      if (i + BATCH_SIZE < routes.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }

    // Cache the full set
    const cacheData: Record<string, SimpleGeometry> = {}
    for (const [lineCode, geometry] of result) {
      cacheData[lineCode] = {
        c: geometry.coordinates,
        d: geometry.distance,
      }
    }
    await this.cache.set(CACHE_KEYS.ALL_ROUTE_GEOMETRIES, cacheData, this.cache.getTTL('geometry'))

    return result
  }
}
