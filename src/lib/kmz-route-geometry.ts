import { isNative } from '@/lib/capacitor'
import JSZip from 'jszip'

export type LatLng = [number, number]

export interface RouteDirections {
  base: LatLng[] | null
  return: LatLng[] | null
}

export interface DirectKmzRouteGeometry {
  lineCode: string
  coordinates: LatLng[]
  source: 'direct-kmz'
}

const KMZ_UPSTREAM_BASE_URL = 'https://ulasim.denizli.bel.tr/guzergah'
const KMZ_PROXY_BASE_PATH = '/denizli-api/guzergah'

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

export async function fetchDirectKmzRouteGeometry(
  lineCode: string,
  fetchImpl: typeof fetch = fetch,
): Promise<DirectKmzRouteGeometry> {
  const normalizedLineCode = lineCode.toUpperCase()
  const kmzLineCode = normalizedLineCode.replace(/D$/, '').replace(/-$/, '')
  const response = await fetchImpl(getKmzRouteUrl(kmzLineCode))

  if (!response.ok) {
    throw new Error(`KMZ fetch failed with status ${response.status}`)
  }

  const zip = await JSZip.loadAsync(await response.arrayBuffer())
  const kmlFile = Object.values(zip.files).find(
    (file) => !file.dir && file.name.toLowerCase().endsWith('.kml'),
  )
  if (!kmlFile) throw new Error('KMZ does not contain a KML file')

  const coordinates = selectGeometryForLineCode(
    normalizedLineCode,
    parseKmlRouteDirections(await kmlFile.async('text')),
  )

  if (!coordinates) throw new Error(`KMZ geometry not found for ${normalizedLineCode}`)

  return {
    lineCode: normalizedLineCode,
    coordinates,
    source: 'direct-kmz',
  }
}

function getKmzRouteUrl(lineCode: string): string {
  const encodedLineCode = encodeURIComponent(lineCode)
  if (isNative) return `${KMZ_UPSTREAM_BASE_URL}/${encodedLineCode}.kmz`
  return `${KMZ_PROXY_BASE_PATH}/${encodedLineCode}.kmz`
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
