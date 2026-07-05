import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Locate, X } from 'lucide-react'
import { Button } from '@ulasim20/ui-primitives'
import { MapView, useMapInstance } from '@ulasim20/ui-map'
import { useTransitMap, type ProcessedStation } from './use-transit-map'
import { Overlays } from './overlays'
import { RefillMarker, SearchHighlightMarker, UserLocationMarker } from './markers'
import { LinePanel, RefillPanel, SearchBar, StopPanel } from './panels'
import { DENIZLI_CENTER, SEARCH_HIGHLIGHT_ZOOM } from './constants'

function FlyToHandler({ target }: { target: { lat: number; lng: number } | null }) {
  const map = useMapInstance()
  useEffect(() => {
    if (!map || !target) return
    map.flyTo({ center: [target.lng, target.lat], zoom: SEARCH_HIGHLIGHT_ZOOM, essential: true })
  }, [map, target])
  return null
}

function FlyToUserPos({ position }: { position: { lng: number; lat: number } | null }) {
  const map = useMapInstance()
  useEffect(() => {
    if (!map || !position) return
    map.flyTo({ center: [position.lng, position.lat], zoom: 16, essential: true })
  }, [map, position])
  return null
}

function FlyToCenter() {
  const map = useMapInstance()
  useEffect(() => {
    if (!map) return
    map.flyTo({ center: [DENIZLI_CENTER.lng, DENIZLI_CENTER.lat], zoom: 14, essential: true })
  }, [map])
  return null
}

function LocateButton({ onClick }: { onClick: () => void }) {
  return (
    <Button size="icon" variant="secondary" className="absolute bottom-24 right-4 z-[1000] shadow-lg bg-white hover:bg-gray-50" onClick={onClick}>
      <Locate className="w-5 h-5 text-gray-700" />
    </Button>
  )
}

export default function TransitMap() {
  const [searchParams] = useSearchParams()
  const [mounted, setMounted] = useState(false)
  const [refillPanelOpen, setRefillPanelOpen] = useState(false)
  const [searchSelected, setSearchSelected] = useState<ProcessedStation | null>(null)
  const [userPos, setUserPos] = useState<{ lng: number; lat: number } | null>(null)

  useEffect(() => { setMounted(true) }, [])

  const tx = useTransitMap({ searchParams })

  const stopsFC = useMemo<GeoJSON.FeatureCollection<GeoJSON.Point, { stationId: number; stationName: string }>>(() => ({
    type: 'FeatureCollection',
    features: tx.processedStations.map((s) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
      properties: { stationId: s.stationId, stationName: s.stationName },
    })),
  }), [tx.processedStations])

  const vehiclesFC = useMemo<GeoJSON.FeatureCollection<GeoJSON.Point, { plate: string; routeCode: string }>>(() => {
    const list = tx.selectedLine?.vehicles ?? []
    return {
      type: 'FeatureCollection',
      features: list.flatMap((v) => {
        const lat = Number(v.latitude.replace(',', '.'))
        const lng = Number(v.longitude.replace(',', '.'))
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return []
        return [{ type: 'Feature', geometry: { type: 'Point', coordinates: [lng, lat] }, properties: { plate: v.plate, routeCode: v.routeCode } }]
      }),
    }
  }, [tx.selectedLine?.vehicles])

  const routeFC = useMemo<GeoJSON.Feature<GeoJSON.LineString, Record<string, never>> | null>(() => {
    const g = tx.selectedLine?.geometry
    if (!g || g.length === 0) return null
    return { type: 'Feature', geometry: { type: 'LineString', coordinates: g }, properties: {} as Record<string, never> }
  }, [tx.selectedLine?.geometry])

  if (!mounted) {
    return <div className="w-full h-full bg-gray-100 flex items-center justify-center"><div className="text-gray-500">Harita yükleniyor...</div></div>
  }

  const handleLocateClick = () => {
    if (!('geolocation' in navigator)) {
      setUserPos(null)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (p) => setUserPos({ lng: p.coords.longitude, lat: p.coords.latitude }),
      () => setUserPos(null),
    )
  }

  return (
    <div className="relative w-full h-full">
      <SearchBar
        stations={tx.rawStations}
        stationIndex={tx.stationIdx}
        onSelectStop={(stop) => {
          tx.setSelectedStop(stop)
          tx.setSelectedLine(null)
          setSearchSelected(stop)
          setRefillPanelOpen(false)
        }}
      />

      <MapView center={[DENIZLI_CENTER.lng, DENIZLI_CENTER.lat]} zoom={14}>
        <FlyToHandler target={tx.flyTarget} />
        <FlyToUserPos position={userPos} />
        {userPos === null && <FlyToCenter />}
        <Overlays stops={stopsFC} routeGeometry={routeFC} vehicles={vehiclesFC} />

        {tx.refillPoint && (
          <RefillMarker
            point={tx.refillPoint}
            onClick={() => {
              tx.setSelectedStop(null)
              tx.setSelectedLine(null)
              setRefillPanelOpen(true)
            }}
          />
        )}
        {searchSelected && !tx.selectedLine && (
          <SearchHighlightMarker stop={searchSelected} />
        )}
        <UserLocationMarker position={userPos} />
      </MapView>

      <LocateButton onClick={handleLocateClick} />

      {tx.selectedStop && !tx.selectedLine && !searchSelected && (
        <StopPanel
          stop={tx.selectedStop}
          onClose={() => tx.setSelectedStop(null)}
          onSelectLine={(lc) => tx.handleSelectLine(lc, 'map_stop_panel')}
        />
      )}

      {refillPanelOpen && tx.refillPoint && (
        <RefillPanel point={tx.refillPoint} onClose={() => setRefillPanelOpen(false)} />
      )}

      {tx.selectedLine && (
        <LinePanel lineInfo={tx.selectedLine} onClose={() => tx.setSelectedLine(null)} />
      )}

      {searchSelected && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] bg-white rounded-xl shadow-lg p-3 max-w-sm flex items-start gap-2">
          <p className="font-medium text-sm flex-1">{searchSelected.stationName}</p>
          <button onClick={() => setSearchSelected(null)} aria-label="Kapat" className="p-1 hover:bg-gray-100 rounded">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      )}
    </div>
  )
}
