import { type BusRoute, type Station, getAllRoutes, getAllStations } from '@/api/denizli'
import { DesktopNav, MobileNav } from '@/components/navigation'
import { Card } from '@ulasim20/ui-primitives'
import { Input } from '@ulasim20/ui-primitives'
import { useSEO } from '@/hooks/use-seo'
import { trackAnalyticsEvent, trackLineLookup, trackStopLookup } from '@ulasim20/util-analytics'
import {
  buildRouteIndexes,
  buildStationIndex,
  searchBusRoutes,
  searchStations,
} from '@/utils/search'
import { cleanLineCode, cleanLineName } from '@/utils/text'
import { ArrowRight, Bus, MapPin, Navigation, Search, Star } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

const navItems = [
  { href: '/hatlar', label: 'Hatlar', description: 'Otobüs hatları', icon: Bus },
  { href: '/duraklar', label: 'Duraklar', description: 'Tüm duraklar', icon: MapPin },
  {
    href: '/nasil-giderim',
    label: 'Nasıl Giderim',
    description: 'Yol tarifi ve rota planlama',
    icon: Navigation,
  },
  { href: '/favoriler', label: 'Favoriler', description: 'Kayıtlı durak ve hatlar', icon: Star },
]

function HomeContent() {
  const [stations, setStations] = useState<Station[]>([])
  const [routes, setRoutes] = useState<BusRoute[]>([])
  const [search, setSearch] = useState('')
  const [showResults, setShowResults] = useState(false)

  useEffect(() => {
    getAllStations()
      .then((list) => {
        if (Array.isArray(list)) setStations(list)
      })
      .catch(() => {})
    getAllRoutes()
      .then((list) => {
        if (Array.isArray(list)) setRoutes(list)
      })
      .catch(() => {})
  }, [])

  const stationIndex = useMemo(() => buildStationIndex(stations), [stations])
  const { codeIndex, nameIndex } = useMemo(() => buildRouteIndexes(routes), [routes])

  const routeResults = useMemo(() => {
    if (search.length < 1) return []
    return searchBusRoutes(routes, search, codeIndex, nameIndex)
      .filter((r) => r.score > 0)
      .slice(0, 4)
      .map((r) => r.item)
  }, [routes, search, codeIndex, nameIndex])

  const stationResults = useMemo(() => {
    const trimmed = search.trim()
    if (!trimmed) return []
    const isNumeric = /^\d/.test(trimmed)
    if (trimmed.length < (isNumeric ? 1 : 2)) return []
    return searchStations(stations, search, stationIndex)
      .filter((r) => r.score > 0)
      .slice(0, 8)
      .map((r) => r.item)
  }, [stations, search, stationIndex])

  const hasResults = routeResults.length > 0 || stationResults.length > 0

  return (
    <div className="max-w-2xl mx-auto p-4 pb-20 md:pb-8">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Denizli Ulaşım</h1>
        <p className="text-gray-500 mt-1">Toplu taşıma bilgilerine hızlı erişim</p>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setShowResults(true)
          }}
          onFocus={() => setShowResults(true)}
          placeholder="Hat veya durak ara..."
          className="pl-10 h-12 text-base"
        />

        {showResults && hasResults && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowResults(false)} />
            <Card className="absolute top-full left-0 right-0 mt-2 z-20 overflow-hidden py-0 max-h-[70vh] overflow-y-auto">
              {routeResults.length > 0 && (
                <div>
                  <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                    <span className="text-xs font-semibold text-gray-500 uppercase">Hatlar</span>
                  </div>
                  {routeResults.map((route) => (
                    <Link
                      key={route.lineCode}
                      to={`/hatlar/${encodeURIComponent(route.lineCode)}`}
                      className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-0"
                      onClick={() => {
                        trackAnalyticsEvent('search_select', {
                          source: 'home',
                          result_type: 'line',
                          line_code: route.lineCode,
                        })
                        trackLineLookup({ lineCode: route.lineCode, source: 'home_search' })
                        setShowResults(false)
                      }}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="px-2 py-0.5 rounded text-white font-bold text-sm shrink-0 bg-transit-primary">
                          {cleanLineCode(route.lineCode)}
                        </span>
                        <p className="font-medium text-gray-900 text-sm truncate">
                          {cleanLineName(route.lineName, route.lineCode)}
                        </p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-gray-400 shrink-0" />
                    </Link>
                  ))}
                </div>
              )}
              {stationResults.length > 0 && (
                <div>
                  <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                    <span className="text-xs font-semibold text-gray-500 uppercase">Duraklar</span>
                  </div>
                  {stationResults.map((station) => (
                    <Link
                      key={station.stationId}
                      to={`/duraklar/${station.stationId}`}
                      className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-0"
                      onClick={() => {
                        trackAnalyticsEvent('search_select', {
                          source: 'home',
                          result_type: 'station',
                          station_id: station.stationId,
                        })
                        trackStopLookup({ stationId: station.stationId, source: 'home_search' })
                        setShowResults(false)
                      }}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <MapPin className="w-4 h-4 text-transit-primary shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 text-sm truncate">
                            {station.stationName}
                          </p>
                          <p className="text-xs text-gray-500">#{station.stationId}</p>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-gray-400 shrink-0" />
                    </Link>
                  ))}
                </div>
              )}
            </Card>
          </>
        )}

        {showResults &&
          search.trim().length === 1 &&
          !/^\d/.test(search.trim()) &&
          stationResults.length === 0 &&
          routeResults.length === 0 && (
            <p className="text-xs text-gray-400 mt-1.5 ml-1">
              Durak araması için en az 2 karakter girin
            </p>
          )}
      </div>

      <div className="space-y-1.5">
        {navItems.map((item) => (
          <Card key={item.href} className="overflow-hidden py-0">
            <Link
              to={item.href}
              className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <item.icon className="w-4 h-4 text-transit-primary shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 text-sm truncate">{item.label}</p>
                  <p className="text-xs text-gray-500">{item.description}</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-400 shrink-0" />
            </Link>
          </Card>
        ))}
      </div>
    </div>
  )
}

export default function HomePage() {
  useSEO({
    title: 'Ana Sayfa',
    description:
      "Denizli'nin akıllı ulaşım portalı. Kart bakiye sorgulama, otobüs saatleri, durak varış saatleri, hatlar ve canlı harita.",
  })

  return (
    <div className="min-h-[calc(100dvh-28px)] flex flex-col bg-gray-50">
      <DesktopNav />
      <main className="flex-1">
        <HomeContent />
      </main>
      <MobileNav />
    </div>
  )
}
