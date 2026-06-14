'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { getAllStations, getBusDataForStation, apiGet, getRouteGeometryResult, triggerRouteGeometryGeneration, type Station, type RouteStation } from '@/api/denizli'
import { fetchDirectKmzRouteGeometry } from '@/lib/kmz-route-geometry'
import { searchStations, buildStationIndex, type IndexEntry } from '@/utils/search'
import { cleanLineCode } from '@/utils/text'
import { Button } from '@ulasim20/ui-primitives'
import { Input } from '@ulasim20/ui-primitives'
import { trackLineLookup, trackRouteMapOpen, trackStopLookup } from '@/lib/analytics'
import { Locate, X, Clock, Bus, Search, MapPin, Navigation, List, AlertCircle } from 'lucide-react'

const DENIZLI_CENTER = { lat: 37.7765, lng: 29.0864 }
const LINE_COLOR = '#22c55e'

interface ProcessedStation {
  stationId: number
  stationName: string
  lat: number
  lng: number
}

interface LiveVehicle {
  plate: string
  latitude: string
  longitude: string
  speed: string
  routeCode: string
  stopId: number
}

interface GetLiveDataResponse { value: LiveVehicle[] }
interface GetRouteStationsResponse { value: { stations: RouteStation[]; lineName?: string } }

interface SelectedLineInfo {
  lineCode: string
  lineName: string
  stations: RouteStation[]
  vehicles: LiveVehicle[]
  geometry: [number, number][] | null
  vehiclesUpdatedAt: number
  geometryError?: string | null
}

interface StopArrival {
  lineCode: string
  lineName: string
  minutes: number
  hatno: string
}

function parseCoord(coord: string): number | null {
  const num = Number(coord.replace(',', '.'))
  return Number.isFinite(num) ? num : null
}

function processStations(stations: Station[]): ProcessedStation[] {
  const result: ProcessedStation[] = []
  for (const s of stations) {
    const lat = parseCoord(s.latitude)
    const lng = parseCoord(s.longitude)
    if (lat != null && lng != null) {
      result.push({ stationId: s.stationId, stationName: s.stationName, lat, lng })
    }
  }
  return result
}

const busIcon = (color: string) => new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
      <rect x="4" y="6" width="24" height="20" rx="4" fill="${color}"/>
      <rect x="8" y="10" width="16" height="8" rx="2" fill="white"/>
      <circle cx="10" cy="22" r="2" fill="white"/>
      <circle cx="22" cy="22" r="2" fill="white"/>
    </svg>
  `),
  iconSize: [32, 32],
  iconAnchor: [16, 16],
})

const userIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
      <circle cx="12" cy="12" r="10" fill="#3b82f6" stroke="white" stroke-width="2"/>
      <circle cx="12" cy="12" r="4" fill="white"/>
    </svg>
  `),
  iconSize: [24, 24],
  iconAnchor: [12, 12],
})

const STOP_MARKER_COLOR = '#6a9a5b'
const stopIcon = new L.DivIcon({
  className: '',
  html: `<div style="width:18px;height:18px;background:${STOP_MARKER_COLOR};border:2px solid white;border-radius:4px;box-shadow:0 1px 4px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:white;font-family:system-ui,sans-serif;line-height:1">D</div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
})

const REFILL_MARKER_COLOR = '#3b82f6'
const refillIcon = new L.DivIcon({
  className: '',
  html: `<div style="width:14px;height:14px;background:${REFILL_MARKER_COLOR};border:2px solid white;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,.3)"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
})

const MIN_STOP_ZOOM = 15

function SearchBar({ stations, stationIndex, onSelectStop, onFlyTo }: { stations: Station[]; stationIndex: IndexEntry[]; onSelectStop: (s: ProcessedStation) => void; onFlyTo: (lat: number, lng: number) => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ProcessedStation[]>([])
  const [showResults, setShowResults] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (query.length < 2) { setResults([]); return }
    const matched = searchStations(stations, query, stationIndex).filter(r => r.score > 0).slice(0, 8).map(r => r.item)
    const processed: ProcessedStation[] = []
    for (const s of matched) {
      const lat = parseCoord(s.latitude)
      const lng = parseCoord(s.longitude)
      if (lat != null && lng != null) processed.push({ stationId: s.stationId, stationName: s.stationName, lat, lng })
    }
    setResults(processed)
  }, [query, stations])

  const handleSelect = (stop: ProcessedStation) => {
    trackStopLookup({ stationId: stop.stationId, source: 'map_search' })
    onSelectStop(stop)
    onFlyTo(stop.lat, stop.lng)
    setQuery('')
    setResults([])
    setShowResults(false)
  }

  return (
    <div className="absolute top-3 left-3 right-3 md:left-4 md:right-auto md:w-80 z-[1000]">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setShowResults(true) }}
          onFocus={() => setShowResults(true)}
          placeholder="Durak ara..."
          className="pl-10 pr-4 h-11 bg-white shadow-lg border-0 rounded-xl"
        />
        {query && (
          <button onClick={() => { setQuery(''); setResults([]) }} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        )}
      </div>
      {showResults && results.length > 0 && (
        <>
          <div className="fixed inset-0 z-[-1]" onClick={() => setShowResults(false)} />
          <div className="mt-2 bg-white rounded-xl shadow-lg overflow-hidden max-h-72 overflow-y-auto">
            {results.map((stop) => (
              <button
                key={stop.stationId}
                onClick={() => handleSelect(stop)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left border-b border-gray-50 last:border-0"
              >
                <div className="w-8 h-8 rounded-lg bg-transit-primary/10 flex items-center justify-center shrink-0">
                  <MapPin className="w-4 h-4 text-transit-primary" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 text-sm truncate">{stop.stationName}</p>
                  <p className="text-xs text-gray-500">#{stop.stationId}</p>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function StopMarkers({ allStops, onSelectStop }: { allStops: ProcessedStation[]; onSelectStop: (s: ProcessedStation) => void }) {
  const map = useMap()
  const [zoom, setZoom] = useState(map.getZoom())
  const [bounds, setBounds] = useState(map.getBounds())

  useMapEvents({
    zoomend: () => {
      setZoom(map.getZoom())
      setBounds(map.getBounds())
    },
    moveend: () => {
      setBounds(map.getBounds())
    },
  })

  const visibleStops = useMemo(
    () => zoom >= MIN_STOP_ZOOM ? allStops.filter((s) => bounds.contains([s.lat, s.lng])) : [],
    [allStops, bounds, zoom],
  )

  if (visibleStops.length === 0) return null

  return (
    <>
      {visibleStops.map((stop) => (
        <Marker
          key={stop.stationId}
          position={[stop.lat, stop.lng]}
          icon={stopIcon}
          eventHandlers={{ click: () => onSelectStop(stop) }}
        />
      ))}
    </>
  )
}

function LocationButton() {
  const map = useMap()
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null)

  const handleLocate = useCallback(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => { const loc: [number, number] = [pos.coords.latitude, pos.coords.longitude]; setUserLocation(loc); map.flyTo(loc, 16) },
        () => { map.flyTo([DENIZLI_CENTER.lat, DENIZLI_CENTER.lng], 14) }
      )
    }
  }, [map])

  return (
    <>
      <Button size="icon" variant="secondary" className="absolute bottom-24 right-4 z-[1000] shadow-lg bg-white hover:bg-gray-50" onClick={handleLocate}>
        <Locate className="w-5 h-5 text-gray-700" />
      </Button>
      {userLocation && <Marker position={userLocation} icon={userIcon}><Popup>Konumunuz</Popup></Marker>}
    </>
  )
}

function StopPanel({ stop, onClose, onSelectLine }: { stop: ProcessedStation; onClose: () => void; onSelectLine: (lineCode: string) => void }) {
  const [arrivals, setArrivals] = useState<StopArrival[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getBusDataForStation(stop.stationId).then(res => {
      if (cancelled || !res?.value?.busList) return
      const list: StopArrival[] = []
      for (const bus of res.value.busList) {
        if (bus.plaka === 'EnYakinKalkis') continue
        let mins: number | null = null
        if (bus.sure) {
          const parts = bus.sure.split(':').map(Number)
          if (parts.every(n => Number.isFinite(n))) { const [h = 0, m = 0, s = 0] = parts; mins = Math.floor((h * 3600 + m * 60 + s) / 60) }
        }
        if (mins == null && bus.kalkisaKadarkiDakika) { const v = Number(bus.kalkisaKadarkiDakika.replace(',', '.')); if (Number.isFinite(v)) mins = Math.round(v) }
        if (mins == null) continue
        list.push({ lineCode: cleanLineCode(bus.hatno), lineName: bus.hatadi, minutes: mins, hatno: bus.hatno })
      }
      list.sort((a, b) => a.minutes - b.minutes)
      if (!cancelled) setArrivals(list)
    }).catch(() => {}).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [stop.stationId])

  return (
    <div className="absolute bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-white rounded-xl shadow-xl z-[1000] overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-gray-100">
        <div>
          <h3 className="font-semibold text-gray-900">{stop.stationName}</h3>
          <p className="text-sm text-gray-500">#{stop.stationId}</p>
        </div>
        <Button size="icon" variant="ghost" onClick={onClose}><X className="w-5 h-5" /></Button>
      </div>
      <div className="max-h-64 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-sm text-gray-500">Yükleniyor...</div>
        ) : arrivals.length === 0 ? (
          <div className="p-4 text-center text-sm text-gray-500">Yaklaşan araç yok</div>
        ) : (
          arrivals.map((arrival, idx) => (
            <button
              key={idx}
              onClick={() => onSelectLine(arrival.hatno)}
              className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
            >
              <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm bg-transit-primary">
                {arrival.lineCode}
              </div>
              <div className="flex-1 text-left">
                <p className="font-medium text-gray-900 text-sm">{arrival.lineName?.split('-').pop()?.trim() || ''}</p>
              </div>
              <div className="flex items-center gap-1 text-transit-primary font-semibold">
                <Clock className="w-4 h-4" />
                <span>{arrival.minutes} dk</span>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

interface RefillPoint {
  lat: number
  lng: number
  name?: string
  id?: number
}

function RefillPanel({ point, onClose }: { point: RefillPoint; onClose: () => void }) {
  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lng}`

  return (
    <div className="absolute bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-white rounded-xl shadow-xl z-[1000] overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-gray-100">
        <div>
          <h3 className="font-semibold text-gray-900">{point.name ?? 'Dolum noktası'}</h3>
          <p className="text-sm text-gray-500">Denizli Kart dolum / satış</p>
        </div>
        <Button size="icon" variant="ghost" onClick={onClose}><X className="w-5 h-5" /></Button>
      </div>
      <div className="p-4 space-y-2">
        {point.id != null && (
          <Link
            to={`/dolum-noktalari#dealer-${point.id}`}
            onClick={onClose}
            className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-lg border border-gray-200 text-gray-700 font-medium text-sm hover:bg-gray-50 transition-colors"
          >
            <List className="w-4 h-4" />
            Detayları görüntüle
          </Link>
        )}
        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-lg bg-transit-primary text-white font-medium text-sm hover:bg-transit-primary/90 transition-colors"
        >
          <Navigation className="w-4 h-4" />
          Nasıl giderim
        </a>
      </div>
    </div>
  )
}

function LinePanel({ lineInfo, onClose }: { lineInfo: SelectedLineInfo; onClose: () => void }) {
  return (
    <div className="absolute top-4 left-4 md:left-auto md:right-4 w-72 md:w-80 bg-white rounded-xl shadow-xl z-[1000] overflow-hidden">
      <div className="flex items-center gap-3 p-4 border-b border-gray-100" style={{ backgroundColor: LINE_COLOR + '15' }}>
        <div className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold" style={{ backgroundColor: LINE_COLOR }}>
          {cleanLineCode(lineInfo.lineCode)}
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900">{lineInfo.lineName?.replace(/-?\s*D\s*\/\s*/gi, '-').trim() || lineInfo.lineCode}</h3>
          <p className="text-sm text-gray-500">{lineInfo.stations.length} durak</p>
        </div>
        <Button size="icon" variant="ghost" onClick={onClose}><X className="w-5 h-5" /></Button>
      </div>
      <div className="p-3 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bus className="w-4 h-4 text-transit-primary" />
          <span className="text-sm text-gray-600">{lineInfo.vehicles.length} otobüs yolda</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
          <span className="text-xs text-gray-400">Canlı</span>
        </div>
      </div>
      {lineInfo.geometryError && (
        <div className="mx-3 mt-3 rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-700">
          <div className="flex items-center gap-2 font-medium">
            <AlertCircle className="h-4 w-4" />
            Güzergah çizilemedi
          </div>
          <p className="mt-1 text-xs">
            Bu hattın seçili yönü için güzergah verisi alınamadı. Lütfen daha sonra tekrar deneyin.
          </p>
        </div>
      )}
      <div className="max-h-64 overflow-y-auto p-2">
        {lineInfo.stations.map((stop, idx) => (
          <div key={`${stop.stationId}-${stop.sequence}`} className="flex items-center gap-3 p-2">
            <div className="flex flex-col items-center">
              <div
                className="w-3 h-3 rounded-full border-2"
                style={{ borderColor: LINE_COLOR, backgroundColor: idx === 0 || idx === lineInfo.stations.length - 1 ? LINE_COLOR : 'white' }}
              />
              {idx < lineInfo.stations.length - 1 && <div className="w-0.5 h-6 -my-1" style={{ backgroundColor: LINE_COLOR + '40' }} />}
            </div>
            <span className="text-sm text-gray-700">{stop.stationName}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function FlyToHandler({ target }: { target: { lat: number; lng: number } | null }) {
  const map = useMap()
  useEffect(() => { if (target) map.flyTo([target.lat, target.lng], 17) }, [target, map])
  return null
}

export default function TransitMap() {
  const [searchParams] = useSearchParams()
  const [mounted, setMounted] = useState(false)
  const [rawStations, setRawStations] = useState<Station[]>([])
  const [processedStations, setProcessedStations] = useState<ProcessedStation[]>([])
  const [selectedStop, setSelectedStop] = useState<ProcessedStation | null>(null)
  const [selectedLine, setSelectedLine] = useState<SelectedLineInfo | null>(null)
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number } | null>(null)
  const [refillPoint, setRefillPoint] = useState<RefillPoint | null>(null)
  const [refillPanelOpen, setRefillPanelOpen] = useState(false)

  const stationIdx = useMemo(() => buildStationIndex(rawStations), [rawStations])

  useEffect(() => { setMounted(true) }, [])

  // Fly to coordinates and refill marker from URL (e.g. from Dolum Noktaları "Haritada Gör")
  useEffect(() => {
    const latParam = searchParams.get('lat')
    const lngParam = searchParams.get('lng')
    const type = searchParams.get('type')
    const nameParam = searchParams.get('name')
    if (latParam != null && lngParam != null) {
      const lat = Number(latParam.replace(',', '.'))
      const lng = Number(lngParam.replace(',', '.'))
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        setFlyTarget({ lat, lng })
        if (type === 'refill') {
          const idParam = searchParams.get('id')
          const id = idParam != null ? Number(idParam) : undefined
          setRefillPoint({
            lat,
            lng,
            name: nameParam ? decodeURIComponent(nameParam) : undefined,
            id: Number.isFinite(id) ? id : undefined,
          })
        } else {
          setRefillPoint(null)
        }
      }
    } else {
      setRefillPoint(null)
    }
  }, [searchParams])

  useEffect(() => {
    getAllStations().then(list => {
      const arr = Array.isArray(list) ? list : []
      setRawStations(arr)
      setProcessedStations(processStations(arr))
    }).catch(() => {})
  }, [])

  const handleSelectLine = useCallback(async (lineCode: string, source = 'map') => {
    try {
      trackLineLookup({ lineCode, source })
      setSelectedLine(null)
      const [stationsRes, liveRes, geometryResult] = await Promise.all([
        apiGet<GetRouteStationsResponse>(`/UlasimBackend/api/Calc/GetRouteStations?routeCode=${encodeURIComponent(lineCode)}`),
        apiGet<GetLiveDataResponse>(`/UlasimBackend/api/Calc/GetLiveData?lineCode=${encodeURIComponent(lineCode)}`).catch(() => ({ value: [] } as GetLiveDataResponse)),
        getRouteGeometryResult(lineCode).catch(() => ({ status: 'miss' as const })),
      ])
      const stList = Array.isArray(stationsRes?.value?.stations) ? stationsRes.value.stations : []
      let geometry: [number, number][] | null = null
      let geometryError: string | null = null

      if (geometryResult.status === 'hit') {
        geometry = geometryResult.geometry.coordinates
        trackRouteMapOpen({ lineCode, source: 'backend-cache', entryPoint: source })
      } else {
        void triggerRouteGeometryGeneration(lineCode)
        try {
          const directGeometry = await fetchDirectKmzRouteGeometry(lineCode)
          geometry = directGeometry.coordinates
          trackRouteMapOpen({ lineCode, source: 'direct-kmz', entryPoint: source })
        } catch {
          geometryError = 'Güzergah çizilemedi'
        }
      }

      setSelectedLine({
        lineCode,
        lineName: stationsRes?.value?.lineName || lineCode,
        stations: stList,
        vehicles: Array.isArray(liveRes.value) ? liveRes.value : [],
        geometry,
        vehiclesUpdatedAt: Date.now(),
        geometryError,
      })
      setSelectedStop(null)
    } catch {}
  }, [])

  useEffect(() => {
    const lineParam = searchParams.get('line')
    if (lineParam) {
      handleSelectLine(lineParam, 'line-detail')
    }
  }, [searchParams, handleSelectLine])

  // Refresh live vehicle positions every 15s while a line is selected
  useEffect(() => {
    if (!selectedLine) return
    const lineCode = selectedLine.lineCode
    const interval = setInterval(async () => {
      try {
        const liveRes = await apiGet<GetLiveDataResponse>(
          `/UlasimBackend/api/Calc/GetLiveData?lineCode=${encodeURIComponent(lineCode)}`
        )
        setSelectedLine(prev => {
          if (!prev || prev.lineCode !== lineCode) return prev
          return { ...prev, vehicles: Array.isArray(liveRes.value) ? liveRes.value : [], vehiclesUpdatedAt: Date.now() }
        })
      } catch {}
    }, 15_000)
    return () => clearInterval(interval)
  }, [selectedLine?.lineCode])

  if (!mounted) {
    return <div className="w-full h-full bg-gray-100 flex items-center justify-center"><div className="text-gray-500">Harita yükleniyor...</div></div>
  }

  const lineCoordinates: [number, number][] = selectedLine?.geometry ?? []

  const lineVehiclePositions = (selectedLine?.vehicles || []).map(v => {
    const lat = parseCoord(v.latitude)
    const lng = parseCoord(v.longitude)
    return lat != null && lng != null ? { ...v, lat, lng } : null
  }).filter((v): v is LiveVehicle & { lat: number; lng: number } => v != null)

  return (
    <div className="relative w-full h-full">
      <SearchBar
        stations={rawStations}
        stationIndex={stationIdx}
        onSelectStop={(stop) => { setSelectedStop(stop); setSelectedLine(null) }}
        onFlyTo={(lat, lng) => setFlyTarget({ lat, lng })}
      />
      
      <MapContainer center={[DENIZLI_CENTER.lat, DENIZLI_CENTER.lng]} zoom={14} className="w-full h-full z-0" zoomControl={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={20}
        />
        <FlyToHandler target={flyTarget} />
        <StopMarkers allStops={processedStations} onSelectStop={(stop) => {
          trackStopLookup({ stationId: stop.stationId, source: 'map_marker' })
          setSelectedStop(stop)
          setSelectedLine(null)
          setRefillPanelOpen(false)
        }} />

        {refillPoint && (
          <Marker
            position={[refillPoint.lat, refillPoint.lng]}
            icon={refillIcon}
            eventHandlers={{
              click: () => {
                setSelectedStop(null)
                setSelectedLine(null)
                setRefillPanelOpen(true)
              },
            }}
          />
        )}

        {selectedLine && lineCoordinates.length > 0 && (
          <Polyline positions={lineCoordinates} pathOptions={{ color: LINE_COLOR, weight: 5, opacity: 0.8 }} />
        )}

        {lineVehiclePositions.map((v) => (
          <Marker key={v.plate} position={[v.lat, v.lng]} icon={busIcon(LINE_COLOR)}>
            <Popup>
              <div className="text-center">
                <p className="font-semibold">Hat {cleanLineCode(selectedLine!.lineCode)}</p>
                <p className="text-sm text-gray-600">{v.plate}</p>
              </div>
            </Popup>
          </Marker>
        ))}

        <LocationButton />
      </MapContainer>

      {selectedStop && !selectedLine && (
        <StopPanel stop={selectedStop} onClose={() => setSelectedStop(null)} onSelectLine={(lc) => { handleSelectLine(lc, 'map_stop_panel') }} />
      )}

      {refillPanelOpen && refillPoint && (
        <RefillPanel point={refillPoint} onClose={() => setRefillPanelOpen(false)} />
      )}

      {selectedLine && (
        <LinePanel lineInfo={selectedLine} onClose={() => setSelectedLine(null)} />
      )}
    </div>
  )
}
