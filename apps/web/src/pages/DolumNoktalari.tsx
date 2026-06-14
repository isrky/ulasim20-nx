import { type Dealer, getAllDealers } from '@/api/denizli'
import { DesktopNav, MobileNav } from '@/components/navigation'
import { Button } from '@ulasim20/ui-primitives'
import { Card } from '@ulasim20/ui-primitives'
import { useSEO } from '@/hooks/use-seo'
import { calculateDistance } from '@/lib/mock-data'
import { TransitProvider } from '@/lib/transit-context'
import { cn } from '@/lib/utils'
import { Building2, MapPin, MapPinned, Navigation, Store } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

type DealerType = 'bayi' | 'kiosk'

const typeConfig: Record<DealerType, { label: string; icon: typeof Building2; color: string }> = {
  bayi: { label: 'Bayi', icon: Building2, color: 'bg-blue-100 text-blue-700' },
  kiosk: { label: 'Kiosk', icon: Store, color: 'bg-purple-100 text-purple-700' },
}

function getDealerType(dealerName: string): DealerType {
  return dealerName.toLowerCase().includes('dolum') ? 'kiosk' : 'bayi'
}

function sortByDistance(dealers: Dealer[], userLat: number, userLng: number): Dealer[] {
  return [...dealers].sort((a, b) => {
    const distA = calculateDistance(userLat, userLng, Number(a.latitude), Number(a.longitude))
    const distB = calculateDistance(userLat, userLng, Number(b.latitude), Number(b.longitude))
    return distA - distB
  })
}

function getDistanceKm(dealer: Dealer, userLat: number, userLng: number): number {
  return calculateDistance(userLat, userLng, Number(dealer.latitude), Number(dealer.longitude))
}

function RefillPointsContent() {
  const [dealers, setDealers] = useState<Dealer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locationLoading, setLocationLoading] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)

  // Scroll to dealer when opening page with hash (e.g. from map "Detayları görüntüle")
  useEffect(() => {
    if (loading || dealers.length === 0) return
    const hash = window.location.hash.slice(1)
    if (!hash.startsWith('dealer-')) return
    const el = document.getElementById(hash)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [loading, dealers.length])

  useEffect(() => {
    let cancelled = false
    getAllDealers()
      .then((data) => {
        if (!cancelled) {
          setDealers(data)
          setError(null)
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Veri yüklenemedi')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const { bayiDealers, kioskDealers, allByProximity } = useMemo(() => {
    const bayiDealersRaw = dealers.filter((d) => getDealerType(d.dealerName) === 'bayi')
    const kioskDealersRaw = dealers.filter((d) => getDealerType(d.dealerName) === 'kiosk')
    const base = {
      bayiDealers: bayiDealersRaw,
      kioskDealers: kioskDealersRaw,
      allByProximity: null as Dealer[] | null,
    }
    if (!userLocation) return base
    return {
      ...base,
      kioskDealers: sortByDistance(kioskDealersRaw, userLocation.lat, userLocation.lng),
      bayiDealers: sortByDistance(bayiDealersRaw, userLocation.lat, userLocation.lng),
      allByProximity: sortByDistance(dealers, userLocation.lat, userLocation.lng),
    }
  }, [dealers, userLocation])

  const handleSortByProximity = () => {
    if (userLocation) {
      setUserLocation(null)
      setLocationError(null)
      return
    }
    setLocationLoading(true)
    setLocationError(null)
    if (!navigator.geolocation) {
      setLocationError('Konum desteklenmiyor')
      setLocationLoading(false)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocationLoading(false)
      },
      () => {
        setLocationError('Konum alınamadı')
        setLocationLoading(false)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    )
  }

  const renderPoints = (points: Dealer[], title: string) => (
    <div className="mb-6">
      <h2 className="font-semibold text-gray-700 mb-3">
        {title} ({points.length})
      </h2>
      <div className="space-y-2">
        {points.map((dealer) => {
          const type = getDealerType(dealer.dealerName)
          const config = typeConfig[type]
          const TypeIcon = config.icon
          const hasPhone = typeof dealer.phone === 'string' && dealer.phone.trim() !== ''
          const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${dealer.latitude},${dealer.longitude}`
          const distanceKm =
            userLocation != null ? getDistanceKm(dealer, userLocation.lat, userLocation.lng) : null
          return (
            <Card key={dealer.posNo} id={`dealer-${dealer.posNo}`} className="p-4 scroll-mt-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-3">
                  <div className={cn('p-2 rounded-lg', config.color)}>
                    <TypeIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{dealer.dealerName}</h3>
                    <p className="text-sm text-gray-500 mt-0.5">{dealer.address}</p>
                    {distanceKm != null && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {distanceKm < 1
                          ? `${Math.round(distanceKm * 1000)} m`
                          : `${distanceKm.toFixed(1)} km`}
                      </p>
                    )}
                    {hasPhone && (
                      <a
                        href={`tel:${dealer.phone?.trim()}`}
                        className="text-sm text-transit-primary font-medium mt-1 inline-block"
                      >
                        {dealer.phone?.trim()}
                      </a>
                    )}
                  </div>
                </div>
                <span className={cn('text-xs px-2 py-1 rounded-full font-medium', config.color)}>
                  {config.label}
                </span>
              </div>

              <div className="flex gap-2">
                <Link
                  to={`/harita?lat=${dealer.latitude}&lng=${dealer.longitude}&type=refill&name=${encodeURIComponent(dealer.dealerName)}&id=${dealer.posNo}`}
                  className="flex-1"
                >
                  <Button variant="outline" size="sm" className="w-full">
                    <MapPin className="w-4 h-4 mr-1" />
                    Haritada Gör
                  </Button>
                </Link>
                <a
                  href={googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1"
                >
                  <Button
                    size="sm"
                    className="w-full bg-transit-primary hover:bg-transit-primary/90"
                  >
                    <Navigation className="w-4 h-4 mr-1" />
                    Nasıl Giderim
                  </Button>
                </a>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-4 pb-20 md:pb-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Dolum Noktaları</h1>
        <p className="text-sm text-gray-500 mb-6">Denizli Kart dolum ve satış noktaları</p>
        <p className="text-gray-500">Yükleniyor…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto p-4 pb-20 md:pb-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Dolum Noktaları</h1>
        <p className="text-sm text-gray-500 mb-6">Denizli Kart dolum ve satış noktaları</p>
        <p className="text-red-600">{error}</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-4 pb-20 md:pb-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Dolum Noktaları</h1>
      <p className="text-sm text-gray-500 mb-4">Denizli Kart dolum ve satış noktaları</p>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Button
          variant={userLocation ? 'secondary' : 'outline'}
          size="sm"
          onClick={handleSortByProximity}
          disabled={locationLoading}
        >
          <MapPinned className="w-4 h-4 mr-1" />
          {userLocation ? 'Sıralamayı kaldır' : 'Yakınlığa göre sırala'}
        </Button>
        {locationLoading && <span className="text-sm text-gray-500">Konum alınıyor…</span>}
        {locationError && <span className="text-sm text-red-600">{locationError}</span>}
      </div>

      {userLocation && allByProximity ? (
        renderPoints(allByProximity, 'Yakından uzağa')
      ) : (
        <>
          {renderPoints(kioskDealers, 'Kiosklar')}
          {renderPoints(bayiDealers, 'Bayiler')}
        </>
      )}
    </div>
  )
}

export default function RefillPointsPage() {
  useSEO({
    title: 'Kart Dolum Noktaları',
    description:
      'Denizli genelindeki akıllı dolum noktaları, bayiler ve bakiye yükleme noktalarının harita üzerindeki konumları ve çalışma bilgileri.',
  })

  return (
    <TransitProvider>
      <div className="min-h-dvh flex flex-col bg-gray-50">
        <DesktopNav />
        <main className="flex-1">
          <RefillPointsContent />
        </main>
        <MobileNav />
      </div>
    </TransitProvider>
  )
}
