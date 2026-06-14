import JSZip from 'jszip'
import { describe, expect, it, vi } from 'vitest'
import {
  fetchDirectKmzRouteGeometry,
  parseKmlRouteDirections,
  selectGeometryForLineCode,
} from './kmz-route-geometry'

vi.mock('@/lib/capacitor', () => ({ isNative: false }))

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

async function kmzFixture() {
  const zip = new JSZip()
  zip.file('doc.kml', kmlFixture())
  return await zip.generateAsync({ type: 'arraybuffer' })
}

describe('frontend KMZ route geometry helper', () => {
  it('parses base and return directions from KML', () => {
    const directions = parseKmlRouteDirections(kmlFixture())

    expect(directions.base).toEqual(baseCoordinates)
    expect(directions.return).toEqual(returnCoordinates)
  })

  it('selects geometry by line code convention', () => {
    const directions = parseKmlRouteDirections(kmlFixture())

    expect(selectGeometryForLineCode('320', directions)).toEqual(baseCoordinates)
    expect(selectGeometryForLineCode('320D', directions)).toEqual(returnCoordinates)
  })

  it('rejects invalid selected direction', () => {
    const directions = parseKmlRouteDirections(`
      <kml><Placemark><name>320 Gidiş</name><coordinates>
        29.080001,37.770001,0 29.080101,37.770101,0
      </coordinates></Placemark></kml>
    `)

    expect(selectGeometryForLineCode('320D', directions)).toBeNull()
  })

  it('downloads KMZ, extracts KML, and returns selected direct geometry', async () => {
    const fetchImpl = vi.fn(async () => new Response(await kmzFixture()))

    await expect(fetchDirectKmzRouteGeometry('320D', fetchImpl)).resolves.toMatchObject({
      lineCode: '320D',
      coordinates: returnCoordinates,
      source: 'direct-kmz',
    })
    expect(fetchImpl).toHaveBeenCalledWith('/denizli-api/guzergah/320.kmz')
  })
})
