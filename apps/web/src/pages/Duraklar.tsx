import { type BusData, type Station, getAllStations, getBusDataForStation } from '@/api/denizli'
import { DesktopNav, MobileNav } from '@/components/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useFavorites } from '@/hooks/use-favorites'
import { useSEO } from '@/hooks/use-seo'
import { trackAnalyticsEvent, trackStopLookup } from '@/lib/analytics'
import { getCurrentPosition } from '@/lib/capacitor'
import { cn } from '@/lib/utils'
import { buildStationIndex, searchStations } from '@/utils/search'
import { cleanLineCode } from '@/utils/text'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ArrowRight, Clock, MapPin, Navigation, Search, Star } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

type StationWithDist = Station & { _distanceM: number }

interface MiniArrival {
  lineCode: string
  destination: string
  arrivalMinutes: number
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

function parseDestination(hatadi: string): string {
  const cleaned = hatadi
    .replace(/\(\s*D\s*\)/gi, '')
    .replace(/\bD\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
  const parts = cleaned.split(/\s*-\s*/)
  return parts[parts.length - 1]?.trim() || cleaned
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

function parseCoord(coord: string): number | null {
  const num = Number(coord.replace(',', '.'))
  return Number.isFinite(num) ? num : null
}

function formatDistance(meters: number): string {
  if (meters < 950) return `${Math.round(meters)}m`
  return `${(meters / 1000).toFixed(1)}km`
}

function StopCard({ station, source = 'stations_search' }: { station: Station; source?: string }) {
  const { isFavorite, toggleFavorite } = useFavorites()
  const [arrivals, setArrivals] = useState<MiniArrival[]>([])

  useEffect(() => {
    let cancelled = false
    getBusDataForStation(station.stationId)
      .then((res) => {
        if (cancelled || !res?.value?.busList) return
        const list: MiniArrival[] = []
        for (const bus of res.value.busList) {
          if (bus.plaka === 'EnYakinKalkis') continue
          const mins = parseArrivalMinutes(bus)
          if (mins == null) continue
          list.push({
            lineCode: cleanLineCode(bus.hatno),
            destination: parseDestination(bus.hatadi),
            arrivalMinutes: mins,
          })
        }
        list.sort((a, b) => a.arrivalMinutes - b.arrivalMinutes)
        if (!cancelled) setArrivals(list.slice(0, 3))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [station.stationId])

  const fav = isFavorite(station.stationId)

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between mb-3">
        <Link
          to={`/duraklar/${station.stationId}`}
          className="flex-1"
          onClick={() => {
            trackAnalyticsEvent('search_select', {
              source,
              result_type: 'station',
              station_id: station.stationId,
            })
            trackStopLookup({ stationId: station.stationId, source })
          }}
        >
          <h3 className="font-semibold text-gray-900 hover:text-transit-primary transition-colors">
            {station.stationName}
          </h3>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-sm text-gray-500">#{station.stationId}</span>
          </div>
        </Link>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => toggleFavorite(station.stationId, station.stationName)}
          className={cn('shrink-0', fav && 'text-yellow-500 hover:text-yellow-600')}
        >
          <Star className={cn('w-5 h-5', fav && 'fill-current')} />
        </Button>
      </div>

      {arrivals.length > 0 && (
        <div className="space-y-2 border-t border-gray-100 pt-3">
          {arrivals.map((arrival, idx) => (
            <div key={idx} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-8 h-6 rounded bg-transit-primary/10 text-transit-primary text-xs font-semibold flex items-center justify-center">
                  {arrival.lineCode}
                </span>
                <span className="text-sm text-gray-600">{arrival.destination}</span>
              </div>
              <span className="text-sm font-medium text-transit-primary flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {arrival.arrivalMinutes} dk
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

function VirtualCompactStopCard({
  station,
  fav,
  toggleFavorite,
  source = 'stations_search',
}: {
  station: Station
  fav: boolean
  toggleFavorite: (id: number, name: string) => void
  source?: string
}) {
  return (
    <Card className="overflow-hidden py-0 h-full">
      <Link
        to={`/duraklar/${station.stationId}`}
        className="flex items-center justify-between px-3 h-full hover:bg-gray-50 transition-colors"
        onClick={() => {
          trackAnalyticsEvent('search_select', {
            source,
            result_type: 'station',
            station_id: station.stationId,
          })
          trackStopLookup({ stationId: station.stationId, source })
        }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <MapPin className="w-4 h-4 text-transit-primary shrink-0" />
          <div className="min-w-0">
            <p className="font-medium text-gray-900 text-sm truncate">{station.stationName}</p>
            <p className="text-xs text-gray-500">#{station.stationId}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.preventDefault()
              toggleFavorite(station.stationId, station.stationName)
            }}
            className={cn('h-7 w-7', fav && 'text-yellow-500 hover:text-yellow-600')}
          >
            <Star className={cn('w-4 h-4', fav && 'fill-current')} />
          </Button>
          <ArrowRight className="w-4 h-4 text-gray-400" />
        </div>
      </Link>
    </Card>
  )
}

function StopsContent() {
  const [stations, setStations] = useState<Station[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [showNearby, setShowNearby] = useState(false)
  const [nearbyStations, setNearbyStations] = useState<StationWithDist[]>([])
  const [loadingNearby, setLoadingNearby] = useState(false)
  const parentRef = useRef<HTMLDivElement>(null)
  const { isFavorite, toggleFavorite } = useFavorites()

  useEffect(() => {
    let cancelled = false
    getAllStations()
      .then((list) => {
        if (!cancelled) {
          setStations(Array.isArray(list) ? list : [])
          setLoading(false)
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Bilinmeyen hata')
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const stationIndex = useMemo(() => buildStationIndex(stations), [stations])

  const trimmedSearch = search.trim()
  const startsWithNumber = /^\d/.test(trimmedSearch)
  const searchActive = startsWithNumber ? trimmedSearch.length > 0 : trimmedSearch.length >= 4
  const searchHint = !startsWithNumber && trimmedSearch.length > 0 && trimmedSearch.length < 4

  const filteredStops = useMemo(() => {
    if (!searchActive) return []
    return searchStations(stations, search, stationIndex)
      .filter((r) => r.score > 0)
      .map((r) => r.item)
  }, [stations, search, searchActive, stationIndex])

  const virtualizer = useVirtualizer({
    count: filteredStops.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 54,
    overscan: 10,
  })

  const handleNearbyClick = useCallback(async () => {
    if (showNearby) {
      setShowNearby(false)
      return
    }
    setLoadingNearby(true)
    try {
      const pos = await getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 })
      const { latitude: uLat, longitude: uLng } = pos.coords
      const withDist: StationWithDist[] = stations
        .map((s) => {
          const lat = parseCoord(s.latitude)
          const lng = parseCoord(s.longitude)
          if (lat == null || lng == null) return null
          return { ...s, _distanceM: haversineMeters(uLat, uLng, lat, lng) }
        })
        .filter((x): x is StationWithDist => x != null)
        .sort((a, b) => a._distanceM - b._distanceM)
        .slice(0, 10)
      setNearbyStations(withDist)
      setShowNearby(true)
    } catch {
      const DENIZLI_LAT = 37.7765,
        DENIZLI_LNG = 29.0864
      const withDist: StationWithDist[] = stations
        .map((s) => {
          const lat = parseCoord(s.latitude)
          const lng = parseCoord(s.longitude)
          if (lat == null || lng == null) return null
          return { ...s, _distanceM: haversineMeters(DENIZLI_LAT, DENIZLI_LNG, lat, lng) }
        })
        .filter((x): x is StationWithDist => x != null)
        .sort((a, b) => a._distanceM - b._distanceM)
        .slice(0, 10)
      setNearbyStations(withDist)
      setShowNearby(true)
    } finally {
      setLoadingNearby(false)
    }
  }, [showNearby, stations])

  return (
    <div className="max-w-2xl mx-auto p-4 flex flex-col h-[calc(100vh-64px)] md:h-screen">
      <h1 className="text-2xl font-bold text-gray-900 mb-6 shrink-0">Duraklar</h1>

      <div className="mb-4 shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Durak ara..."
            className="pl-10 h-12 bg-white"
          />
        </div>
        {searchHint && <p className="text-xs text-gray-400 mt-1.5 ml-1">En az 4 karakter girin</p>}
      </div>

      {loading ? (
        <div className="space-y-2 shrink-0">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="p-4">
              <Skeleton className="h-5 w-3/4 mb-2" />
              <Skeleton className="h-4 w-1/2" />
            </Card>
          ))}
        </div>
      ) : error ? (
        <Card className="p-8 text-center shrink-0">
          <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">{error}</p>
        </Card>
      ) : searchActive ? (
        <div className="flex-1 flex flex-col min-h-0">
          {filteredStops.length > 0 ? (
            <>
              <p className="text-sm text-gray-500 mb-3 shrink-0">
                {filteredStops.length} durak bulundu
              </p>
              {filteredStops.length <= 2 ? (
                <div className="space-y-3 shrink-0">
                  {filteredStops.map((s) => (
                    <StopCard key={s.stationId} station={s} />
                  ))}
                </div>
              ) : (
                <div ref={parentRef} className="flex-1 overflow-y-auto min-h-0">
                  <div
                    style={{
                      height: `${virtualizer.getTotalSize()}px`,
                      width: '100%',
                      position: 'relative',
                    }}
                  >
                    {virtualizer.getVirtualItems().map((virtualItem) => {
                      const s = filteredStops[virtualItem.index]
                      const fav = isFavorite(s.stationId)
                      return (
                        <div
                          key={virtualItem.key}
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: `${virtualItem.size}px`,
                            transform: `translateY(${virtualItem.start}px)`,
                            paddingBottom: '6px',
                          }}
                        >
                          <VirtualCompactStopCard
                            station={s}
                            fav={fav}
                            toggleFavorite={toggleFavorite}
                            source="stations_search"
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            <Card className="p-8 text-center shrink-0">
              <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Durak bulunamadı</p>
            </Card>
          )}
        </div>
      ) : (
        <div className="shrink-0">
          <Button
            variant="outline"
            onClick={handleNearbyClick}
            disabled={loadingNearby}
            className={cn(
              'w-full mb-4 h-11 transition-colors',
              showNearby
                ? 'border-transit-primary text-transit-primary hover:bg-transit-primary hover:text-white'
                : 'bg-transit-primary text-white border-transit-primary hover:bg-transit-primary/90',
            )}
          >
            <Navigation className="w-4 h-4 mr-2" />
            {loadingNearby
              ? 'Konum alınıyor...'
              : showNearby
                ? 'Yakındaki Durakları Gizle'
                : 'Yakınımdaki Duraklar'}
          </Button>

          {showNearby && nearbyStations.length > 0 && (
            <div className="space-y-1.5 mb-4">
              {nearbyStations.slice(0, 5).map((s) => (
                <Card key={s.stationId} className="overflow-hidden py-0">
                  <Link
                    to={`/duraklar/${s.stationId}`}
                    className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 transition-colors"
                    onClick={() => {
                      trackAnalyticsEvent('search_select', {
                        source: 'nearby_stations',
                        result_type: 'station',
                        station_id: s.stationId,
                      })
                      trackStopLookup({ stationId: s.stationId, source: 'nearby_stations' })
                    }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <MapPin className="w-4 h-4 text-transit-primary shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 text-sm truncate">
                          {s.stationName}
                        </p>
                        <p className="text-xs text-gray-500">
                          #{s.stationId} · {formatDistance(s._distanceM)}
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-400 shrink-0" />
                  </Link>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function StopsPage() {
  useSEO({
    title: 'Otobüs Durakları',
    description: 'Denizli otobüs durakları listesi ve yakındaki durakları bulma.',
  })

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <DesktopNav />
      <main className="flex-1 pb-20 md:pb-8">
        <StopsContent />
      </main>
      <MobileNav />
    </div>
  )
}
