import { type BusData, apiGet, getBusDataForStation } from '@ulasim20/data-access-transport-api'
import { DesktopNav, MobileNav } from '@ulasim20/ui-page-shell'
import { Button } from '@ulasim20/ui-primitives'
import { Card } from '@ulasim20/ui-primitives'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@ulasim20/ui-primitives'
import { useFavoriteLines, useFavorites } from '@ulasim20/feature-card'
import { useSEO } from '@ulasim20/util-hooks'
import { trackLineLookup, trackStopLookup } from '@ulasim20/util-analytics'
import { cleanLineCode, cleanLineName } from '@ulasim20/util-format'
import { cn } from '@ulasim20/ui-page-shell'
import { ArrowRight, Bus, Clock, MapPin, Star, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

interface StationArrival {
  lineCode: string
  minutes: number
  isPriority: boolean
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

function FavoritesContent() {
  const {
    favorites: favoriteStops,
    removeFavorite: removeStop,
    incrementClickCount: incrementStopClickCount,
  } = useFavorites()
  const {
    favorites: favoriteLines,
    removeFavorite: removeLine,
    incrementClickCount: incrementLineClickCount,
  } = useFavoriteLines()
  const [stationArrivals, setStationArrivals] = useState<Record<number, StationArrival[]>>({})
  const [lineGlances, setLineGlances] = useState<Record<string, { activeBuses: number }>>({})

  useEffect(() => {
    if (favoriteStops.length === 0) {
      setStationArrivals({})
      return
    }
    let cancelled = false

    // Helper to check if a line is in user's favorite lines
    const favLineCodes = new Set(favoriteLines.map((l) => cleanLineCode(l.lineCode)))

    async function loadArrivals() {
      const results: Record<number, StationArrival[]> = {}
      await Promise.all(
        favoriteStops.map(async (fav) => {
          try {
            const res = await getBusDataForStation(fav.stationId)
            if (cancelled || !res?.value?.busList) return

            const seenLines = new Set<string>()

            // 1. Get all valid buses and clean data
            const allBuses = res.value.busList
              .filter((bus) => bus.plaka !== 'EnYakinKalkis')
              .map((bus) => {
                const cleaned = cleanLineCode(bus.hatno)
                return {
                  lineCode: cleaned,
                  minutes: parseArrivalMinutes(bus),
                  isPriority: favLineCodes.has(cleaned),
                }
              })
              .filter((item) => item.minutes != null) as StationArrival[]

            // 2. Sort by minutes first to facilitate finding the earliest for each line
            allBuses.sort((a, b) => a.minutes - b.minutes)

            // 3. Deduplicate by lineCode (keeping earliest)
            const uniqueLines: StationArrival[] = []
            for (const item of allBuses) {
              if (!seenLines.has(item.lineCode)) {
                seenLines.add(item.lineCode)
                uniqueLines.push(item)
              }
            }

            // 4. Prioritize: Favorite lines first, then sort by minutes within groups
            uniqueLines.sort((a, b) => {
              if (a.isPriority === b.isPriority) return a.minutes - b.minutes
              return a.isPriority ? -1 : 1
            })

            results[fav.stationId] = uniqueLines
          } catch {}
        }),
      )
      if (!cancelled) setStationArrivals(results)
    }
    loadArrivals()
    return () => {
      cancelled = true
    }
  }, [favoriteStops, favoriteLines])

  useEffect(() => {
    if (favoriteLines.length === 0) {
      setLineGlances({})
      return
    }
    let cancelled = false

    async function loadGlances() {
      const results: Record<string, { activeBuses: number }> = {}
      await Promise.all(
        favoriteLines.map(async (line) => {
          try {
            const res = await apiGet<{ value: unknown[] }>(
              `/UlasimBackend/api/Calc/GetLiveData?lineCode=${encodeURIComponent(line.lineCode)}`,
            )
            if (cancelled) return
            results[line.lineCode] = { activeBuses: res?.value?.length || 0 }
          } catch {
            results[line.lineCode] = { activeBuses: 0 }
          }
        }),
      )
      if (!cancelled) setLineGlances(results)
    }

    loadGlances()
    const interval = setInterval(loadGlances, 30000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [favoriteLines])

  return (
    <div className="max-w-2xl mx-auto p-4 pb-24 md:pb-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Favoriler</h1>

      <Tabs defaultValue="stops">
        <TabsList className="w-full mb-6">
          <TabsTrigger value="stops" className="flex-1 gap-2">
            <MapPin className="w-4 h-4" />
            Duraklar ({favoriteStops.length})
          </TabsTrigger>
          <TabsTrigger value="lines" className="flex-1 gap-2">
            <Bus className="w-4 h-4" />
            Hatlar ({favoriteLines.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stops" className="mt-0">
          {favoriteStops.length > 0 ? (
            <div className="space-y-3">
              {favoriteStops.map((fav) => {
                const allArrivals = stationArrivals[fav.stationId] || []
                const visibleArrivals = allArrivals.slice(0, 6)
                const hiddenCount = allArrivals.length - 6

                return (
                  <Card key={fav.stationId} className="overflow-hidden py-0 gap-0">
                    <div className="flex items-center">
                      <Link
                        to={`/duraklar/${fav.stationId}`}
                        className="flex-1 p-4 hover:bg-gray-50 transition-colors min-w-0"
                        onClick={() => {
                          incrementStopClickCount(fav.stationId)
                          trackStopLookup({ stationId: fav.stationId, source: 'favorites' })
                        }}
                      >
                        <div className="flex items-start justify-between">
                          <div className="min-w-0">
                            <h3 className="font-semibold text-gray-900 truncate">
                              {fav.stationName}
                            </h3>
                            <p className="text-sm text-gray-500 mt-1">#{fav.stationId}</p>
                          </div>
                        </div>

                        {allArrivals.length > 0 && (
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3 pt-3 border-t border-gray-100">
                            {visibleArrivals.map((arrival, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                <span
                                  className={cn(
                                    'w-7 h-5 rounded text-[10px] font-bold flex items-center justify-center',
                                    arrival.isPriority
                                      ? 'bg-transit-primary text-white shadow-sm'
                                      : 'bg-transit-primary/10 text-transit-primary',
                                  )}
                                >
                                  {arrival.lineCode}
                                </span>
                                <span className="text-[11px] text-gray-600 flex items-center gap-1 font-medium">
                                  <Clock className="w-2.5 h-2.5" />
                                  {arrival.minutes} dk
                                </span>
                              </div>
                            ))}
                            {hiddenCount > 0 && (
                              <div className="flex items-center gap-1 text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                                +{hiddenCount} hat daha
                              </div>
                            )}
                          </div>
                        )}
                      </Link>
                      <div className="flex items-center gap-1 pr-2 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeStop(fav.stationId)}
                          className="text-gray-400 hover:text-red-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                        <ArrowRight className="w-5 h-5 text-gray-400" />
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          ) : (
            <Card className="p-8 text-center">
              <Star className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">Favori durak yok</p>
              <p className="text-sm text-gray-400 mt-1">
                Durakları favorilere eklemek için durak sayfasındaki yıldız simgesine tıklayın
              </p>
              <Link to="/duraklar">
                <Button variant="outline" className="mt-4">
                  Duraklara Gözat
                </Button>
              </Link>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="lines" className="mt-0">
          {favoriteLines.length > 0 ? (
            <div className="space-y-3">
              {favoriteLines.map((fav) => {
                const cleanedName = cleanLineName(fav.lineName || '', fav.lineCode)
                const glance = lineGlances[fav.lineCode]

                return (
                  <Card key={fav.lineCode} className="overflow-hidden py-0 gap-0">
                    <div className="flex items-center">
                      <Link
                        to={`/hatlar/${encodeURIComponent(fav.lineCode)}`}
                        className="flex-1 p-4 hover:bg-gray-50 transition-colors min-w-0"
                        onClick={() => {
                          incrementLineClickCount(fav.lineCode)
                          trackLineLookup({ lineCode: fav.lineCode, source: 'favorites' })
                        }}
                      >
                        <div className="flex items-center gap-3 min-w-0 mb-1">
                          <span className="px-2 py-0.5 rounded text-white font-bold text-sm shrink-0 bg-transit-primary">
                            {cleanLineCode(fav.lineCode)}
                          </span>
                          <div className="min-w-0">
                            <h3 className="font-semibold text-gray-900 text-sm truncate uppercase">
                              {cleanedName}
                            </h3>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-gray-500 font-medium flex items-center gap-1.5">
                              <Bus
                                className={cn(
                                  'w-3 h-3',
                                  glance?.activeBuses && glance.activeBuses > 0
                                    ? 'text-transit-primary'
                                    : 'text-gray-400',
                                )}
                              />
                              {glance ? (
                                glance.activeBuses > 0 ? (
                                  <span className="text-transit-primary font-bold">
                                    {glance.activeBuses} otobüs aktif
                                  </span>
                                ) : (
                                  'Şu an aktif otobüs yok'
                                )
                              ) : (
                                'Canlı veri yükleniyor...'
                              )}
                            </span>
                          </div>
                        </div>
                      </Link>
                      <div className="flex items-center gap-1 pr-2 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeLine(fav.lineCode)}
                          className="text-gray-400 hover:text-red-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                        <ArrowRight className="w-5 h-5 text-gray-400" />
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          ) : (
            <Card className="p-8 text-center">
              <Star className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">Favori hat yok</p>
              <p className="text-sm text-gray-400 mt-1">
                Hatları favorilere eklemek için hat sayfasındaki yıldız simgesine tıklayın
              </p>
              <Link to="/hatlar">
                <Button variant="outline" className="mt-4">
                  Hatlara Gözat
                </Button>
              </Link>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default function FavoritesPage() {
  useSEO({
    title: 'Favorilerim',
    description: 'Favori otobüs hatlarınız ve duraklarınızın hızlı erişim paneli.',
  })

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <DesktopNav />
      <main className="flex-1 pb-20 md:pb-8">
        <FavoritesContent />
      </main>
      <MobileNav />
    </div>
  )
}
