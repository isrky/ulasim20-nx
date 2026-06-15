import { type BusRoute, getAllRoutes } from '@/api/denizli'
import { DesktopNav, MobileNav } from '@/components/navigation'
import { Button } from '@ulasim20/ui-primitives'
import { Card } from '@ulasim20/ui-primitives'
import { Input } from '@ulasim20/ui-primitives'
import { Skeleton } from '@ulasim20/ui-primitives'
import { useFavoriteLines } from '@/hooks/use-favorite-lines'
import { useSEO } from '@/hooks/use-seo'
import { trackAnalyticsEvent, trackLineLookup } from '@ulasim20/util-analytics'
import { cn } from '@/lib/utils'
import { buildRouteIndexes, searchBusRoutes } from '@/utils/search'
import { cleanLineCode, cleanLineName } from '@/utils/text'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ArrowRight, Bus, Search, Star } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

function LinesContent() {
  const { isFavorite, toggleFavorite } = useFavoriteLines()
  const [routes, setRoutes] = useState<BusRoute[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [showAll, setShowAll] = useState(false)
  const parentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    getAllRoutes()
      .then((list) => {
        if (!cancelled) {
          setRoutes(Array.isArray(list) ? list : [])
          setLoading(false)
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Hata')
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const { codeIndex, nameIndex } = useMemo(() => buildRouteIndexes(routes), [routes])

  const filteredLines = useMemo(() => {
    if (!search.trim()) return []
    return searchBusRoutes(routes, search, codeIndex, nameIndex)
      .filter((r) => r.score > 0)
      .map((r) => r.item)
  }, [routes, search, codeIndex, nameIndex])

  const linesToShow = search ? filteredLines : showAll ? routes : []

  const virtualizer = useVirtualizer({
    count: linesToShow.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48,
    overscan: 10,
  })

  return (
    <div className="max-w-2xl mx-auto p-4 flex flex-col h-[calc(100vh-64px)] md:h-screen">
      <h1 className="text-2xl font-bold text-gray-900 mb-6 shrink-0">Hatlar</h1>

      <div className="relative mb-4 shrink-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Hat ara (kod veya isim)"
          className="pl-10 h-12 bg-white"
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="p-3">
              <Skeleton className="h-5 w-1/4 mb-1" />
              <Skeleton className="h-4 w-2/3" />
            </Card>
          ))}
        </div>
      ) : error ? (
        <Card className="p-8 text-center">
          <Bus className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">{error}</p>
        </Card>
      ) : (
        <>
          {!search && (
            <Button
              variant="outline"
              onClick={() => setShowAll(!showAll)}
              className={cn(
                'w-full mb-4 h-11 transition-colors shrink-0',
                showAll
                  ? 'border-transit-primary text-transit-primary hover:bg-transit-primary hover:text-white'
                  : 'bg-transit-primary text-white border-transit-primary hover:bg-transit-primary/90',
              )}
            >
              {showAll ? 'Hatları Gizle' : `Tüm Hatları Göster (${routes.length})`}
            </Button>
          )}

          <div ref={parentRef} className="flex-1 overflow-y-auto min-h-0">
            <div
              style={{
                height: `${virtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {linesToShow.length > 0 ? (
                virtualizer.getVirtualItems().map((virtualItem) => {
                  const route = linesToShow[virtualItem.index]
                  const fav = isFavorite(route.lineCode)
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
                      <Card className="overflow-hidden py-0 h-full">
                        <Link
                          to={`/hatlar/${encodeURIComponent(route.lineCode)}`}
                          className="flex items-center justify-between px-3 h-full hover:bg-gray-50 transition-colors"
                          onClick={() => {
                            const source = search ? 'lines_search' : 'lines_list'
                            trackAnalyticsEvent('search_select', {
                              source,
                              result_type: 'line',
                              line_code: route.lineCode,
                            })
                            trackLineLookup({ lineCode: route.lineCode, source })
                          }}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="px-2 py-0.5 rounded text-white font-bold text-sm shrink-0 bg-transit-primary">
                              {cleanLineCode(route.lineCode)}
                            </span>
                            <div className="min-w-0">
                              <p className="font-medium text-gray-900 text-sm truncate">
                                {cleanLineName(route.lineName, route.lineCode)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.preventDefault()
                                toggleFavorite(route.lineCode, route.lineName)
                              }}
                              className={cn(
                                'h-7 w-7',
                                fav && 'text-yellow-500 hover:text-yellow-600',
                              )}
                            >
                              <Star className={cn('w-4 h-4', fav && 'fill-current')} />
                            </Button>
                            <ArrowRight className="w-4 h-4 text-gray-400" />
                          </div>
                        </Link>
                      </Card>
                    </div>
                  )
                })
              ) : search ? (
                <Card className="p-8 text-center">
                  <Bus className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">Hat bulunamadı</p>
                </Card>
              ) : null}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default function LinesPage() {
  useSEO({
    title: 'Otobüs Hatları ve Saatleri',
    description: 'Denizli otobüs hatları güzergah, tarife ve çalışma saatleri detayları.',
  })

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <DesktopNav />
      <main className="flex-1 pb-20 md:pb-8">
        <LinesContent />
      </main>
      <MobileNav />
    </div>
  )
}
