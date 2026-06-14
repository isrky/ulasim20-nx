import {
  type Journey,
  type Leg,
  type PlannerInstallState,
  RouteApiRequestError,
  type RouteApiStation,
  type RouteLocation,
  type RouteResponse,
  type TransferAlternative,
  downloadPlannerDataset,
  findRoute,
  formatMinutes,
  formatSeconds,
  getAllRouteApiStations,
  getCurrentLocationOption,
  getPlannerStatus,
  matchStation,
  routeLocationFromStation,
} from '@/api/route-api'
import { DesktopNav, MobileNav } from '@/components/navigation'
import { Button } from '@ulasim20/ui-primitives'
import { Card } from '@ulasim20/ui-primitives'
import { Input } from '@ulasim20/ui-primitives'
import { Progress } from '@ulasim20/ui-primitives'
import { Skeleton } from '@ulasim20/ui-primitives'
import { useSEO } from '@/hooks/use-seo'
import { trackAnalyticsEvent, trackStopLookup } from '@/lib/analytics'
import { TransitProvider } from '@/lib/transit-context'
import { type POIResult, searchPOI } from '@/utils/geocoding'
import {
  AlertTriangle,
  ArrowDownUp,
  Bus,
  ChevronDown,
  ChevronUp,
  Download,
  Footprints,
  Info,
  LocateFixed,
  MapPin,
  MapPinned,
  Navigation,
  RefreshCw,
  Route,
  Search,
  Timer,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type PickerOption =
  | ({ kind: 'station' } & RouteLocation)
  | ({ kind: 'poi' } & RouteLocation)
  | ({ kind: 'current' } & RouteLocation)

function LocationPicker({
  label,
  value,
  onSelect,
  stations,
  icon,
  allowCurrentLocation = false,
  analyticsSource,
}: {
  label: string
  value: RouteLocation | null
  onSelect: (value: RouteLocation | null) => void
  stations: RouteApiStation[]
  icon: React.ReactNode
  allowCurrentLocation?: boolean
  analyticsSource: string
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [poiResults, setPoiResults] = useState<POIResult[]>([])
  const [poiLoading, setPoiLoading] = useState(false)
  const [locationLoading, setLocationLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    if (!open) return
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setPoiResults([])
      setPoiLoading(false)
      return
    }

    const controller = new AbortController()
    const timeout = window.setTimeout(async () => {
      try {
        setPoiLoading(true)
        const results = await searchPOI(trimmed, controller.signal)
        setPoiResults(results)
      } catch {
        setPoiResults([])
      } finally {
        setPoiLoading(false)
      }
    }, 250)

    return () => {
      controller.abort()
      window.clearTimeout(timeout)
    }
  }, [query, open])

  const stationOptions = useMemo(() => {
    const trimmed = query.trim()
    const filtered = !trimmed
      ? stations.slice(0, 12)
      : stations.filter((station) => matchStation(trimmed, station.stationName)).slice(0, 12)

    return filtered.map((station) => ({
      ...routeLocationFromStation(station),
      kind: 'station' as const,
    }))
  }, [query, stations])

  const poiOptions = useMemo(
    () =>
      poiResults.map((poi) => ({
        id: `poi:${poi.id}`,
        kind: 'poi' as const,
        label: poi.name,
        secondaryLabel: [poi.displayName, poi.category].filter(Boolean).join(' · '),
        lat: poi.lat,
        lng: poi.lng,
      })),
    [poiResults],
  )

  const displayValue = open ? query : (value?.label ?? '')

  const handleCurrentLocation = useCallback(async () => {
    try {
      setLocationLoading(true)
      const current = await getCurrentLocationOption()
      onSelect(current)
      setOpen(false)
      setQuery('')
    } finally {
      setLocationLoading(false)
    }
  }, [onSelect])

  const handleSelect = useCallback(
    (nextValue: PickerOption) => {
      if (nextValue.kind === 'station' && nextValue.stationId != null) {
        trackStopLookup({ stationId: nextValue.stationId, source: analyticsSource })
      }
      onSelect(nextValue)
      setOpen(false)
      setQuery('')
    },
    [analyticsSource, onSelect],
  )

  return (
    <div ref={ref} className="relative">
      <label className="text-xs font-medium text-gray-500 mb-1 block">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">{icon}</span>
        <Input
          value={displayValue}
          onChange={(event) => {
            setQuery(event.target.value)
            if (!open) setOpen(true)
            if (value) onSelect(null)
          }}
          onFocus={() => {
            setOpen(true)
            setQuery('')
          }}
          placeholder="Durak veya adres yazın..."
          className="pl-10 h-11 bg-white"
        />
      </div>

      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white rounded-lg border border-gray-200 shadow-lg max-h-72 overflow-y-auto">
          {allowCurrentLocation && (
            <button
              type="button"
              className="w-full text-left px-3 py-2.5 border-b border-gray-100 hover:bg-transit-primary/5 transition-colors flex items-center gap-2"
              onClick={handleCurrentLocation}
              disabled={locationLoading}
            >
              <LocateFixed className="w-4 h-4 text-transit-primary shrink-0" />
              <span className="text-sm font-medium text-gray-700">
                {locationLoading ? 'Konum alınıyor...' : 'Konumumu kullan'}
              </span>
            </button>
          )}

          {stationOptions.length > 0 && (
            <div className="px-3 pt-2">
              <p className="text-[11px] uppercase tracking-wide text-gray-400 mb-1">Duraklar</p>
              <div className="space-y-1 pb-2">
                {stationOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className="w-full text-left px-2 py-2 rounded-md hover:bg-transit-primary/5 transition-colors"
                    onClick={() => handleSelect(option)}
                  >
                    <div className="flex items-start gap-2">
                      <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-gray-700 truncate">{option.label}</p>
                        <p className="text-xs text-gray-400 truncate">
                          {option.routes?.slice(0, 4).join(', ')}
                          {(option.routes?.length ?? 0) > 4 ? '…' : ''}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {(poiLoading || poiOptions.length > 0) && (
            <div className="px-3 pt-1 pb-2 border-t border-gray-100">
              <p className="text-[11px] uppercase tracking-wide text-gray-400 mb-1">Adresler</p>
              {poiLoading ? (
                <div className="px-2 py-2 text-sm text-gray-400">Adres aranıyor...</div>
              ) : (
                <div className="space-y-1">
                  {poiOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className="w-full text-left px-2 py-2 rounded-md hover:bg-transit-primary/5 transition-colors"
                      onClick={() => handleSelect(option)}
                    >
                      <div className="flex items-start gap-2">
                        <MapPinned className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-gray-700 truncate">{option.label}</p>
                          <p className="text-xs text-gray-400 truncate">{option.secondaryLabel}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {!poiLoading && stationOptions.length === 0 && poiOptions.length === 0 && (
            <div className="px-3 py-4 text-sm text-gray-400 text-center">Sonuç bulunamadı</div>
          )}
        </div>
      )}
    </div>
  )
}

function LegItem({ leg }: { leg: Leg }) {
  if (leg.type === 'walk') {
    return (
      <div className="flex items-start gap-3 py-2">
        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
          <Footprints className="w-4 h-4 text-gray-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-sm text-gray-700">
            <span className="font-medium">Yürü</span>
            <span className="text-gray-400">·</span>
            <span>{leg.distanceMeters || '?'} m</span>
            <span className="text-gray-400">·</span>
            <span>{formatSeconds(leg.durationSeconds)}</span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5 truncate">
            {leg.from.stationName} → {leg.to.stationName}
          </p>
        </div>
        <span className="text-xs text-gray-400 shrink-0 mt-1">{leg.departureTime}</span>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-3 py-2">
      <div className="w-8 h-8 rounded-full bg-transit-primary/10 flex items-center justify-center shrink-0 mt-0.5">
        <Bus className="w-4 h-4 text-transit-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="px-2 py-0.5 rounded bg-transit-primary text-white text-xs font-bold">
            {leg.lineCode}
          </span>
          <span className="text-sm text-gray-700 font-medium truncate">
            {leg.stopCount || '?'} durak · {formatSeconds(leg.durationSeconds)}
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-0.5 truncate">
          {leg.from.stationName} → {leg.to.stationName}
        </p>
      </div>
      <span className="text-xs text-gray-400 shrink-0 mt-1">
        {leg.departureTime} – {leg.arrivalTime}
      </span>
    </div>
  )
}

function TransferAlternatives({ alternatives }: { alternatives: TransferAlternative[] }) {
  const [open, setOpen] = useState(false)
  if (!alternatives || alternatives.length === 0) return null

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-1 text-xs text-transit-primary hover:text-transit-primary/80 transition-colors"
      >
        <ArrowDownUp className="w-3 h-3" />
        Aktarma alternatifleri
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {open && (
        <div className="mt-2 pl-3 border-l-2 border-transit-primary/20 space-y-2">
          {alternatives.map((alternative, index) => (
            <div key={index}>
              <p className="text-xs font-medium text-gray-700">
                <span className="font-semibold">{alternative.transferStopName}</span>'de{' '}
                <span className="text-gray-500">{alternative.originalLine}</span> yerine:
              </p>
              <ul className="mt-1 space-y-0.5">
                {alternative.alternatives.map((option, optionIndex) => (
                  <li key={optionIndex} className="text-xs text-gray-600">
                    <span className="font-semibold text-transit-primary">
                      {option.lineCodes.join(', ')}
                    </span>{' '}
                    ile bin,
                    <span className="font-medium"> {option.alightAt}</span>'da in
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function JourneyCard({ journey, index }: { journey: Journey; index: number }) {
  const [expanded, setExpanded] = useState(index === 0)

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded((value) => !value)}
      >
        <div className="w-8 h-8 rounded-full bg-transit-primary/10 flex items-center justify-center shrink-0">
          <Route className="w-4 h-4 text-transit-primary" />
        </div>
        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900 text-sm">
              {journey.departureTime} → {journey.arrivalTime}
            </span>
            <span className="text-xs text-gray-500">
              ({formatMinutes(journey.totalDurationSeconds)})
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
            <span className="flex items-center gap-0.5">
              <ArrowDownUp className="w-3 h-3" />
              {journey.transferCount} aktarma
            </span>
            <span className="flex items-center gap-0.5">
              <Footprints className="w-3 h-3" />
              {journey.totalWalkingMeters} m
            </span>
            <span className="flex items-center gap-1">
              {journey.legs
                .filter((leg) => leg.type === 'bus')
                .map((leg, legIndex) => (
                  <span
                    key={legIndex}
                    className="px-1.5 py-0.5 rounded bg-transit-primary/10 text-transit-primary text-[10px] font-bold"
                  >
                    {leg.lineCode}
                  </span>
                ))}
            </span>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-3 border-t border-gray-100">
          <div className="divide-y divide-gray-50">
            {journey.legs.map((leg, legIndex) => (
              <LegItem key={legIndex} leg={leg} />
            ))}
          </div>
          <TransferAlternatives alternatives={journey.transferAlternatives} />
        </div>
      )}
    </Card>
  )
}

function PlannerInstallCard({
  plannerStatus,
  onInstall,
}: {
  plannerStatus: PlannerInstallState | null
  onInstall: () => Promise<void>
}) {
  const downloading = plannerStatus?.loading ?? false

  return (
    <Card className="p-4 mb-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-transit-primary/10 flex items-center justify-center shrink-0">
          <Download className="w-5 h-5 text-transit-primary" />
        </div>
        <div className="flex-1">
          <h2 className="text-base font-semibold text-gray-900">Çevrimdışı rota verisini indir</h2>
          <p className="text-sm text-gray-500 mt-1">
            Rotaları internet olmadan hesaplamak için cihazınıza yerel ulaşım veri seti kurulmalı.
          </p>
          {plannerStatus?.progress ? (
            <div className="mt-3 space-y-1">
              <Progress value={plannerStatus.progress} />
              <p className="text-xs text-gray-400">{plannerStatus.progress}% indirildi</p>
            </div>
          ) : null}
          <Button
            className="mt-4 h-11 bg-transit-primary hover:bg-transit-primary/90 text-white"
            onClick={onInstall}
            disabled={downloading}
          >
            {downloading ? (
              <span className="flex items-center gap-2">
                <Timer className="w-4 h-4 animate-spin" />
                İndiriliyor...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Download className="w-4 h-4" />
                Veri setini indir
              </span>
            )}
          </Button>
        </div>
      </div>
    </Card>
  )
}

function RoutePlannerContent() {
  const [stations, setStations] = useState<RouteApiStation[]>([])
  const [stationsLoading, setStationsLoading] = useState(true)
  const [plannerStatus, setPlannerStatus] = useState<PlannerInstallState | null>(null)

  const [origin, setOrigin] = useState<RouteLocation | null>(null)
  const [destination, setDestination] = useState<RouteLocation | null>(null)
  const [maxTransfers, setMaxTransfers] = useState(2)
  const [maxWalk, setMaxWalk] = useState(1500)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const [result, setResult] = useState<RouteResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadStations = useCallback(async () => {
    try {
      setStationsLoading(true)
      const nextStations = await getAllRouteApiStations()
      setStations(nextStations)
    } finally {
      setStationsLoading(false)
    }
  }, [])

  const handleInstall = useCallback(async () => {
    setError(null)
    setPlannerStatus((prev) => (prev ? { ...prev, loading: true, progress: 0 } : prev))

    try {
      const status = await downloadPlannerDataset((progress) => {
        setPlannerStatus((prev) => (prev ? { ...prev, loading: true, progress } : prev))
      })
      setPlannerStatus(status)
      await loadStations()
      trackAnalyticsEvent('planner_dataset_download', {
        success: true,
        stop_count: status.stopCount,
        route_count: status.routeCount,
        schema_version: status.schemaVersion ?? undefined,
      })
    } catch (installError) {
      setError(installError instanceof Error ? installError.message : 'Veri seti indirilemedi.')
      setPlannerStatus((prev) => (prev ? { ...prev, loading: false } : prev))
      trackAnalyticsEvent('planner_dataset_download', { success: false })
    }
  }, [loadStations])

  useEffect(() => {
    let cancelled = false

    getPlannerStatus()
      .then((status) => {
        if (cancelled) return
        setPlannerStatus(status)
        if (status.installed) {
          loadStations().catch(() => {
            if (!cancelled) setStationsLoading(false)
          })
          if (status.updateAvailable) {
            handleInstall().catch(() => {})
          }
        } else {
          setStationsLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStationsLoading(false)
          setPlannerStatus({
            installed: false,
            loading: false,
            progress: 0,
            stopCount: 0,
            routeCount: 0,
            generatedAt: null,
            schemaVersion: null,
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [handleInstall, loadStations])

  const handleSwap = useCallback(() => {
    setOrigin(destination)
    setDestination(origin)
    setResult(null)
    setError(null)
  }, [destination, origin])

  const handleSearch = useCallback(async () => {
    if (!origin || !destination) {
      setError('Lütfen başlangıç ve varış noktalarını seçin.')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await findRoute(
        {
          origin: { lat: origin.lat, lng: origin.lng },
          destination: { lat: destination.lat, lng: destination.lng },
          maxTransfers,
          maxWalkingDistance: maxWalk,
        },
        origin,
        destination,
      )
      setResult(response)
      trackAnalyticsEvent('route_search', {
        success: true,
        origin_type: origin.id.startsWith('poi:')
          ? 'poi'
          : origin.id === 'current-location'
            ? 'current'
            : 'station',
        destination_type: destination.id.startsWith('poi:')
          ? 'poi'
          : destination.id === 'current-location'
            ? 'current'
            : 'station',
        max_transfers: maxTransfers,
        max_walk: maxWalk,
        result_count: response.journeys.length,
      })
    } catch (searchError) {
      if (searchError instanceof RouteApiRequestError) {
        setError(searchError.userMessage)
      } else {
        setError('Rota hesaplanamadı. Lütfen tekrar deneyin.')
      }
      trackAnalyticsEvent('route_search', {
        success: false,
        origin_type: origin.id.startsWith('poi:')
          ? 'poi'
          : origin.id === 'current-location'
            ? 'current'
            : 'station',
        destination_type: destination.id.startsWith('poi:')
          ? 'poi'
          : destination.id === 'current-location'
            ? 'current'
            : 'station',
        max_transfers: maxTransfers,
        max_walk: maxWalk,
      })
    } finally {
      setLoading(false)
    }
  }, [destination, maxTransfers, maxWalk, origin])

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Nasıl Giderim?</h1>

      {!plannerStatus?.installed && (
        <PlannerInstallCard plannerStatus={plannerStatus} onInstall={handleInstall} />
      )}

      {plannerStatus?.installed && (
        <div className="flex items-center gap-2 px-3 py-2 mb-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
          <MapPinned className="w-4 h-4 shrink-0" />
          <span>
            Çevrimdışı veri hazır. {plannerStatus.stopCount} durak ve {plannerStatus.routeCount} hat
            kullanılabilir.
          </span>
        </div>
      )}

      <Card className="p-4 mb-4">
        {stationsLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-10 w-32" />
          </div>
        ) : (
          <div className="space-y-3">
            <LocationPicker
              label="Nereden"
              value={origin}
              onSelect={setOrigin}
              stations={stations}
              icon={<Navigation className="w-4 h-4" />}
              allowCurrentLocation
              analyticsSource="route_planner_origin"
            />

            <div className="flex justify-center -my-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-full border border-gray-200 bg-white hover:bg-gray-50"
                onClick={handleSwap}
              >
                <ArrowDownUp className="w-3.5 h-3.5 text-gray-500" />
              </Button>
            </div>

            <LocationPicker
              label="Nereye"
              value={destination}
              onSelect={setDestination}
              stations={stations}
              icon={<MapPin className="w-4 h-4" />}
              analyticsSource="route_planner_destination"
            />

            <div>
              <button
                type="button"
                onClick={() => setShowAdvanced((value) => !value)}
                className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-transit-primary transition-colors py-2"
              >
                Gelişmiş Seçenekler
                {showAdvanced ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>

              {showAdvanced && (
                <div className="flex items-center gap-3 pb-2 pt-1 border-t border-gray-100">
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 mb-1 block">Max Aktarma</label>
                    <select
                      value={maxTransfers}
                      onChange={(event) => setMaxTransfers(Number(event.target.value))}
                      className="w-full h-9 px-2 rounded-md border border-gray-200 text-sm bg-white"
                    >
                      {[0, 1, 2, 3, 4].map((count) => (
                        <option key={count} value={count}>
                          {count}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 mb-1 block">Max Yürüme</label>
                    <select
                      value={maxWalk}
                      onChange={(event) => setMaxWalk(Number(event.target.value))}
                      className="w-full h-9 px-2 rounded-md border border-gray-200 text-sm bg-white"
                    >
                      {[300, 500, 750, 1000, 1500, 2000].map((meters) => (
                        <option key={meters} value={meters}>
                          {meters} m
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            <Button
              className="w-full h-11 mt-1 bg-transit-primary hover:bg-transit-primary/90 text-white font-medium"
              onClick={handleSearch}
              disabled={loading || !origin || !destination || !plannerStatus?.installed}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Timer className="w-4 h-4 animate-spin" />
                  Hesaplanıyor...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Search className="w-4 h-4" />
                  Rota Bul
                </span>
              )}
            </Button>

            {plannerStatus?.installed && (
              <button
                type="button"
                onClick={handleInstall}
                className="text-xs text-gray-400 hover:text-transit-primary transition-colors inline-flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                Veri setini yeniden indir
              </button>
            )}
          </div>
        )}
      </Card>

      {error && (
        <div className="flex items-start gap-2 px-3 py-3 mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          {[1, 2].map((item) => (
            <Card key={item} className="p-4">
              <Skeleton className="h-5 w-3/4 mb-2" />
              <Skeleton className="h-4 w-1/2 mb-3" />
              <Skeleton className="h-12 w-full" />
            </Card>
          ))}
        </div>
      )}

      {result && !loading && (
        <div>
          {result.journeys.length === 0 ? (
            <Card className="p-8 text-center">
              <Navigation className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">Rota bulunamadı</p>
              <p className="text-sm text-gray-400 mt-1">
                Farklı bir başlangıç noktası veya daha yüksek yürüme mesafesi deneyin.
              </p>
            </Card>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-gray-500">
                  {result.journeys.length} alternatif rota bulundu
                </p>
                <div className="flex items-center gap-1 text-xs text-transit-primary/60">
                  <Info className="w-3 h-3" />
                  <span>İlkini genişletmek için tıklayın</span>
                </div>
              </div>
              <div className="space-y-3">
                {result.journeys.map((journey, index) => (
                  <JourneyCard key={index} journey={journey} index={index} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function RoutePlannerPage() {
  useSEO({
    title: 'Yol Tarifi ve Akıllı Planlayıcı',
    description:
      'Denizli ulaşım planlayıcısı ile iki nokta arasında en hızlı toplu taşıma yol tarifini alın.',
  })

  return (
    <TransitProvider>
      <div className="min-h-screen flex flex-col bg-gray-50">
        <DesktopNav />
        <main className="flex-1 pb-20 md:pb-8">
          <RoutePlannerContent />
        </main>
        <MobileNav />
      </div>
    </TransitProvider>
  )
}
