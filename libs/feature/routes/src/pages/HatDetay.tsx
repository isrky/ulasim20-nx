import { type RouteStation, apiGet } from '@ulasim20/data-access-transport-api'
import { BackHeader, DesktopNav, MobileNav } from '@ulasim20/ui-page-shell'
import { Button } from '@ulasim20/ui-primitives'
import { Card } from '@ulasim20/ui-primitives'
import { Skeleton } from '@ulasim20/ui-primitives'
import { useFavoriteLines } from '@ulasim20/feature-card'
import { useSEO } from '@ulasim20/util-hooks'
import { trackLineLookup, trackStopLookup } from '@ulasim20/util-analytics'
import { getCurrentPosition } from '@ulasim20/data-access-capacitor'
import { cn } from '@ulasim20/ui-page-shell'
import { cleanLineCode } from '@ulasim20/util-format'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ArrowUpDown, Bus, Clock, MapPinned, Navigation, Star } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

interface LiveVehicle {
  plate: string
  latitude: string
  longitude: string
  speed: string
  routeCode: string
  stopId: number
}

interface GetLiveDataResponse {
  isSuccess?: boolean
  value: LiveVehicle[]
}

interface GetRouteStationsResponse {
  isSuccess?: boolean
  value: { stations: RouteStation[]; lineName?: string }
}

interface StationArrival {
  hatno?: string
  hatadi?: string
  plaka?: string
  sure?: string
}

interface GetBusDataForStationResponse {
  value?: { busList?: StationArrival[] }
}

function parseCoord(coord: string): number | null {
  const num = Number(coord.replace(',', '.'))
  return Number.isFinite(num) ? num : null
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const R = 6371000
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function getOppositeLineCode(lc: string): string {
  if (lc.endsWith('-D') || lc.endsWith('-d')) {
    return lc.slice(0, -2)
  }
  if (lc.endsWith('D') || lc.endsWith('d')) {
    return lc.slice(0, -1)
  }
  if (lc.endsWith('G') || lc.endsWith('g')) {
    return lc + '-D'
  }
  return lc + 'D'
}

function parseDurationToMinutes(text: string | null | undefined): number | null {
  if (!text) return null
  const parts = text.split(':').map(Number)
  if (parts.some((n) => !Number.isFinite(n))) return null
  const [h = 0, m = 0, s = 0] = parts
  return Math.floor((h * 3600 + m * 60 + s) / 60)
}

function formatDurationLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const rem = minutes % 60
  if (hours > 0) return `${hours} sa ${rem > 0 ? `${rem} dk` : ''}`
  return `${minutes} dk`
}

function getSpecialPlateLabel(
  plate: string | undefined,
  nextDepartureTime: string | null,
): string | null {
  if (plate === 'EnYakinKalkis') {
    return nextDepartureTime ? `İLK DURAKTAN KALKIŞ: ${nextDepartureTime}` : 'PLANLANAN SEFER'
  }
  if (plate === 'ilkDurakKalkan') {
    return nextDepartureTime ? `${nextDepartureTime} BU DURAKTAN KALKACAK` : 'BU DURAKTAN KALKACAK'
  }
  return null
}

const REFRESH_MS = 20000

function RouteStopRow({
  stopNumber,
  stop,
  lineCode,
  isFirst,
  isNearest,
  busAtStop,
  etaMin,
  nextDepartureTime,
  isExpanded,
  onToggle,
}: {
  stopNumber: number
  stop: RouteStation
  lineCode: string
  isFirst: boolean
  isNearest: boolean
  busAtStop?: LiveVehicle
  etaMin: number | null
  nextDepartureTime: string | null
  isExpanded: boolean
  onToggle: () => void
}) {
  const [arrivals, setArrivals] = useState<StationArrival[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  const loadEta = useCallback(
    async (showSpinner: boolean) => {
      try {
        if (showSpinner) setLoading(true)
        setError(false)
        const res = await apiGet<GetBusDataForStationResponse>(
          `/UlasimBackend/api/Calc/GetBusDataForStation?waitingStation=${stop.stationId}&routeCode=${lineCode}`,
        )
        const list = Array.isArray(res?.value?.busList) ? res.value.busList : []
        setArrivals(list)
      } catch {
        setArrivals([])
        setError(true)
      } finally {
        if (showSpinner) setLoading(false)
      }
    },
    [lineCode, stop.stationId],
  )

  useEffect(() => {
    if (!isExpanded) return
    let cancelled = false
    const load = async (showSpinner: boolean) => {
      if (cancelled) return
      await loadEta(showSpinner)
    }
    load(true)
    const interval = setInterval(() => load(false), REFRESH_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [isExpanded, loadEta])

  const primaryArrival = arrivals
    .map((arrival) => ({ arrival, minutes: parseDurationToMinutes(arrival.sure) }))
    .find((item): item is { arrival: StationArrival; minutes: number } => item.minutes != null)
  const primaryPlateLabel =
    getSpecialPlateLabel(primaryArrival?.arrival.plaka, nextDepartureTime) ??
    primaryArrival?.arrival.plaka

  const summaryParts: string[] = []
  if (isFirst && nextDepartureTime) summaryParts.push(`SONRAKİ KALKIŞ ${nextDepartureTime}`)
  if (busAtStop?.plate) summaryParts.push(busAtStop.plate)
  if (etaMin != null && etaMin > 0 && !busAtStop) summaryParts.push(`${etaMin} dk`)

  return (
    <div className="rounded-xl overflow-hidden">
      <button
        type="button"
        aria-expanded={isExpanded}
        onClick={onToggle}
        className={cn(
          'w-full flex items-center justify-between gap-3 px-3 py-3 text-left transition-colors hover:bg-gray-50',
          isExpanded && 'bg-gray-50',
          isNearest && 'bg-transit-primary/10 hover:bg-transit-primary/15',
          busAtStop && 'bg-emerald-50 hover:bg-emerald-100/70',
        )}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <span className="shrink-0 text-xs font-semibold text-gray-400">#{stopNumber}</span>
          <span
            className={cn(
              'min-w-0 flex-1 truncate text-sm font-medium text-gray-900',
              isNearest && 'text-transit-primary font-semibold',
              busAtStop && 'font-semibold',
            )}
          >
            {stop.stationName}
          </span>
        </span>
        {summaryParts.length > 0 && (
          <span className="shrink-0 text-right text-xs text-gray-500">
            {summaryParts.join(' · ')}
          </span>
        )}
      </button>

      {isExpanded && (
        <div className="border-t border-gray-100 bg-gray-50/70 px-3 py-3 text-sm">
          {loading ? (
            <div className="flex items-center gap-2 text-gray-500">
              <Clock className="w-4 h-4" />
              ETA alınıyor…
            </div>
          ) : error ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-red-600">ETA alınamadı</span>
              <Button variant="outline" size="sm" onClick={() => loadEta(true)}>
                Tekrar dene
              </Button>
            </div>
          ) : primaryArrival ? (
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium text-gray-900">
                  {formatDurationLabel(primaryArrival.minutes)}
                </p>
                {primaryPlateLabel && (
                  <p className="text-xs text-gray-500 mt-0.5">{primaryPlateLabel}</p>
                )}
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link
                  to={`/duraklar/${stop.stationId}`}
                  onClick={() =>
                    trackStopLookup({ stationId: stop.stationId, source: 'line_detail_eta_panel' })
                  }
                >
                  Daha Fazla
                </Link>
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <span className="text-gray-500">Bu hat için yaklaşan araç yok.</span>
              <Button variant="outline" size="sm" asChild>
                <Link
                  to={`/duraklar/${stop.stationId}`}
                  onClick={() =>
                    trackStopLookup({ stationId: stop.stationId, source: 'line_detail_eta_panel' })
                  }
                >
                  Daha Fazla
                </Link>
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
function LineDetailContent({ lineCode }: { lineCode: string }) {
  const navigate = useNavigate()
  const { isFavorite, toggleFavorite } = useFavoriteLines()
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const [stations, setStations] = useState<RouteStation[]>([])
  const [lineName, setLineName] = useState('')
  const [vehicles, setVehicles] = useState<LiveVehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nearestStationId, setNearestStationId] = useState<number | null>(null)
  const [nextDepartureTime, setNextDepartureTime] = useState<string | null>(null)
  const [expandedStationId, setExpandedStationId] = useState<number | null>(null)

  useSEO({
    title: lineName ? `${cleanLineCode(lineCode)} - ${lineName}` : `Hat ${cleanLineCode(lineCode)}`,
    description: lineName
      ? `${cleanLineCode(lineCode)} - ${lineName} otobüs hattı güzergahı, durakları, kalkış saatleri ve canlı otobüs konumları.`
      : `Hat ${cleanLineCode(lineCode)} otobüs saatleri, güzergahı ve canlı durak bilgileri.`,
  })

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setLoading(true)
        setError(null)
        const [stationsRes, liveRes] = await Promise.all([
          apiGet<GetRouteStationsResponse>(
            `/UlasimBackend/api/Calc/GetRouteStations?routeCode=${encodeURIComponent(lineCode)}`,
          ),
          apiGet<GetLiveDataResponse>(
            `/UlasimBackend/api/Calc/GetLiveData?lineCode=${encodeURIComponent(lineCode)}`,
          ).catch(() => ({ value: [] }) as GetLiveDataResponse),
        ])
        if (cancelled) return
        const stList = stationsRes?.value?.stations
        if (Array.isArray(stList)) setStations(stList)
        if (stationsRes?.value?.lineName) setLineName(stationsRes.value.lineName)
        if (Array.isArray(liveRes.value)) setVehicles(liveRes.value)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Hata')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [lineCode])

  useEffect(() => {
    setExpandedStationId(null)
  }, [lineCode])

  // Fetch next departure time
  useEffect(() => {
    async function fetchNextDeparture() {
      try {
        const res = await apiGet<{ value?: { busTime?: string } }>(
          `/UlasimBackend/api/Calc/GetNextBusTime?lineNo=${encodeURIComponent(lineCode)}`,
        )
        if (res?.value?.busTime) {
          // Extract "HH.mm" from "YYYY-MM-DDTHH:mm:ss"
          const timePart = res.value.busTime.split('T')[1]?.substring(0, 5).replace(':', '.')
          if (timePart) {
            setNextDepartureTime(timePart)
          }
        }
      } catch {
        // ignore errors
      }
    }
    fetchNextDeparture()
  }, [lineCode])

  // Refresh live data periodically
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await apiGet<GetLiveDataResponse>(
          `/UlasimBackend/api/Calc/GetLiveData?lineCode=${encodeURIComponent(lineCode)}`,
        )
        if (Array.isArray(res.value)) setVehicles(res.value)
      } catch {}
    }, 20000)
    return () => clearInterval(interval)
  }, [lineCode])

  const handleDirectionToggle = useCallback(() => {
    const oppCode = getOppositeLineCode(lineCode)
    trackLineLookup({ lineCode: oppCode, source: 'line_detail_direction_toggle' })
    navigate(`/hatlar/${encodeURIComponent(oppCode)}`, { replace: true })
  }, [lineCode, navigate])

  const virtualizer = useVirtualizer({
    count: stations.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 44,
    overscan: 10,
  })

  const scrollToNearest = useCallback(async () => {
    try {
      const pos = await getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 })
      const { latitude: lat, longitude: lng } = pos.coords

      let nearestIdx = 0
      let nearestId: number | null = null
      let minDist = Number.POSITIVE_INFINITY
      for (let i = 0; i < stations.length; i++) {
        const st = stations[i]
        const sLat = parseCoord(st.latitude)
        const sLng = parseCoord(st.longitude)
        if (sLat == null || sLng == null) continue
        const d = haversineMeters(lat, lng, sLat, sLng)
        if (d < minDist) {
          minDist = d
          nearestId = st.stationId
          nearestIdx = i
        }
      }
      setNearestStationId(nearestId)
      setTimeout(
        () => virtualizer.scrollToIndex(nearestIdx, { align: 'center', behavior: 'smooth' }),
        100,
      )
    } catch {
      if (stations.length > 0) {
        setNearestStationId(stations[0].stationId)
        setTimeout(() => virtualizer.scrollToIndex(0, { align: 'center', behavior: 'smooth' }), 100)
      }
    }
  }, [stations, virtualizer])

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <Skeleton className="h-12 w-2/3 mb-4" />
        <Skeleton className="h-20 w-full mb-4" />
        <Skeleton className="h-10 w-full mb-4" />
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-8 w-full mb-2" />
        ))}
      </div>
    )
  }

  if (error || stations.length === 0) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <Card className="p-8 text-center">
          <Bus className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">{error || 'Hat bulunamadı'}</p>
        </Card>
      </div>
    )
  }

  const fav = isFavorite(lineCode)
  const displayCode = cleanLineCode(lineCode)
  const vehiclesByStop = new Map<number, LiveVehicle>()
  for (const v of vehicles) {
    if (v.stopId) vehiclesByStop.set(v.stopId, v)
  }

  return (
    <div className="max-w-2xl mx-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-bold text-gray-900">{displayCode}</h1>
          <p className="text-sm text-gray-500">
            {stations.length} durak · {vehicles.length} araç yolda
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleDirectionToggle}>
            <ArrowUpDown className="w-4 h-4 mr-1" />
            Yön Değiştir
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => toggleFavorite(lineCode, lineName)}
            className={cn(fav && 'text-yellow-500 border-yellow-500 hover:text-yellow-600')}
          >
            <Star className={cn('w-4 h-4', fav && 'fill-current')} />
          </Button>
        </div>
      </div>

      <div className="grid gap-2 mb-4 sm:grid-cols-2">
        <Button size="sm" asChild variant="outline" className="w-full">
          <Link to={`/harita?line=${encodeURIComponent(lineCode)}`}>
            <MapPinned className="w-4 h-4 mr-1" />
            Güzergahı Haritada Göster
          </Link>
        </Button>
        <Button
          size="sm"
          onClick={scrollToNearest}
          className="w-full bg-transit-primary hover:bg-transit-primary/90"
        >
          <Navigation className="w-4 h-4 mr-1" />
          En Yakın Durağa Kaydır
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div ref={scrollContainerRef} className="max-h-[60vh] overflow-y-auto p-3">
          <div className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const idx = virtualRow.index
              const stop = stations[idx]
              const isFirst = idx === 0
              const isNearest = stop.stationId === nearestStationId
              const busAtStop = vehiclesByStop.get(stop.stationId)
              const etaMin = parseDurationToMinutes(stop.sure)

              return (
                <div
                  key={`${stop.stationId}-${stop.sequence}`}
                  className="absolute top-0 left-0 w-full pb-2"
                  ref={virtualizer.measureElement}
                  data-index={idx}
                  style={{ transform: `translateY(${virtualRow.start}px)` }}
                >
                  <RouteStopRow
                    stopNumber={idx + 1}
                    stop={stop}
                    lineCode={lineCode}
                    isFirst={isFirst}
                    isNearest={isNearest}
                    busAtStop={busAtStop}
                    etaMin={etaMin}
                    nextDepartureTime={nextDepartureTime}
                    isExpanded={expandedStationId === stop.stationId}
                    onToggle={() =>
                      setExpandedStationId((current) =>
                        current === stop.stationId ? null : stop.stationId,
                      )
                    }
                  />
                </div>
              )
            })}
          </div>
        </div>
      </Card>
    </div>
  )
}

export default function LineDetailPage() {
  const { id } = useParams<{ id: string }>()
  const lineCode = id || ''
  const displayCode = cleanLineCode(lineCode)

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <DesktopNav />
      <BackHeader title={`Hat ${displayCode}`} />
      <main className="flex-1 pb-20 md:pb-8">
        <LineDetailContent lineCode={lineCode} />
      </main>
      <MobileNav />
    </div>
  )
}
