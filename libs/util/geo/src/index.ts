import type { Coordinates } from '@ulasim20/types-transport'

const EARTH_RADIUS_M = 6_371_000

export function haversineDistance(a: Coordinates, b: Coordinates): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h))
}

export function bbox(points: Coordinates[]): {
  minLat: number
  minLon: number
  maxLat: number
  maxLon: number
} {
  if (points.length === 0) {
    return { minLat: 0, minLon: 0, maxLat: 0, maxLon: 0 }
  }
  let minLat = points[0].lat
  let minLon = points[0].lon
  let maxLat = points[0].lat
  let maxLon = points[0].lon
  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat
    if (p.lon < minLon) minLon = p.lon
    if (p.lat > maxLat) maxLat = p.lat
    if (p.lon > maxLon) maxLon = p.lon
  }
  return { minLat, minLon, maxLat, maxLon }
}
