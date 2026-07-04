import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  apiGet,
  getAllStations,
  getRouteGeometryResult,
  triggerRouteGeometryGeneration,
  type RouteStation,
  type Station,
} from '@ulasim20/data-access-transport-api'
import { fetchDirectKmzRouteGeometry } from '@ulasim20/feature-planner'
import { buildStationIndex, type IndexEntry } from '@ulasim20/util-search'
import {
  trackLineLookup,
  trackRouteMapOpen,
  trackStopLookup,
} from '@ulasim20/util-analytics'

export interface ProcessedStation {
  stationId: number
  stationName: string
  lat: number
  lng: number
}

export interface LiveVehicle {
  plate: string
  latitude: string
  longitude: string
  speed: string
  routeCode: string
  stopId: number
}

interface GetRouteStationsResponse {
  value: {
    lineName?: string
    stations: RouteStation[]
  }
}

interface GetLiveDataResponse {
  value: LiveVehicle[]
}

export interface SelectedLineInfo {
  lineCode: string
  lineName: string
  stations: RouteStation[]
  vehicles: LiveVehicle[]
  geometry: [number, number][] | null
  vehiclesUpdatedAt: number
  geometryError?: string | null
}

export interface RefillPoint {
  lat: number
  lng: number
  name?: string
  id?: number
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

export function useTransitMap(opts: { searchParams?: URLSearchParams } = {}) {
  const [rawStations, setRawStations] = useState<Station[]>([])
  const [processedStations, setProcessedStations] = useState<ProcessedStation[]>([])
  const [selectedStop, setSelectedStop] = useState<ProcessedStation | null>(null)
  const [selectedLine, setSelectedLine] = useState<SelectedLineInfo | null>(null)
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number } | null>(null)
  const [refillPoint, setRefillPoint] = useState<RefillPoint | null>(null)

  const stationIdx: IndexEntry[] = useMemo(() => buildStationIndex(rawStations), [rawStations])

  useEffect(() => {
    let cancelled = false
    getAllStations()
      .then((list) => {
        if (cancelled) return
        const arr = Array.isArray(list) ? list : []
        setRawStations(arr)
        setProcessedStations(processStations(arr))
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const searchParams = opts.searchParams ?? new URLSearchParams()

  useEffect(() => {
    const latParam = searchParams.get('lat')
    const lngParam = searchParams.get('lng')
    const type = searchParams.get('type')
    const nameParam = searchParams.get('name')
    if (latParam != null && lngParam != null) {
      const lat = Number(latParam.replace(',', '.'))
      const lng = Number(lngParam.replace(',', '.'))
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        const nextFly = { lat, lng }
        setFlyTarget((prev) => (prev && prev.lat === lat && prev.lng === lng ? prev : nextFly))
        if (type === 'refill') {
          const idParam = searchParams.get('id')
          const id = idParam != null ? Number(idParam) : undefined
          const nextRefill: RefillPoint = {
            lat,
            lng,
            name: nameParam ? decodeURIComponent(nameParam) : undefined,
            id: Number.isFinite(id) ? id : undefined,
          }
          setRefillPoint((prev) => {
            if (!prev) return nextRefill
            if (prev.lat !== lat || prev.lng !== lng) return nextRefill
            if ((prev.name ?? null) !== (nextRefill.name ?? null)) return nextRefill
            if ((prev.id ?? null) !== (nextRefill.id ?? null)) return nextRefill
            return prev
          })
        } else {
          setRefillPoint((prev) => (prev === null ? prev : null))
        }
      } else {
        setRefillPoint((prev) => (prev === null ? prev : null))
      }
    } else {
      setRefillPoint((prev) => (prev === null ? prev : null))
    }
  }, [searchParams])

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
    if (lineParam) handleSelectLine(lineParam, 'line-detail')
  }, [searchParams, handleSelectLine])

  return {
    rawStations,
    processedStations,
    stationIdx,
    selectedStop,
    setSelectedStop,
    selectedLine,
    setSelectedLine,
    flyTarget,
    setFlyTarget,
    refillPoint,
    setRefillPoint,
    handleSelectLine,
    trackStopLookup,
  }
}
