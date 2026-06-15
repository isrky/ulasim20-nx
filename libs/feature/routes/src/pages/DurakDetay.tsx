import { type BusData, type Station, apiGet, getAllStations } from '@ulasim20/data-access-transport-api'
import { BackHeader, DesktopNav, MobileNav } from '@ulasim20/ui-page-shell'
import { Button } from '@ulasim20/ui-primitives'
import { Card } from '@ulasim20/ui-primitives'
import { Skeleton } from '@ulasim20/ui-primitives'
import { useFavorites } from '@ulasim20/feature-card'
import { useSEO } from '@ulasim20/util-hooks'
import { trackLineLookup, trackStopLookup } from '@ulasim20/util-analytics'
import { cn } from '@ulasim20/ui-page-shell'
import { cleanLineCode } from '@ulasim20/util-format'
import { ArrowLeftRight, Clock, MapPin, Navigation, Star } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

const REFRESH_MS = 20000

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

function normalizeStationName(name: string): string {
  let n = name.toLowerCase().trim()
  n = n.replace(/\s*\([abcd]\)\s*/gi, ' ')
  n = n.replace(/\s*\(gidiş\)\s*/gi, ' ').replace(/\s*\(dönüş\)\s*/gi, ' ')
  n = n.replace(/\s*\(\d+\)\s*/gi, ' ')
  n = n.replace(/\s+\d+$/, '').replace(/\s+[abcd]$/i, '')
  return n.replace(/\s+/g, ' ').trim()
}

function parseDestination(hatadi: string): string {
  const cleaned = hatadi
    .replace(/\(\s*D\s*\)/gi, '')
    .replace(/\bD\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
  const parts = cleaned.split(/\s*-\s*/)
  return parts[parts.length - 1]?.trim() || cleaned
}

function parseArrivalMinutes(bus: BusData): number | null {
  if (bus.sure) {
    const parts = bus.sure.split(':').map(Number)
    if (parts.every((n) => Number.isFinite(n))) {
      const [h = 0, m = 0, s = 0] = parts
      return Math.floor((h * 3600 + m * 60 + s) / 60)
    }
  }
  if (bus.kalkisaKadarkiDakika) {
    const v = Number(bus.kalkisaKadarkiDakika.replace(',', '.'))
    if (Number.isFinite(v)) return Math.round(v)
  }
  return null
}

function formatArrivalLabel(bus: BusData): string {
  if (bus.sure) {
    const parts = bus.sure.split(':').map(Number)
    if (parts.every((n) => Number.isFinite(n))) {
      const [h = 0, m = 0, s = 0] = parts
      const totalSec = h * 3600 + m * 60 + s
      if (totalSec < 30) return 'Gelmek üzere'
      const hours = Math.floor(totalSec / 3600)
      const mins = Math.floor((totalSec % 3600) / 60)
      if (hours > 0) return `${hours} sa ${mins > 0 ? `${mins} dk` : ''}`
      return `${mins} dk`
    }
  }
  if (bus.kalkisaKadarkiDakika) {
    const v = Number(bus.kalkisaKadarkiDakika.replace(',', '.'))
    if (Number.isFinite(v)) {
      const mins = Math.round(v)
      const hours = Math.floor(mins / 60)
      const rem = mins % 60
      if (hours > 0) return `${hours} sa ${rem > 0 ? `${rem} dk` : ''}`
      return `${mins} dk`
    }
  }
  return '-'
}

function StopDetailContent({ stationId }: { stationId: number }) {
  const { isFavorite, toggleFavorite } = useFavorites()
  const [station, setStation] = useState<Station | null>(null)
  const [stations, setStations] = useState<Station[]>([])
  const [busList, setBusList] = useState<BusData[]>([])
  const [loading, setLoading] = useState(true)
  const [arrivalsLoading, setArrivalsLoading] = useState(true)
  const [nextBusTimes, setNextBusTimes] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false
    getAllStations()
      .then((list) => {
        if (cancelled) return
        const arr = Array.isArray(list) ? list : []
        setStations(arr)
        setStation(arr.find((s) => s.stationId === stationId) || null)
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [stationId])

  useEffect(() => {
    let cancelled = false
    async function loadArrivals(showSpinner: boolean) {
      try {
        if (showSpinner) setArrivalsLoading(true)
        const data = await apiGet<{ value?: { busList?: BusData[] } }>(
          `/UlasimBackend/api/Calc/GetBusDataForStation?waitingStation=${stationId}&routeCode=`,
        )
        if (!cancelled) setBusList(Array.isArray(data?.value?.busList) ? data.value.busList : [])
      } catch {
        if (!cancelled) setBusList([])
      } finally {
        if (!cancelled && showSpinner) setArrivalsLoading(false)
      }
    }
    loadArrivals(true)
    const interval = setInterval(() => loadArrivals(false), REFRESH_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [stationId])

  useEffect(() => {
    const linesToFetch = [
      ...new Set(
        busList
          .filter((b) => b.plaka === 'EnYakinKalkis' || b.plaka === 'ilkDurakKalkan')
          .map((b) => b.hatno),
      ),
    ]

    const fetchNextTimes = async () => {
      for (const hatno of linesToFetch) {
        if (nextBusTimes[hatno]) continue // already fetched
        try {
          const res = await apiGet<{ value?: { busTime?: string } }>(
            `/UlasimBackend/api/Calc/GetNextBusTime?lineNo=${encodeURIComponent(hatno)}`,
          )
          if (res?.value?.busTime) {
            // Extract "HH:mm" from "YYYY-MM-DDTHH:mm:ss" and replace ":" with "."
            const timePart = res.value.busTime.split('T')[1]?.substring(0, 5).replace(':', '.')
            if (timePart) {
              setNextBusTimes((prev) => ({ ...prev, [hatno]: timePart }))
            }
          }
        } catch (_e) {
          // ignore errors
        }
      }
    }
    fetchNextTimes()
  }, [busList, nextBusTimes])

  const oppositeStations = useMemo(() => {
    if (!station) return []
    const normalized = normalizeStationName(station.stationName)
    const lat = parseCoord(station.latitude)
    const lng = parseCoord(station.longitude)
    return stations.filter((s) => {
      if (s.stationId === station.stationId) return false
      if (normalizeStationName(s.stationName) !== normalized) return false
      const sLat = parseCoord(s.latitude)
      const sLng = parseCoord(s.longitude)
      if (lat != null && lng != null && sLat != null && sLng != null) {
        if (haversineMeters(lat, lng, sLat, sLng) > 300) return false
      }
      return true
    })
  }, [station, stations])

  const sortedBusList = useMemo(() => {
    return [...busList].sort((a, b) => {
      const aMin = parseArrivalMinutes(a) ?? 99999
      const bMin = parseArrivalMinutes(b) ?? 99999
      return aMin - bMin
    })
  }, [busList])

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <Skeleton className="h-8 w-2/3 mb-2" />
        <Skeleton className="h-5 w-1/3 mb-6" />
        <Skeleton className="h-11 w-full mb-6" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full mb-2" />
        ))}
      </div>
    )
  }

  if (!station) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <Card className="p-8 text-center">
          <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Durak bulunamadı</p>
        </Card>
      </div>
    )
  }

  const fav = isFavorite(station.stationId)
  const lat = parseCoord(station.latitude)
  const lng = parseCoord(station.longitude)
  const mapsDirectionsUrl =
    lat != null && lng != null
      ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
      : null

  return (
    <div className="max-w-2xl mx-auto p-4">
      <div className="flex items-start justify-between gap-2 mb-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900">{station.stationName}</h1>
          <p className="text-gray-500 mt-1">#{station.stationId}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {mapsDirectionsUrl && (
            <a href={mapsDirectionsUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="text-gray-600">
                <Navigation className="w-4 h-4 mr-1.5" />
                Yol tarifi
              </Button>
            </a>
          )}
          <Button
            variant="outline"
            size="icon"
            onClick={() => toggleFavorite(station.stationId, station.stationName)}
            className={cn(
              fav &&
                'text-yellow-500 border-yellow-500 hover:text-yellow-600 hover:border-yellow-600',
            )}
            title={fav ? 'Favorilerden çıkar' : 'Favorilere ekle'}
          >
            <Star className={cn('w-5 h-5', fav && 'fill-current')} />
          </Button>
        </div>
      </div>

      {oppositeStations.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {oppositeStations.map((opp) => (
            <Link
              key={opp.stationId}
              to={`/duraklar/${opp.stationId}`}
              onClick={() =>
                trackStopLookup({ stationId: opp.stationId, source: 'stop_detail_opposite' })
              }
            >
              <Button
                variant="outline"
                className="h-11 border-transit-primary text-transit-primary hover:bg-transit-primary hover:text-white"
              >
                <ArrowLeftRight className="w-4 h-4 mr-2" />
                Karşı Durağa Geç
                <span className="ml-1 text-xs opacity-60">#{opp.stationId}</span>
              </Button>
            </Link>
          ))}
        </div>
      )}

      <div className="mb-6">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2 mb-3">
          <Clock className="w-5 h-5 text-transit-primary" />
          Yaklaşan Otobüsler
        </h2>

        {arrivalsLoading ? (
          <div className="space-y-1.5">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        ) : sortedBusList.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="text-gray-500">Bu durak için yaklaşan araç yok.</p>
          </Card>
        ) : (
          <div className="space-y-1.5">
            {sortedBusList.map((bus, idx) => (
              <Card key={`${bus.hatno}-${bus.plaka}-${idx}`} className="overflow-hidden py-0">
                <Link
                  to={`/hatlar/${encodeURIComponent(bus.hatno)}`}
                  className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 transition-colors"
                  onClick={() =>
                    trackLineLookup({ lineCode: bus.hatno, source: 'stop_detail_arrivals' })
                  }
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="px-2 py-0.5 rounded text-white font-bold text-sm shrink-0 bg-transit-primary">
                      {cleanLineCode(bus.hatno)}
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">
                        {parseDestination(bus.hatadi)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {bus.plaka === 'EnYakinKalkis'
                          ? nextBusTimes[bus.hatno]
                            ? `İLK DURAKTAN KALKIŞ: ${nextBusTimes[bus.hatno]}`
                            : 'PLANLANAN SEFER'
                          : bus.plaka === 'ilkDurakKalkan'
                            ? nextBusTimes[bus.hatno]
                              ? `${nextBusTimes[bus.hatno]} BU DURAKTAN KALKACAK`
                              : 'BU DURAKTAN KALKACAK'
                            : bus.plaka || ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-transit-primary font-semibold text-sm shrink-0">
                    <span>{formatArrivalLabel(bus)}</span>
                  </div>
                </Link>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function StopDetailPage() {
  const { id } = useParams<{ id: string }>()
  const stationId = Number(id)
  const [stationName, setStationName] = useState<string>('')

  useSEO({
    title: stationName ? `${stationName} Durağı` : 'Durak Detayı',
    description: stationName
      ? `${stationName} otobüs durağı canlı varış saatleri, yaklaşan otobüsler, otobüs saatleri ve duraktan geçen otobüs hatları.`
      : 'Otobüs durağı detayları, yaklaşan otobüsler ve canlı varış saatleri.',
  })

  useEffect(() => {
    if (!Number.isFinite(stationId)) return
    getAllStations()
      .then((list) => {
        const s = list.find((st) => st.stationId === stationId)
        if (s) setStationName(s.stationName)
      })
      .catch(() => {})
  }, [stationId])

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <DesktopNav />
      <BackHeader title={stationName || 'Durak'} />
      <main className="flex-1 pb-20 md:pb-8">
        {Number.isFinite(stationId) ? (
          <StopDetailContent stationId={stationId} />
        ) : (
          <div className="max-w-2xl mx-auto p-4">
            <Card className="p-8 text-center">
              <p className="text-gray-500">Geçersiz durak ID</p>
            </Card>
          </div>
        )}
      </main>
      <MobileNav />
    </div>
  )
}
