import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Input } from '@ulasim20/ui-primitives'
import { X, Clock, Bus, Search, MapPin, Navigation, List, AlertCircle } from 'lucide-react'
import type { IndexEntry } from '@ulasim20/util-search'
import type { Station } from '@ulasim20/data-access-transport-api'
import { searchStations } from '@ulasim20/util-search'
import { cleanLineCode } from '@ulasim20/util-format'
import { getBusDataForStation } from '@ulasim20/data-access-transport-api'
import { trackStopLookup } from '@ulasim20/util-analytics'
import { LINE_COLOR } from './constants'
import type { ProcessedStation } from './use-transit-map'
import type { RefillPoint, SelectedLineInfo } from './use-transit-map'

function parseCoord(coord: string): number | null {
  const num = Number(coord.replace(',', '.'))
  return Number.isFinite(num) ? num : null
}

export function SearchBar({
  stations,
  stationIndex,
  onSelectStop,
}: {
  stations: Station[]
  stationIndex: IndexEntry[]
  onSelectStop: (s: ProcessedStation) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ProcessedStation[]>([])
  const [showResults, setShowResults] = useState(false)

  useEffect(() => {
    if (query.length < 2) { setResults([]); return }
    const matched = searchStations(stations, query, stationIndex).filter((r) => r.score > 0).slice(0, 8).map((r) => r.item)
    const processed: ProcessedStation[] = []
    for (const s of matched) {
      const lat = parseCoord(s.latitude)
      const lng = parseCoord(s.longitude)
      if (lat != null && lng != null) processed.push({ stationId: s.stationId, stationName: s.stationName, lat, lng })
    }
    setResults(processed)
  }, [query, stations, stationIndex])

  const handleSelect = (stop: ProcessedStation) => {
    trackStopLookup({ stationId: stop.stationId, source: 'map_search' })
    onSelectStop(stop)
    setQuery('')
    setResults([])
    setShowResults(false)
  }

  return (
    <div className="absolute top-3 left-3 right-3 md:left-4 md:right-auto md:w-80 z-[1000]">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
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

interface StopArrival {
  lineCode: string
  lineName: string
  minutes: number
  hatno: string
}

export function StopPanel({
  stop,
  onClose,
  onSelectLine,
}: {
  stop: ProcessedStation
  onClose: () => void
  onSelectLine: (lineCode: string) => void
}) {
  const [arrivals, setArrivals] = useState<StopArrival[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getBusDataForStation(stop.stationId).then((res) => {
      if (cancelled || !res?.value?.busList) return
      const list: StopArrival[] = []
      for (const bus of res.value.busList) {
        if (bus.plaka === 'EnYakinKalkis') continue
        let mins: number | null = null
        if (bus.sure) {
          const parts = bus.sure.split(':').map(Number)
          if (parts.every((n) => Number.isFinite(n))) { const [h = 0, m = 0, s = 0] = parts; mins = Math.floor((h * 3600 + m * 60 + s) / 60) }
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

export function RefillPanel({ point, onClose }: { point: RefillPoint; onClose: () => void }) {
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

export function LinePanel({ lineInfo, onClose }: { lineInfo: SelectedLineInfo; onClose: () => void }) {
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
