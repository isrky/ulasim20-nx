import type { Env } from '../types'
import { CACHE_KEYS, CacheService } from './cache'

export type LatLng = [number, number]

export interface KmzRouteGeometry {
  lineCode: string
  coordinates: LatLng[]
  distance: number
  generatedAt: number
  source: 'kmz-direct'
}

export interface RouteDirections {
  base: LatLng[] | null
  return: LatLng[] | null
}

const KMZ_BASE_URL = 'https://ulasim.denizli.bel.tr/guzergah'
const GEOMETRY_TTL_SECONDS = 24 * 60 * 60
const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50

export async function extractKmlFromKmz(kmz: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(kmz)
  const view = new DataView(kmz)
  let offset = 0

  while (offset + 30 <= bytes.length) {
    if (view.getUint32(offset, true) !== LOCAL_FILE_HEADER_SIGNATURE) break

    const flags = view.getUint16(offset + 6, true)
    const compressionMethod = view.getUint16(offset + 8, true)
    const compressedSize = view.getUint32(offset + 18, true)
    const fileNameLength = view.getUint16(offset + 26, true)
    const extraLength = view.getUint16(offset + 28, true)
    const nameStart = offset + 30
    const dataStart = nameStart + fileNameLength + extraLength
    const fileName = new TextDecoder().decode(bytes.slice(nameStart, nameStart + fileNameLength))

    if ((flags & 0x08) !== 0) {
      throw new Error('Unsupported KMZ entry with data descriptor')
    }

    const dataEnd = dataStart + compressedSize
    if (dataEnd > bytes.length) throw new Error('Invalid KMZ entry size')

    if (fileName.toLowerCase().endsWith('.kml')) {
      const compressed = bytes.slice(dataStart, dataEnd)
      if (compressionMethod === 0) return new TextDecoder().decode(compressed)
      if (compressionMethod === 8) {
        const stream = new Blob([compressed])
          .stream()
          .pipeThrough(new DecompressionStream('deflate-raw'))
        return await new Response(stream).text()
      }
      throw new Error(`Unsupported KMZ compression method: ${compressionMethod}`)
    }

    offset = dataEnd
  }

  throw new Error('KMZ does not contain a KML file')
}

export function parseKmlRouteDirections(kml: string): RouteDirections {
  const placemarks = Array.from(kml.matchAll(/<Placemark\b[\s\S]*?<\/Placemark>/gi)).map(
    (match) => match[0],
  )
  const candidates = placemarks.length > 0 ? placemarks : [kml]
  const directions: RouteDirections = { base: null, return: null }

  for (const candidate of candidates) {
    const name = decodeXml(firstMatch(candidate, /<name\b[^>]*>([\s\S]*?)<\/name>/i) ?? '')
    const coordinatesText = firstMatch(candidate, /<coordinates\b[^>]*>([\s\S]*?)<\/coordinates>/i)
    if (!coordinatesText) continue

    const coordinates = parseCoordinates(coordinatesText)
    if (!isValidGeometry(coordinates)) continue

    if (isReturnDirectionName(name)) {
      directions.return ??= coordinates
    } else {
      directions.base ??= coordinates
    }
  }

  return directions
}

export function selectGeometryForLineCode(
  lineCode: string,
  directions: RouteDirections,
): LatLng[] | null {
  const selected = lineCode.toUpperCase().endsWith('D') ? directions.return : directions.base
  return selected && isValidGeometry(selected) ? selected : null
}

export class KmzRouteGeometryService {
  private readonly cache: CacheService

  constructor(
    private readonly env: Env,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    this.cache = new CacheService(env)
  }

  async getCached(lineCode: string): Promise<KmzRouteGeometry | null> {
    const cached = await this.cache.get<Partial<KmzRouteGeometry> & { source?: string }>(
      CACHE_KEYS.ROUTE_GEOMETRY(lineCode.toUpperCase()),
    )

    if (!cached || cached.source !== 'kmz-direct') return null
    return cached as KmzRouteGeometry
  }

  async generateAndCache(lineCode: string): Promise<KmzRouteGeometry> {
    const normalizedLineCode = lineCode.toUpperCase()
    const kmzLineCode = normalizedLineCode.replace(/D$/, '').replace(/-$/, '')
    const fetchImpl = this.fetchImpl
    const response = await fetchImpl(`${KMZ_BASE_URL}/${encodeURIComponent(kmzLineCode)}.kmz`)

    if (!response.ok) {
      throw new Error(`KMZ fetch failed with status ${response.status}`)
    }

    const kml = await extractKmlFromKmz(await response.arrayBuffer())
    const coordinates = selectGeometryForLineCode(normalizedLineCode, parseKmlRouteDirections(kml))

    if (!coordinates) {
      throw new Error(`KMZ geometry not found for ${normalizedLineCode}`)
    }

    const geometry: KmzRouteGeometry = {
      lineCode: normalizedLineCode,
      coordinates,
      distance: calculateDistance(coordinates),
      generatedAt: Date.now(),
      source: 'kmz-direct',
    }

    await this.cache.set(
      CACHE_KEYS.ROUTE_GEOMETRY(normalizedLineCode),
      geometry,
      GEOMETRY_TTL_SECONDS,
    )
    return geometry
  }
}

function firstMatch(value: string, pattern: RegExp): string | null {
  return pattern.exec(value)?.[1] ?? null
}

function parseCoordinates(coordinatesText: string): LatLng[] {
  return coordinatesText
    .trim()
    .split(/\s+/)
    .map((tuple) => {
      const [lng, lat] = tuple.split(',').map(Number)
      return [lat, lng] as LatLng
    })
    .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng))
}

function isValidGeometry(coordinates: LatLng[]): boolean {
  return coordinates.length >= 2
}

function isReturnDirectionName(name: string): boolean {
  const normalized = name.toLocaleLowerCase('tr-TR')
  return (
    normalized.includes('dönüş') || normalized.includes('donus') || normalized.includes('return')
  )
}

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function calculateDistance(coordinates: LatLng[]): number {
  let distance = 0
  for (let index = 1; index < coordinates.length; index += 1) {
    distance += haversineDistance(coordinates[index - 1], coordinates[index])
  }
  return Math.round(distance)
}

function haversineDistance([lat1, lng1]: LatLng, [lat2, lng2]: LatLng): number {
  const earthRadiusMeters = 6371000
  const dLat = toRadians(lat2 - lat1)
  const dLng = toRadians(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180
}
