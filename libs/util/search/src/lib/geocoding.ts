export interface POIResult {
  id: string
  name: string
  displayName: string
  lat: number
  lng: number
  type: string
  category: string
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] }
  properties: {
    osm_id?: number
    name?: string
    street?: string
    housenumber?: string
    city?: string
    district?: string
    state?: string
    postcode?: string
    country?: string
    osm_key?: string
    osm_value?: string
    type?: string
  }
}

interface PhotonResponse {
  features: PhotonFeature[]
}

const PHOTON_BASE = 'https://photon.komoot.io/api/'

// Denizli merkez koordinatlari -- sonuclari bu noktaya yakinliga gore siralar
const DENIZLI_LAT = 37.77
const DENIZLI_LNG = 29.08

const CATEGORY_LABELS: Record<string, string> = {
  amenity: 'Tesis',
  shop: 'Mağaza',
  tourism: 'Turizm',
  building: 'Bina',
  highway: 'Yol',
  place: 'Yer',
  leisure: 'Eğlence',
  office: 'Ofis',
  healthcare: 'Sağlık',
  education: 'Eğitim',
  railway: 'Demiryolu',
  natural: 'Doğa',
  historic: 'Tarihi',
  sport: 'Spor',
  craft: 'Zanaat',
}

function buildLabel(props: PhotonFeature['properties']): string {
  const parts: string[] = []
  if (props.street) {
    let road = props.street
    if (props.housenumber) road += ` ${props.housenumber}`
    parts.push(road)
  }
  if (props.district) parts.push(props.district)
  if (props.city && props.city !== props.name) parts.push(props.city)

  if (parts.length === 0 && props.state) parts.push(props.state)
  return parts.join(', ') || props.name || ''
}

export async function searchPOI(query: string, signal?: AbortSignal): Promise<POIResult[]> {
  const trimmed = query.trim()
  if (trimmed.length < 2) return []

  const params = new URLSearchParams({
    q: trimmed,
    lat: String(DENIZLI_LAT),
    lon: String(DENIZLI_LNG),
    limit: '15',
  })

  const response = await fetch(`${PHOTON_BASE}?${params}`, { signal })

  if (!response.ok) {
    throw new Error('Konum arama servisi yanıt vermedi')
  }

  const data: PhotonResponse = await response.json()

  return data.features.map((feature) => {
    const props = feature.properties
    const [lng, lat] = feature.geometry.coordinates
    return {
      id: String(props.osm_id ?? `${lat},${lng}`),
      name: props.name || props.street || buildLabel(props),
      displayName: buildLabel(props),
      lat,
      lng,
      type: props.osm_value || props.type || '',
      category: CATEGORY_LABELS[props.osm_key || ''] || props.osm_key || '',
    }
  })
}
