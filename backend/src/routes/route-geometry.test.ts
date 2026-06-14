import { SELF, env, fetchMock } from 'cloudflare:test'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { CACHE_KEYS, CacheService } from '../services/cache'
import {
  KmzRouteGeometryService,
  extractKmlFromKmz,
  parseKmlRouteDirections,
  selectGeometryForLineCode,
} from '../services/kmz-route-geometry'
import type { Env } from '../types'

const testEnv = env as unknown as Env

const baseCoordinates = [
  [37.770001, 29.080001],
  [37.770101, 29.080101],
  [37.770201, 29.080201],
] as const

const returnCoordinates = [
  [37.771001, 29.081001],
  [37.771101, 29.081101],
  [37.771201, 29.081201],
] as const

function kmlFixture() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark>
      <name>320 Gidiş</name>
      <LineString>
        <coordinates>
          29.080001,37.770001,0 29.080101,37.770101,0 29.080201,37.770201,0
        </coordinates>
      </LineString>
    </Placemark>
    <Placemark>
      <name>320 Dönüş</name>
      <LineString>
        <coordinates>
          29.081001,37.771001,0 29.081101,37.771101,0 29.081201,37.771201,0
        </coordinates>
      </LineString>
    </Placemark>
  </Document>
</kml>`
}

function createStoredKmz(fileName: string, content: string): ArrayBuffer {
  const encoder = new TextEncoder()
  const nameBytes = encoder.encode(fileName)
  const dataBytes = encoder.encode(content)
  const totalLength = 30 + nameBytes.length + dataBytes.length
  const bytes = new Uint8Array(totalLength)
  const view = new DataView(bytes.buffer)

  bytes.set([0x50, 0x4b, 0x03, 0x04], 0)
  view.setUint16(4, 20, true)
  view.setUint16(6, 0, true)
  view.setUint16(8, 0, true)
  view.setUint32(14, 0, true)
  view.setUint32(18, dataBytes.length, true)
  view.setUint32(22, dataBytes.length, true)
  view.setUint16(26, nameBytes.length, true)
  view.setUint16(28, 0, true)
  bytes.set(nameBytes, 30)
  bytes.set(dataBytes, 30 + nameBytes.length)

  return bytes.buffer.slice(0)
}

async function clearGeometryCache() {
  await testEnv.CACHE.delete(CACHE_KEYS.ROUTE_GEOMETRY('320'))
  await testEnv.CACHE.delete(CACHE_KEYS.ROUTE_GEOMETRY('320D'))
  const cache = new CacheService(testEnv)
  await cache.delete(CACHE_KEYS.ROUTE_GEOMETRY('320'))
  await cache.delete(CACHE_KEYS.ROUTE_GEOMETRY('320D'))
}

beforeAll(() => {
  fetchMock.activate()
  fetchMock.disableNetConnect()
})

beforeEach(async () => {
  fetchMock.assertNoPendingInterceptors()
  await clearGeometryCache()
})

afterEach(() => {
  fetchMock.assertNoPendingInterceptors()
})

describe('KMZ route geometry parsing', () => {
  it('extracts KML from a KMZ archive', async () => {
    const kmz = createStoredKmz('doc.kml', kmlFixture())

    await expect(extractKmlFromKmz(kmz)).resolves.toContain('<Placemark>')
  })

  it('parses KML coordinates into base and return directions', () => {
    const directions = parseKmlRouteDirections(kmlFixture())

    expect(directions.base).toEqual(baseCoordinates)
    expect(directions.return).toEqual(returnCoordinates)
  })

  it('selects base direction for a base line code', () => {
    const directions = parseKmlRouteDirections(kmlFixture())

    expect(selectGeometryForLineCode('320', directions)).toEqual(baseCoordinates)
  })

  it('selects return direction for a D line code', () => {
    const directions = parseKmlRouteDirections(kmlFixture())

    expect(selectGeometryForLineCode('320D', directions)).toEqual(returnCoordinates)
  })

  it('rejects missing selected direction', () => {
    const directions = parseKmlRouteDirections(`
      <kml><Placemark><name>320 Gidiş</name><coordinates>
        29.080001,37.770001,0 29.080101,37.770101,0
      </coordinates></Placemark></kml>
    `)

    expect(selectGeometryForLineCode('320D', directions)).toBeNull()
  })

  it('generates and caches KMZ-direct geometry for 24 hours', async () => {
    const service = new KmzRouteGeometryService(testEnv, async () => {
      return new Response(createStoredKmz('doc.kml', kmlFixture()), {
        headers: { 'content-type': 'application/vnd.google-earth.kmz' },
      })
    })
    const geometry = await service.generateAndCache('320D')

    expect(geometry).toMatchObject({
      lineCode: '320D',
      source: 'kmz-direct',
      coordinates: returnCoordinates,
    })

    const cache = new CacheService(testEnv)
    const cached = await cache.get<unknown>(CACHE_KEYS.ROUTE_GEOMETRY('320D'))
    expect(cached).toMatchObject({ lineCode: '320D', source: 'kmz-direct' })
  })
})

describe('route geometry endpoints', () => {
  it('returns cached route geometry from GET /api/routes/:lineCode/geometry', async () => {
    const cache = new CacheService(testEnv)
    await cache.set(
      CACHE_KEYS.ROUTE_GEOMETRY('320'),
      {
        lineCode: '320',
        coordinates: baseCoordinates,
        distance: 24,
        generatedAt: Date.now(),
        source: 'kmz-direct',
      },
      86400,
    )

    const res = await SELF.fetch('http://localhost/api/routes/320/geometry')
    const body = (await res.json()) as {
      success: boolean
      cached: boolean
      data: { lineCode: string; coordinates: number[][]; source: string }
    }

    expect(res.status).toBe(200)
    expect(body).toMatchObject({
      success: true,
      cached: true,
      data: { lineCode: '320', source: 'kmz-direct' },
    })
    expect(body.data.coordinates).toEqual(baseCoordinates)
  })

  it('returns an explicit non-error miss when geometry is not cached', async () => {
    const res = await SELF.fetch('http://localhost/api/routes/320/geometry')
    const body = (await res.json()) as {
      success: boolean
      cached: boolean
      status: string
      data: null
    }

    expect(res.status).toBe(200)
    expect(body).toEqual({
      success: true,
      cached: false,
      status: 'miss',
      data: null,
    })
  })

  it('treats legacy OSRM geometry cache entries as a miss', async () => {
    const cache = new CacheService(testEnv)
    await cache.set(
      CACHE_KEYS.ROUTE_GEOMETRY('320'),
      {
        lineCode: '320',
        coordinates: baseCoordinates,
        distance: 24,
        duration: 120,
        generatedAt: Date.now(),
        source: 'kmz+osrm',
      },
      86400,
    )

    const res = await SELF.fetch('http://localhost/api/routes/320/geometry')
    const body = (await res.json()) as {
      success: boolean
      cached: boolean
      status: string
      data: null
    }

    expect(res.status).toBe(200)
    expect(body).toEqual({
      success: true,
      cached: false,
      status: 'miss',
      data: null,
    })
  })

  it('accepts fire-and-forget geometry generation requests', async () => {
    fetchMock
      .get('https://ulasim.denizli.bel.tr')
      .intercept({ path: '/guzergah/320.kmz' })
      .reply(200, new Uint8Array(createStoredKmz('doc.kml', kmlFixture())), {
        headers: { 'content-type': 'application/vnd.google-earth.kmz' },
      })

    const res = await SELF.fetch('http://localhost/api/routes/320/geometry/generate', {
      method: 'POST',
    })
    const body = (await res.json()) as { success: boolean; accepted: boolean }

    expect(res.status).toBe(202)
    expect(body).toEqual({ success: true, accepted: true })
  })
})
